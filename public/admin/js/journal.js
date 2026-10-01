/**
 * Admin Journal editor.
 *
 * The Journal is a static site, so this view is a controlled editor for
 * backend/scripts/journalData.js: every save posts to /api/v1/admin/journal,
 * the server rewrites the data file and re-runs the generator. Nothing here
 * writes files or calls the generator directly.
 *
 * Drafts and deleted articles are visible here and nowhere else. Nothing in this
 * file decides whether an article is public; that is the server's answer.
 */
(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  const BLOCK_TYPES = ['p', 'h2', 'quote'];
  const BLOCK_LABEL = { p: 'Paragraph', h2: 'Heading', quote: 'Pull quote' };

  let state = { articles: [], categories: [], counts: {}, filter: 'all', query: '' };
  let images = [];
  let dirty = false;

  function esc(s) { return U.esc(s); }

  /* ------------------------------------------------------------ data access */

  async function load() {
    const stage = document.getElementById('journalView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    try {
      const data = await window.AdminAPI.get('/journal');
      state.articles = data.articles || [];
      state.categories = data.categories || [];
      state.counts = data.counts || {};
      render(stage);
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      stage.innerHTML = '<div class="card error-card">' + esc(err.message) + '</div>';
    }
  }

  /* Guard against losing an edit by clicking away from the form. */
  function markDirty(on) {
    dirty = on;
  }

  function confirmDiscard() {
    return !dirty || window.confirm('You have unsaved changes. Discard them?');
  }

  /* ---------------------------------------------------------------- filters */

  function visibleArticles() {
    return state.articles.filter(function (a) {
      if (state.filter === 'published' && !a.isPublished) return false;
      if (state.filter === 'drafts' && (a.isPublished || a.deletedAt)) return false;
      if (state.filter === 'deleted' && !a.deletedAt) return false;
      if (state.query) {
        const haystack = (a.title + ' ' + a.slug + ' ' + a.category).toLowerCase();
        if (haystack.indexOf(state.query.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  /* ----------------------------------------------------------------- render */

  function statusBadge(a) {
    if (a.deletedAt) return '<span class="status-tag s-cancelled">Deleted</span>';
    if (!a.isPublished) return '<span class="status-tag s-pending">Draft</span>';
    if (a.featured === true) return '<span class="status-tag s-checked_in">Featured</span>';
    return '<span class="status-tag s-available">Live</span>';
  }

  function articleRow(a) {
    return '<tr data-slug="' + esc(a.slug) + '">' +
      '<td><strong>' + esc(a.title) + '</strong><br><span class="muted">/' + esc(a.slug) + '</span></td>' +
      '<td>' + esc(a.category) + '</td>' +
      '<td>' + esc(a.date) + '</td>' +
      '<td>' + statusBadge(a) + '</td>' +
      '<td>' +
        '<button class="btn btn-xs" data-edit="' + esc(a.slug) + '">Edit</button> ' +
        '<button class="btn btn-xs" data-preview="' + esc(a.slug) + '">Preview</button> ' +
        (a.isPublished
          ? '<button class="btn btn-xs" data-unpublish="' + esc(a.slug) + '">Unpublish</button> '
          : (a.deletedAt
            ? '<button class="btn btn-xs" data-restore="' + esc(a.slug) + '">Restore</button> '
            : '<button class="btn btn-xs" data-publish="' + esc(a.slug) + '">Publish</button>')) +
        (a.isPublished && a.featured !== true
          ? ' <button class="btn btn-xs" data-feature="' + esc(a.slug) + '">Feature</button>' : '') +
        (a.isPublished
          ? ' <button class="btn btn-xs btn-danger" data-delete="' + esc(a.slug) + '">Delete</button>' : '') +
      '</td></tr>';
  }

  function render(stage) {
    const rows = visibleArticles();
    const counts = state.counts;

    const tabs = [
      ['all', 'All (' + (counts.total || 0) + ')'],
      ['published', 'Live (' + (counts.published || 0) + ')'],
      ['drafts', 'Drafts (' + (counts.drafts || 0) + ')'],
      ['deleted', 'Deleted (' + (counts.deleted || 0) + ')'],
    ].map(function (t) {
      return '<button class="btn btn-sm ' + (state.filter === t[0] ? 'btn-primary' : 'btn-ghost') +
        '" data-filter="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join(' ');

    const body = rows.length
      ? rows.map(articleRow).join('')
      : '<tr><td colspan="5" class="muted">Nothing here yet.</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><h3>Journal</h3>' +
        '<div><button class="btn btn-sm" id="journalRebuild">Rebuild</button> ' +
        '<button class="btn btn-sm btn-primary" id="journalNew">+ New article</button></div></div>' +
      '<p class="muted">Saving rewrites <code>backend/scripts/journalData.js</code> and regenerates the ' +
        'Journal pages and sitemap. Drafts and deleted articles stay off the public site.</p>' +
      '<div class="filters">' + tabs +
        '<input class="input" id="journalSearch" placeholder="Search title or slug" value="' + esc(state.query) + '" />' +
      '</div>' +
      '<table class="table"><thead><tr>' +
        '<th>Article</th><th>Category</th><th>Date</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>' +
      '</div>';

    stage.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.filter = b.dataset.filter;
        render(stage);
      });
    });

    const search = stage.querySelector('#journalSearch');
    search.addEventListener('input', function () {
      state.query = search.value;
      const pos = search.selectionStart;
      render(stage);
      const next = stage.querySelector('#journalSearch');
      next.focus();
      next.setSelectionRange(pos, pos);
    });

    stage.querySelector('#journalNew').addEventListener('click', function () {
      if (confirmDiscard()) openEditor(null, stage);
    });
    stage.querySelector('#journalRebuild').addEventListener('click', function () {
      rebuild(stage);
    });

    stage.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (confirmDiscard()) openEditor(b.dataset.edit, stage);
      });
    });
    stage.querySelectorAll('[data-preview]').forEach(function (b) {
      b.addEventListener('click', function () { preview(b.dataset.preview); });
    });
    stage.querySelectorAll('[data-publish]').forEach(function (b) {
      b.addEventListener('click', function () { setPublished(b.dataset.publish, true, stage); });
    });
    stage.querySelectorAll('[data-unpublish]').forEach(function (b) {
      b.addEventListener('click', function () { setPublished(b.dataset.unpublish, false, stage); });
    });
    stage.querySelectorAll('[data-feature]').forEach(function (b) {
      b.addEventListener('click', function () { feature(b.dataset.feature, stage); });
    });
    stage.querySelectorAll('[data-delete]').forEach(function (b) {
      b.addEventListener('click', function () { remove(b.dataset.delete, stage); });
    });
    stage.querySelectorAll('[data-restore]').forEach(function (b) {
      b.addEventListener('click', function () { restore(b.dataset.restore, stage); });
    });
  }

  /* ---------------------------------------------------------------- actions */

  async function busy(stage, message) {
    stage.innerHTML = '<div class="card"><div class="skeleton">' + esc(message) + '</div></div>';
  }

  async function setPublished(slug, published, stage) {
    if (!published && !window.confirm('Take "' + slug + '" off the public site? It will be kept as a draft.')) return;
    busy(stage, published ? 'Publishing…' : 'Unpublishing…');
    try {
      const res = await window.AdminAPI.put('/journal/' + encodeURIComponent(slug) + '/publish', { published: published });
      window.AdminUI.toast(res && res.title ? '"' + res.title + '" is now ' + (published ? 'live' : 'a draft') : 'Done');
      await load();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      await load();
    }
  }

  async function feature(slug, stage) {
    busy(stage, 'Updating the featured story…');
    try {
      await window.AdminAPI.put('/journal/' + encodeURIComponent(slug) + '/feature', {});
      window.AdminUI.toast('"' + slug + '" is now featured');
      await load();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      await load();
    }
  }

  async function remove(slug, stage) {
    if (!window.confirm('Delete "' + slug + '"?\n\nIt disappears from the public site immediately and can be restored afterwards.')) return;
    busy(stage, 'Deleting…');
    try {
      await window.AdminAPI.del('/journal/' + encodeURIComponent(slug));
      window.AdminUI.toast('"' + slug + '" was removed from the public site');
      await load();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      await load();
    }
  }

  async function restore(slug, stage) {
    busy(stage, 'Restoring…');
    try {
      await window.AdminAPI.post('/journal/' + encodeURIComponent(slug) + '/restore', {});
      window.AdminUI.toast('"' + slug + '" is back on the public site');
      await load();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      await load();
    }
  }

  async function rebuild(stage) {
    busy(stage, 'Rebuilding…');
    try {
      await window.AdminAPI.post('/journal/rebuild', {});
      window.AdminUI.toast('Journal rebuilt from journalData.js');
      await load();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
      await load();
    }
  }

  /* The preview endpoint requires the admin session, so the markup has to be
     fetched rather than opened as a plain link: a draft has no public URL. */
  async function preview(slug) {
    try {
      const res = await fetch('/api/v1/admin/journal/preview/' + encodeURIComponent(slug), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Preview failed (' + res.status + ')');
      const html = await res.text();
      const win = window.open('', '_blank');
      if (!win) {
        window.AdminUI.toast('Allow pop-ups to open the preview.', true);
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      window.AdminUI.toast(err.message, true);
    }
  }

  /* ------------------------------------------------------------------ editor */

  function imageField(label, name, value, extra) {
    const src = (value && value.src) || '';
    return '<div class="field">' +
      '<label class="legend">' + esc(label) + '</label>' +
      '<div class="journal-img-row">' +
        '<select class="input" name="' + name + 'Src" data-image-picker="1">' +
          '<option value="">Choose an image…</option>' +
          images.map(function (img) {
            return '<option value="' + esc(img.src) + '"' + (img.src === src ? ' selected' : '') +
              (img.w ? ' data-w="' + img.w + '" data-h="' + img.h + '"' : '') +
              '>' + esc(img.src.replace(/^\/images\//, '')) + '</option>';
          }).join('') +
        '</select>' +
        '<div class="journal-img-thumb"><img data-preview-for="' + name + '" src="' + esc(src) + '" alt="" /></div>' +
      '</div>' +
      '<div class="journal-img-meta">' +
        '<input class="input" type="number" min="1" max="10000" name="' + name + 'W" placeholder="Width" value="' + ((value && value.w) || '') + '" />' +
        '<input class="input" type="number" min="1" max="10000" name="' + name + 'H" placeholder="Height" value="' + ((value && value.h) || '') + '" />' +
        '<input class="input" name="' + name + 'Alt" placeholder="Alt text" value="' + esc((value && value.alt) || '') + '" />' +
        '<input class="input" name="' + name + 'Caption" placeholder="Caption" value="' + esc((value && value.caption) || '') + '" />' +
      '</div>' +
      (extra || '') +
      '</div>';
  }

  function blockRow(block, index) {
    return '<div class="journal-block" data-block="' + index + '">' +
      '<select class="input" data-block-type="1">' +
        BLOCK_TYPES.map(function (t) {
          return '<option value="' + t + '"' + (block.type === t ? ' selected' : '') + '>' + BLOCK_LABEL[t] + '</option>';
        }).join('') +
      '</select>' +
      '<textarea class="input" data-block-text="1" rows="3" placeholder="Text">' + esc(block.text) + '</textarea>' +
      '<div><button class="btn btn-xs" data-block-up="1" aria-label="Move block up">↑</button> ' +
      '<button class="btn btn-xs" data-block-down="1" aria-label="Move block down">↓</button> ' +
      '<button class="btn btn-xs btn-danger" data-block-del="1">Remove</button></div>' +
      '</div>';
  }

  function emptyArticle() {
    return {
      slug: '',
      title: '',
      dek: '',
      category: '',
      date: U.todayStr(),
      readingTime: '5 min read',
      excerpt: '',
      hero: { src: '', w: '', h: '', alt: '', caption: '' },
      inline: [],
      body: [{ type: 'p', text: '' }],
    };
  }

  function openEditor(slug, stage) {
    const existing = slug ? state.articles.find(function (a) { return a.slug === slug; }) : null;
    const a = existing ? JSON.parse(JSON.stringify(existing)) : emptyArticle();

    // "All" is a filter label, not a place an article can be filed under.
    const categories = state.categories.filter(function (c) { return c !== 'All'; });

    const html =
      '<div class="journal-editor">' +
      '<h3>' + (existing ? 'Edit article' : 'New article') + '</h3>' +
      '<div class="journal-form-error" data-form-error hidden></div>' +

      '<div class="field-row">' +
        '<div class="field"><label class="legend" for="jf-title">Title</label>' +
          '<input class="input" id="jf-title" name="title" value="' + esc(a.title) + '" /></div>' +
        '<div class="field"><label class="legend" for="jf-slug">Slug</label>' +
          '<input class="input" id="jf-slug" name="slug" value="' + esc(a.slug) + '" placeholder="a-slow-morning-in-jibhi" />' +
          (existing ? '<p class="muted">Currently /pages/blog/' + esc(a.slug) + '.html</p>' : '') +
        '</div>' +
      '</div>' +

      '<div class="field"><label class="legend" for="jf-dek">Standfirst</label>' +
        '<textarea class="input" id="jf-dek" name="dek" rows="2">' + esc(a.dek) + '</textarea></div>' +

      '<div class="field-row">' +
        '<div class="field"><label class="legend" for="jf-category">Category</label>' +
          '<select class="input" id="jf-category" name="category">' +
            categories.map(function (c) {
              return '<option value="' + esc(c) + '"' + (a.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
            }).join('') +
          '</select></div>' +
        '<div class="field"><label class="legend" for="jf-date">Date</label>' +
          '<input class="input" id="jf-date" name="date" type="date" value="' + esc(a.date) + '" /></div>' +
        '<div class="field"><label class="legend" for="jf-reading">Reading time</label>' +
          '<input class="input" id="jf-reading" name="readingTime" value="' + esc(a.readingTime) + '" placeholder="6 min read" /></div>' +
      '</div>' +

      '<div class="field"><label class="legend" for="jf-excerpt">Card excerpt</label>' +
        '<textarea class="input" id="jf-excerpt" name="excerpt" rows="2">' + esc(a.excerpt) + '</textarea></div>' +

      imageField('Hero image', 'hero', a.hero) +

      '<div class="field"><label class="legend">Inline images</label>' +
        '<div data-inline-list>' +
          a.inline.map(function (img, i) {
            return imageField('Image ' + (i + 1), 'inline' + i, img,
              '<button class="btn btn-xs btn-danger" data-inline-del="' + i + '">Remove image</button>');
          }).join('') +
        '</div>' +
        '<button class="btn btn-sm" id="addInline" type="button">+ Add inline image</button>' +
      '</div>' +

      '<div class="field"><label class="legend">Content</label>' +
        '<div data-block-list>' + a.body.map(blockRow).join('') + '</div>' +
        '<div class="journal-block-actions">' +
          '<button class="btn btn-sm" data-add-block="p" type="button">+ Paragraph</button> ' +
          '<button class="btn btn-sm" data-add-block="h2" type="button">+ Heading</button> ' +
          '<button class="btn btn-sm" data-add-block="quote" type="button">+ Quote</button>' +
        '</div>' +
      '</div>' +

      '<div class="journal-editor-actions">' +
        '<button class="btn btn-primary" data-save="publish" type="button">Save &amp; publish</button> ' +
        '<button class="btn" data-save="draft" type="button">Save as draft</button> ' +
        (existing && existing.isPublished ? '<button class="btn" id="jf-preview" type="button">Preview</button> ' : '') +
        '<button class="btn btn-ghost" id="jf-cancel" type="button">Cancel</button>' +
      '</div>' +
      '<p class="muted">Publishing regenerates every Journal page and the sitemap. If the build fails, ' +
        'nothing is saved and the previous version stays live.</p>' +
      '</div>';

    const wrap = window.AdminUI.openModal(html);
    const form = wrap.querySelector('.journal-editor');

    const showError = function (msg) {
      const el = form.querySelector('[data-form-error]');
      el.textContent = msg;
      el.hidden = false;
    };

    form.addEventListener('input', function () { markDirty(true); });
    form.addEventListener('change', function () { markDirty(true); });

    /* Choosing an image fills the dimensions from the file itself, so the
       generated <img> is right without anyone measuring it. */
    form.querySelectorAll('[data-image-picker]').forEach(function (select) {
      select.addEventListener('change', function () {
        const opt = select.selectedOptions[0];
        const base = select.name.replace(/Src$/, '');
        if (opt && opt.dataset.w) {
          const w = form.querySelector('[name="' + base + 'W"]');
          const h = form.querySelector('[name="' + base + 'H"]');
          if (w && !w.value) w.value = opt.dataset.w;
          if (h && !h.value) h.value = opt.dataset.h;
        }
        const preview = form.querySelector('[data-preview-for="' + base + '"]');
        if (preview) preview.src = select.value;
      });
    });

    const reindex = function () {
      form.querySelectorAll('[data-block]').forEach(function (row, i) {
        row.dataset.block = i;
      });
    };

    form.querySelectorAll('[data-add-block]').forEach(function (b) {
      b.addEventListener('click', function () {
        const list = form.querySelector('[data-block-list]');
        const tmp = document.createElement('div');
        tmp.innerHTML = blockRow({ type: b.dataset.addBlock, text: '' }, 0);
        list.appendChild(tmp.firstChild);
        reindex();
        markDirty(true);
      });
    });

    form.querySelectorAll('[data-block-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const rows = form.querySelectorAll('[data-block]');
        if (rows.length <= 1) {
          window.AdminUI.toast('An article needs at least one content block.', true);
          return;
        }
        b.closest('[data-block]').remove();
        reindex();
        markDirty(true);
      });
    });

    const move = function (row, delta) {
      const list = form.querySelector('[data-block-list]');
      const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (delta < 0) list.insertBefore(row, sibling);
      else list.insertBefore(sibling, row);
      reindex();
      markDirty(true);
    };
    form.querySelectorAll('[data-block-up]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.closest('[data-block]'), -1); });
    });
    form.querySelectorAll('[data-block-down]').forEach(function (b) {
      b.addEventListener('click', function () { move(b.closest('[data-block]'), 1); });
    });

    form.querySelector('#addInline').addEventListener('click', function () {
      const list = form.querySelector('[data-inline-list]');
      const count = list.querySelectorAll('.field').length;
      const tmp = document.createElement('div');
      tmp.innerHTML = imageField('Image ' + (count + 1), 'inline' + count, { src: '', w: '', h: '', alt: '', caption: '' },
        '<button class="btn btn-xs btn-danger" data-inline-del="' + count + '">Remove image</button>');
      const node = tmp.firstChild;
      list.appendChild(node);
      wireImage(node);
      markDirty(true);
    });

    function wireImage(scope) {
      scope.querySelectorAll('[data-inline-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          b.closest('.field').remove();
          markDirty(true);
        });
      });
      const select = scope.querySelector('[data-image-picker]');
      if (!select) return;
      select.addEventListener('change', function () {
        const opt = select.selectedOptions[0];
        const base = select.name.replace(/Src$/, '');
        if (opt && opt.dataset.w) {
          const w = scope.querySelector('[name="' + base + 'W"]');
          const h = scope.querySelector('[name="' + base + 'H"]');
          if (w && !w.value) w.value = opt.dataset.w;
          if (h && !h.value) h.value = opt.dataset.h;
        }
        const img = scope.querySelector('[data-preview-for="' + base + '"]');
        if (img) img.src = select.value;
      });
    }
    form.querySelectorAll('[data-inline-list] > .field').forEach(wireImage);

    form.querySelectorAll('[data-save]').forEach(function (b) {
      b.addEventListener('click', function () { save(b.dataset.save); });
    });
    form.querySelector('#jf-cancel').addEventListener('click', function () {
      if (confirmDiscard()) window.AdminUI.closeModal();
    });
    const previewBtn = form.querySelector('#jf-preview');
    if (previewBtn) previewBtn.addEventListener('click', function () { preview(slug); });

    function collect() {
      const val = function (name) {
        const el = form.querySelector('[name="' + name + '"]');
        return el ? el.value.trim() : '';
      };
      const num = function (name) {
        const n = Number(val(name));
        return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
      };
      const image = function (base) {
        return {
          src: val(base + 'Src'),
          w: num(base + 'W'),
          h: num(base + 'H'),
          alt: val(base + 'Alt'),
          caption: val(base + 'Caption'),
        };
      };

      const inline = [];
      form.querySelectorAll('[data-inline-list] > .field').forEach(function (field) {
        const base = field.querySelector('[data-image-picker]').name.replace(/Src$/, '');
        const img = image(base);
        if (img.src) inline.push(img);
      });

      const body = [];
      form.querySelectorAll('[data-block]').forEach(function (row) {
        const text = row.querySelector('[data-block-text]').value.trim();
        if (text) body.push({ type: row.querySelector('[data-block-type]').value, text: text });
      });

      return {
        slug: val('slug'),
        title: val('title'),
        dek: val('dek'),
        category: val('category'),
        date: val('date'),
        readingTime: val('readingTime'),
        excerpt: val('excerpt'),
        hero: image('hero'),
        inline: inline,
        body: body,
      };
    }

    async function save(mode) {
      const payload = collect();
      if (mode === 'draft' && existing && existing.isPublished) payload.status = 'published';
      else payload.status = mode === 'draft' ? 'draft' : 'published';

      // A published article whose slug changes moves a URL search engines know,
      // so it takes a second, explicit confirmation.
      let confirmSlugChange = false;
      if (existing && payload.slug && payload.slug !== existing.slug) {
        const moved = window.confirm(
          'This changes the published URL from\n/pages/blog/' + existing.slug + '.html\nto\n/pages/blog/' + payload.slug +
          '.html\n\nThe old address will stop working. Continue?'
        );
        if (!moved) return;
        confirmSlugChange = true;
      }

      form.querySelectorAll('[data-save]').forEach(function (b) { b.disabled = true; });

      try {
        if (existing) {
          if (confirmSlugChange) payload.confirmSlugChange = true;
          await window.AdminAPI.put('/journal/' + encodeURIComponent(existing.slug), payload);
          window.AdminUI.toast('Saved and rebuilt');
        } else {
          await window.AdminAPI.post('/journal', payload);
          window.AdminUI.toast(mode === 'draft' ? 'Saved as a draft' : 'Published');
        }
        markDirty(false);
        window.AdminUI.closeModal();
        await load();
      } catch (err) {
        form.querySelectorAll('[data-save]').forEach(function (b) { b.disabled = false; });
        showError(err.message);
        window.AdminUI.toast(err.message, true);
      }
    }
  }

  /* Images are only needed when the editor opens, so the picker is lazy. */
  async function ensureImages() {
    if (images.length) return;
    try {
      const data = await window.AdminAPI.get('/journal/images');
      images = data.images || [];
    } catch (err) {
      window.AdminUI.toast('Could not load the image library: ' + err.message, true);
    }
  }

  window.AdminViews.journal = async function (el) {
    el.id = 'journalView';
    await ensureImages();
    await load();
  };
})();
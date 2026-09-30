(function () {
  window.AdminViews = window.AdminViews || {};
  const U = window.AdminUI;

  function api() {
    return window.AdminAPI;
  }

  // Fallbacks are written relative to the page that uses them ("images/x.jpg"
  // on the home page, "../images/x.jpg" inside /pages). The admin panel lives at
  // /admin/, so resolve them against the site root to get a previewable URL.
  function previewUrl(u) {
    if (!u) return '';
    if (/^(https?:|data:|\/)/i.test(u)) return u;
    return '/' + u.replace(/^(\.\.\/|\.\/)+/, '');
  }

  function renderPageCard(page, images) {
    const esc = U.esc;
    var html = '';
    html += '<div class="card" data-page="' + esc(page.id) + '">';
    html += '<div class="card-head">';
    html += '<h3>' + esc(page.title) + ' <span class="muted">(' + images.length + ' slots)</span></h3>';
    html += '</div>';
    html += '<div class="img-grid">';
    images.forEach(function (img) {
      var eff = previewUrl(img.effectiveUrl);
      var hasOverride = !!img.isOverridden;
      var kindLabel = img.kind === 'bg' ? 'Background' : img.kind === 'meta' ? 'Meta image' : 'Image';
      html += '<div class="img-slot' + (hasOverride ? ' overridden' : '') + '" data-key="' + esc(img.key) + '">';
      html += '<div class="img-preview">';
      if (eff && img.kind !== 'meta') {
        html += '<img src="' + esc(eff) + '" loading="lazy" alt="" />';
      } else {
        html += '<div style="padding:20px;font-size:12px;color:#666">No preview for this slot</div>';
      }
      if (hasOverride) html += '<span class="img-badge">OVERRIDDEN</span>';
      html += '</div>';
      html += '<div class="img-meta">';
      html += '<h4>' + esc(img.label) + '</h4>';
      html += '<div class="small muted">' + kindLabel + ' &middot; ' + esc(img.key) + '</div>';
      if (img.updatedAt) {
        html += '<div class="small muted">Updated ' + esc(new Date(img.updatedAt).toLocaleString()) + (img.updatedByEmail ? ' by ' + esc(img.updatedByEmail) : '') + '</div>';
      }
      html += '<div class="img-actions">';
      html += '<button class="btn btn-small btn-ghost" data-action="change">Change</button>';
      if (hasOverride) html += '<button class="btn btn-small btn-danger-ghost" data-action="revert">Undo</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  // The owner recognises their own filenames, not storage ids. Cloudinary
  // entries only have a path, so fall back to that.
  function libraryLabel(r) {
    if (r.originalName) return r.originalName;
    return (r.public_id || '').replace(/^fam\//, '');
  }

  function renderLibrary(resources, nextCursor) {
    var html = '<div class="card"><div class="card-head"><h3>Choose an image you already uploaded</h3><button class="btn btn-ghost" data-close="1">Close</button></div>';
    if (!resources || !resources.length) {
      html += '<p class="muted">Nothing here yet. Upload an image first, and it will show up here to reuse later.</p>';
    }
    html += '<div class="img-grid">';
    (resources || []).forEach(function (r) {
      html += '<div class="img-slot library-item" data-public-id="' + U.esc(r.public_id) + '" data-url="' + U.esc(r.url) + '">';
      html += '<div class="img-preview"><img src="' + U.esc(r.url) + '" alt="" loading="lazy"/></div>';
      html += '<div class="small muted">' + U.esc(libraryLabel(r)) + '</div>';
      if (r.bytes) html += '<div class="small muted">' + Math.round(r.bytes/1024) + ' KB' + (r.width ? ' &middot; ' + r.width + '&times;' + r.height : '') + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="pager">';
    if (nextCursor) html += '<button class="btn btn-ghost" data-action="more" data-cursor="' + U.esc(nextCursor) + '">Load more</button>';
    html += '<button class="btn btn-ghost" data-close="1">Cancel</button>';
    html += '</div></div>';
    return html;
  }

  function openPicker(state) {
    const wrap = window.AdminUI.openModal(renderLibrary(state.library || [], state.libraryCursor));
    wrap.querySelectorAll('.library-item').forEach(function (el) {
      el.addEventListener('click', function () {
        const url = el.dataset.url;
        const pid = el.dataset.publicId;
        // openModal replaces the modal root, so the editor (and its alt field)
        // is gone by now. Carry the alt text across in state.
        const payload = { url: url, publicId: pid };
        if (state.alt) payload.alt = state.alt;
        // Keep the modal open and the chosen tile marked until the save is
        // confirmed, so a rejected save cannot look like it worked.
        el.style.outline = '2px solid var(--brand)';
        el.style.opacity = '0.6';
        el.style.pointerEvents = 'none';
        window.AdminUI.toast('Saving...');
        applyOverride(state.key, payload).then(function () {
          window.AdminUI.closeModal();
        }).catch(function (err) {
          window.AdminUI.toast(err.message, true);
          el.style.outline = '';
          el.style.opacity = '';
          el.style.pointerEvents = '';
        });
      });
    });
    const more = wrap.querySelector('[data-action="more"]');
    if (more) {
      more.addEventListener('click', function (e) {
        loadLibrary(e.currentTarget.dataset.cursor, state);
      });
    }
  }

  function loadLibrary(cursor, state) {
    api().get('/site-images/library?cursor=' + encodeURIComponent(cursor||'') + '&limit=40').then(function (d) {
      state.library = (state.library||[]).concat(d.resources||[]);
      state.libraryCursor = d.nextCursor;
      openPicker(state);
    }).catch(function (e){ window.AdminUI.toast(e.message,true); });
  }

  function applyOverride(key, payload) {
    return api().put('/site-images/' + key, payload).then(function () {
      window.AdminUI.toast('Image updated');
      loadView();
    });
  }

  function storageNotice(s) {
    if (!s) return '';

    // The default provider stores image bytes in the database, so uploads work
    // out of the box. Only an actual failure needs to interrupt the owner.
    if (s.ready && !s.detail) return '';

    var reason = s.detail
      ? s.detail
      : 'The server cannot save uploaded images right now, so uploading and the image library are unavailable. Please try again in a moment.';

    return 'Uploading images is not available at the moment. ' + reason;
  }

  function openEditor(img, storage) {
    var current = previewUrl(img.effectiveUrl);
    var notice = storageNotice(storage);
    var mb = storage && storage.maxBytes ? Math.round(storage.maxBytes / (1024 * 1024)) : 5;
    var html = '';
    html += '<div class="card"><div class="card-head"><h3>Change image</h3><button class="btn btn-ghost" data-close="1">Close</button></div>';
    html += '<div class="field"><span class="muted">' + U.esc(img.label) + '</span>';
    if (current) html += '<div style="margin-top:8px;max-width:260px;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><img src="' + U.esc(current) + '" alt="" style="width:100%;display:block" /></div>';
    html += '</div>';
    if (notice) html += '<div class="field"><div class="notice-card"><div>' + U.esc(notice) + '</div></div></div>';
    html += '<form id="imgForm">';
    html += '<div class="field"><span>Upload a new image (JPG/PNG/WebP/GIF, up to ' + mb + 'MB)</span><input type="file" id="imgFile" accept="image/*" /></div>';
    html += '<div class="field"><span>Or choose one you already uploaded</span><button type="button" class="btn btn-ghost" id="pickLib">Choose from library</button></div>';
    html += '<div class="field"><span>Alt text (optional, leave blank to keep existing)</span><input id="imgAlt" value="' + U.esc(img.alt||'') + '" /></div>';
    html += '<div class="pager"><button type="submit" class="btn btn-primary">Save change</button><button type="button" class="btn btn-ghost" data-close="1">Cancel</button></div>';
    html += '</form></div>';
    const wrap = window.AdminUI.openModal(html);
    const state = { key: img.key, alt: img.alt || '', library: [], libraryCursor: null };
    wrap.querySelector('#pickLib').addEventListener('click', function () {
      // Capture the alt text before the library modal replaces this one.
      state.alt = wrap.querySelector('#imgAlt').value;
      loadLibrary('', state);
    });
    wrap.querySelector('#imgForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const file = wrap.querySelector('#imgFile').files[0];
      const alt = wrap.querySelector('#imgAlt').value;
      if (!file) { window.AdminUI.toast('Pick a file to upload, or use "Choose from library"', true); return; }
      const fd = new FormData();
      fd.append('image', file);
      window.AdminUI.toast('Uploading...');
      api().upload('/site-images/upload', fd).then(function (up) {
        return applyOverride(img.key, { url: up.url, publicId: up.public_id, alt: alt });
      }).then(function () {
        window.AdminUI.closeModal();
      }).catch(function (err){ window.AdminUI.toast(err.message,true); });
    });
  }

  function loadView() {
    const stage = document.getElementById('imgView');
    stage.innerHTML = '<div class="skeleton">&nbsp;</div>';
    api().get('/site-images').then(function (data) {
      renderAll(stage, data);
    }).catch(function (e){
      window.AdminUI.toast(e.message,true);
      stage.innerHTML = '<div class="card error-card">' + U.esc(e.message) + '</div>';
    });
  }

  function renderAll(stage, data) {
    var html = '';
    var notice = storageNotice(data.storage);
    if (notice) {
      html += '<div class="notice-card"><div>' + U.esc(notice) + '</div></div>';
    }
    (data.pages || []).forEach(function (p) {
      const list = (data.images||[]).filter(function (i){ return i.page===p.id; });
      html += renderPageCard(p, list);
    });
    stage.innerHTML = html;
    stage.querySelectorAll('[data-action="change"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.closest('.img-slot').dataset.key;
        const img = (data.images||[]).find(function (i){ return i.key===key; });
        if (img) openEditor(img, data.storage);
      });
    });
    stage.querySelectorAll('[data-action="revert"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Put the original image back?')) return;
        const key = btn.closest('.img-slot').dataset.key;
        api().post('/site-images/' + key + '/revert').then(function () {
          window.AdminUI.toast('Original image restored');
          loadView();
        }).catch(function (e){ window.AdminUI.toast(e.message,true); });
      });
    });
  }

  window.AdminViews.images = function (stage) {
    stage.id = 'imgView';
    loadView();
  };
})();

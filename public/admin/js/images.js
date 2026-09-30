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
      html += '<button class="btn btn-small btn-ghost" data-action="change">Replace</button>';
      if (hasOverride) html += '<button class="btn btn-small btn-danger-ghost" data-action="revert">Revert</button>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderLibrary(resources, nextCursor) {
    var html = '<div class="card"><div class="card-head"><h3>Pick an existing image from Cloudinary</h3><button class="btn btn-ghost" data-close="1">Close</button></div>';
    html += '<div class="img-grid">';
    (resources || []).forEach(function (r) {
      html += '<div class="img-slot library-item" data-public-id="' + U.esc(r.public_id) + '" data-url="' + U.esc(r.url) + '">';
      html += '<div class="img-preview"><img src="' + U.esc(r.url) + '" loading="lazy"/></div>';
      html += '<div class="small muted">' + U.esc((r.public_id || '').replace(/^fam\//, '')) + '</div>';
      if (r.bytes) html += '<div class="small muted">' + Math.round(r.bytes/1024) + ' KB &middot; ' + (r.width||'?') + '&times;' + (r.height||'?') + '</div>';
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
        applyOverride(state.key, payload);
        window.AdminUI.closeModal();
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

  function openEditor(img) {
    var html = '';
    html += '<div class="card"><div class="card-head"><h3>Replace ' + U.esc(img.label) + '</h3><button class="btn btn-ghost" data-close="1">Close</button></div>';
    html += '<form id="imgForm" enctype="multipart/form-data">';
    html += '<div class="field"><span>Upload a new image (JPG/PNG/WebP, up to 5MB)</span><input type="file" id="imgFile" accept="image/*" required /></div>';
    html += '<div class="field"><span>Or choose from library</span><button type="button" class="btn btn-ghost" id="pickLib">Browse existing images</button></div>';
    html += '<div class="field"><span>Alt text (optional, leave blank to keep existing)</span><input id="imgAlt" value="' + U.esc(img.alt||'') + '" /></div>';
    html += '<div class="pager"><button type="submit" class="btn btn-primary">Apply</button><button type="button" class="btn btn-ghost" data-close="1">Cancel</button></div>';
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
      if (!file) { window.AdminUI.toast('Choose an image to upload', true); return; }
      const fd = new FormData();
      fd.append('image', file);
      window.AdminUI.toast('Uploading image...');
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
    (data.pages || []).forEach(function (p) {
      const list = (data.images||[]).filter(function (i){ return i.page===p.id; });
      html += renderPageCard(p, list);
    });
    stage.innerHTML = html;
    stage.querySelectorAll('[data-action="change"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.closest('.img-slot').dataset.key;
        const img = (data.images||[]).find(function (i){ return i.key===key; });
        if (img) openEditor(img);
      });
    });
    stage.querySelectorAll('[data-action="revert"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Revert this image back to the original version?')) return;
        const key = btn.closest('.img-slot').dataset.key;
        api().post('/site-images/' + key + '/revert').then(function () {
          window.AdminUI.toast('Restored to default');
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

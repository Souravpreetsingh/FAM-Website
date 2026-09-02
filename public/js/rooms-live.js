/**
 * FAM Rooms Live — overlays live room data from /api/v1/rooms onto the
 * public Rooms page so admin edits (price, description, amenities, status)
 * are reflected without redeploying.
 *
 * Existing <article data-room-slug> blocks are updated in place; rooms that
 * exist in the database but not in the static page are appended as new
 * articles so newly created rooms appear automatically.
 */
(function () {
  'use strict';

  var section = document.getElementById('rooms-section');
  if (!section) return;

  function apiBase() {
    if (window.FAM_API_BASE) return window.FAM_API_BASE.replace(/\/auth$/, '');
    // Same-origin default (frontend served by the same backend); overridable
    // via FAM_ENV.API_BASE for a separately-hosted static build.
    if (window.FAM_ENV && window.FAM_ENV.API_BASE) return window.FAM_ENV.API_BASE.replace(/\/$/, '');
    return '/api/v1';
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inr(n) {
    var num = Number(n);
    if (isNaN(num)) return '\u20B9' + (n || '');
    return '\u20B9' + num.toLocaleString('en-IN');
  }

  var ICONS = {
    'Wi-Fi': 'wifi', 'Mountain View': 'landscape', 'King Bed': 'king_bed',
    'Queen Bed': 'king_bed', 'Private Balcony': 'balcony', 'Living Room': 'living',
    'Heater': 'local_fire_department', 'Hot Water': 'water_drop', 'Premium Toiletries': 'spa',
    'Skylight': 'light_mode', 'Attic Charm': 'roofing', 'Sunrise View': 'wb_sunny',
    'Duplex Layout': 'staircase', 'Forest View': 'forest', 'Reading Nook': 'menu_book',
    'Compact Design': 'space_dashboard', 'Garden Access': 'yard', 'Workspace': 'desk',
    'Natural Light': 'sunny', 'Coffee': 'coffee', 'Parking': 'local_parking',
    'Room Service': 'room_service', 'Private Bathroom': 'bathtub', 'Heating': 'thermostat',
    'Bonfire': 'local_fire_department', 'Attached Bath': 'bathtub',
    'Tea/Coffee': 'coffee', 'Valley View': 'landscape', 'Sunrise': 'wb_sunny',
  };

  function iconFor(a) { return ICONS[a] || 'check_circle'; }

  function isDown(r) {
    return r && (r.status === 'maintenance' || r.status === 'out_of_service' || r.isAvailable === false);
  }

  function chipHtml(label) {
    return '<div class="bg-surface/90 backdrop-blur-md rounded-full py-2 px-4 flex items-center gap-2 shrink-0 border border-outline-variant/30">' +
      '<span class="material-symbols-outlined text-primary text-lg">' + iconFor(label) + '</span>' +
      '<span class="font-label-sm text-on-surface text-xs">' + esc(label) + '</span></div>';
  }

  function luxuryBadges(room) {
    return (room.amenities || []).slice(0, 4).map(function (a) {
      return '<span class="luxury-badge text-xs"><span class="material-symbols-outlined text-accent-gold text-sm">' + iconFor(a) + '</span> ' + esc(a) + '</span>';
    }).join('');
  }

  function badgeRowHtml(room) {
    return '<div class="flex items-center gap-3 mb-6">' +
      '<span class="font-label-sm text-on-surface-variant bg-surface-container py-1 px-3 rounded-full text-xs">' + (room.capacity ? room.capacity.maxGuests : 2) + ' Guests</span>' +
      '<span class="font-label-sm text-on-surface-variant bg-surface-container py-1 px-3 rounded-full text-xs">' + inr(room.discountPrice || room.pricePerNight) + ' / night (incl.&nbsp;GST)</span>' +
      '</div>';
  }

  function buildArticle(room, index) {
    var slug = room.slug || String(index);
    var reverse = index % 2 === 1;
    var image = '<div class="w-full lg:w-3/5 h-[500px] relative rounded-3xl overflow-hidden shadow-2xl">' +
      '<div data-fam-slideshow="' + slug + '" class="absolute inset-0"></div>' +
      '<div class="absolute bottom-6 left-6 right-6 z-10 flex gap-4 overflow-x-auto scrollbar-hide">' +
      (room.amenities || []).slice(0, 3).map(chipHtml).join('') +
      '</div>' +
      (isDown(room) ? '<div class="fam-live-down-flag">Out of Service</div>' : '') +
      '</div>';

    var content = '<div class="w-full lg:w-2/5 flex flex-col items-start text-left">' +
      badgeRowHtml(room) +
      '<h2 class="font-headline-lg text-4xl md:text-5xl text-on-surface mb-2">' + esc(room.name) + '</h2>' +
      '<p class="font-headline-md text-2xl text-primary/70 italic mb-6">' + esc(room.type || 'Room') + '</p>' +
      '<p class="font-body-lg text-body-lg text-on-surface-variant mb-8">' + esc(room.shortDescription || room.description || '') + '</p>' +
      '<div class="flex flex-wrap gap-3 mb-8">' + luxuryBadges(room) + '</div>' +
      '<div class="flex gap-4">' +
      (isDown(room)
        ? '<a href="#" class="btn-primary fam-live-book-off" aria-label="' + esc(room.name) + ' unavailable" aria-disabled="true">Unavailable</a>'
        : '<a href="booking.html?room=' + slug + '" class="btn-primary" aria-label="Book ' + esc(room.name) + '">Book Now</a>') +
      '<a href="#' + slug + '" class="btn-secondary" aria-label="View ' + esc(room.name) + ' details">View Details</a>' +
      '</div>' +
      '</div>';

    return '<article id="' + slug + '" data-room-slug="' + slug + '" class="' +
      (reverse ? 'flex flex-col-reverse lg:flex-row' : 'flex flex-col lg:flex-row') +
      ' items-center gap-16 reveal">' +
      (reverse ? content + image : image + content) +
      '</article>';
  }

  // Update an existing static block in place.
  function overlayExisting(article, room) {
    var guests = article.querySelector('.flex.items-center.gap-3.mb-6 > span:first-child');
    var price = article.querySelector('.flex.items-center.gap-3.mb-6 > span:nth-child(2)');
    var desc = article.querySelector('p.font-body-lg.text-body-lg');
    var badgesWrap = article.querySelector('.flex.flex-wrap.gap-3.mb-8');
    var book = article.querySelector('a[href*="booking.html?room="]');

    if (guests && room.capacity && room.capacity.maxGuests) {
      guests.textContent = room.capacity.maxGuests + ' Guests';
    }
    if (price && (room.discountPrice || room.pricePerNight)) {
      price.innerHTML = inr(room.discountPrice || room.pricePerNight) + ' / night (incl.&nbsp;GST)';
    }
    if (desc && (room.shortDescription || room.description)) {
      desc.textContent = room.shortDescription || room.description;
    }
    if (badgesWrap && room.amenities && room.amenities.length) {
      badgesWrap.innerHTML = luxuryBadges(room);
    }
    if (book) {
      if (isDown(room)) {
        book.classList.add('fam-live-book-off');
        book.setAttribute('aria-disabled', 'true');
        book.setAttribute('href', '#');
        book.textContent = 'Unavailable';
      } else {
        book.classList.remove('fam-live-book-off');
        book.removeAttribute('aria-disabled');
        book.setAttribute('href', 'booking.html?room=' + room.slug);
        book.textContent = 'Book Now';
      }
    }
    if (isDown(room)) {
      var imgWrap = article.querySelector('.relative.rounded-3xl.overflow-hidden');
      if (imgWrap && !imgWrap.querySelector('.fam-live-down-flag')) {
        var flag = document.createElement('div');
        flag.className = 'fam-live-down-flag';
        flag.textContent = 'Out of Service';
        imgWrap.appendChild(flag);
      }
    }
  }

  var LIVE_STYLES =
    '.fam-live-down-flag{position:absolute;top:20px;left:20px;z-index:12;background:rgba(74,18,18,.86);color:#fff;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:8px 14px;border-radius:999px;backdrop-filter:blur(6px)}' +
    'a.fam-live-book-off{pointer-events:none;opacity:.5;filter:grayscale(.5)}';
  var styleEl = document.createElement('style');
  styleEl.textContent = LIVE_STYLES;
  document.head.appendChild(styleEl);

  function apply(rooms) {
    var bySlug = {};
    rooms.forEach(function (r) { if (r && r.slug) bySlug[r.slug] = r; });

    var existing = [].slice.call(section.querySelectorAll('article[data-room-slug]'));
    var matchedRows = [];

    existing.forEach(function (article) {
      var slug = article.getAttribute('data-room-slug');
      var room = bySlug[slug];
      if (!room) {
        // Deleted/removed in admin — remove the stale static block.
        article.parentNode.removeChild(article);
        return;
      }
      overlayExisting(article, room);
      matchedRows.push({ slug: slug, room: room });
    });

    // Append DB rooms that have no static block yet.
    var appended = 0;
    rooms.forEach(function (room) {
      if (!room || !room.slug) return;
      if (section.querySelector('article[data-room-slug="' + room.slug + '"]')) return;
      var holder = document.createElement('div');
      holder.innerHTML = buildArticle(room, matchedRows.length + appended);
      var article = holder.firstChild;
      section.appendChild(article);
      appended++;
      // Initialize the slideshow for the new block (static ones already ran).
      var ss = article.querySelector('[data-fam-slideshow]');
      if (ss && window.FAMSlideshow && FAMSlideshow.init) FAMSlideshow.init(ss, room.slug);
    });

    // Arm the scroll-reveal observer for newly appended blocks.
    if (window.FAM && FAM.Animations && FAM.Animations.initReveal) FAM.Animations.initReveal();

    // Re-arm the availability bar so appended rooms join the checks.
    if (window.FAMAvailBar && FAMAvailBar.reinit) FAMAvailBar.reinit();
  }

  function init() {
    fetch(apiBase() + '/rooms?limit=100')
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (json) {
        var rooms = json && json.data && json.data.rooms;
        if (!Array.isArray(rooms)) return; // backend unavailable — keep static page
        apply(rooms);
      })
      .catch(function () { /* keep static page */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
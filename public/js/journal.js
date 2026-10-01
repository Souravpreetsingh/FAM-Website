/* ============================================================================
   FAM JOURNAL - category filtering
   ----------------------------------------------------------------------------
   Progressive enhancement only. Every article is present and visible in the
   HTML; this script adds filtering on top. With JS disabled the grid still
   renders the full set, so nothing is hidden behind an interaction.
   ========================================================================== */

(function () {
  'use strict';

  function plural(n) {
    return n === 1 ? '1 story' : `${n} stories`;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.journal-filters');
    var grid = document.getElementById('journal-grid');
    var featuredSection = document.getElementById('journal-featured-section');
    var empty = document.getElementById('journal-empty');
    var count = document.getElementById('journal-count');
    if (!bar || !grid) return;

    var buttons = Array.prototype.slice.call(bar.querySelectorAll('.journal-filter'));
    // The featured card lives outside the grid, so collect from the whole page
    // to keep one consistent count. Without this it would stay visible under
    // a filter while the counter said otherwise.
    var cards = Array.prototype.slice.call(document.querySelectorAll('.journal-card[data-category]'));

    function apply(category) {
      var shown = 0;

      cards.forEach(function (el) {
        var match = category === 'All' || el.getAttribute('data-category') === category;
        el.hidden = !match;
        if (match) shown += 1;
      });

      // Hide the whole Featured block when its card is filtered out, so the
      // heading never sits above an empty area.
      if (featuredSection) {
        var featuredCard = featuredSection.querySelector('.journal-card');
        featuredSection.hidden = !(featuredCard && !featuredCard.hidden);
      }

      buttons.forEach(function (btn) {
        var active = btn.getAttribute('data-filter') === category;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      if (count) count.textContent = plural(shown);
      if (empty) empty.hidden = shown !== 0;
    }

    bar.addEventListener('click', function (event) {
      var btn = event.target.closest('.journal-filter');
      if (!btn) return;
      apply(btn.getAttribute('data-filter'));
    });

    // Left / right arrows move between filters, as expected of a tab row.
    bar.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      var index = buttons.indexOf(document.activeElement);
      if (index === -1) return;

      event.preventDefault();
      var next = event.key === 'ArrowRight'
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    });

    // Respect a ?category= deep link coming from another page.
    var requested = new URLSearchParams(window.location.search).get('category');
    if (requested && buttons.some(function (b) { return b.getAttribute('data-filter') === requested; })) {
      apply(requested);
    }
  });
})();
#!/usr/bin/env node
/* ============================================================================
   FAM JOURNAL - static site generator
   ----------------------------------------------------------------------------
   Reads backend/scripts/journalData.js and writes:
     public/pages/blog.html         (landing / category index)
     public/pages/blog/<slug>.html  (one page per article)

   Run:  node backend/scripts/buildJournal.js

   Output is committed plain HTML with no runtime dependency on this script,
   so the pages keep working if the data layer is ever replaced.

   Only PUBLISHED articles are written. An article is published unless it is a
   draft or has been soft deleted, so the starter content keeps building with no
   lifecycle fields present at all.

   The module is importable (main() only runs when invoked directly) so the admin
   preview endpoint reuses these exact renderers instead of duplicating markup.
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const { CATEGORIES, LANDING_HERO, ARTICLES } = require('./journalData');

const SITE = 'https://flamingoaurmaina.com';
const ROOT = path.join(__dirname, '..', '..', 'public');
const PAGES = path.join(ROOT, 'pages');
const BLOG_DIR = path.join(PAGES, 'blog');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/* ---------------------------------------------------------------- helpers */

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function metaText(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return esc(clean.length > 158 ? `${clean.slice(0, 155).trim()}…` : clean);
}

function up(prefix) {
  return prefix === 1 ? '../' : '../../';
}

function rel(prefix, file) {
  return `${up(prefix)}${file}`;
}

function absoluteUrl(file) {
  return `${SITE}/${file}`;
}

/* ------------------------------------------------------------ publication */

/* Drafts and soft-deleted articles are invisible to the public site: they are
   not written as pages, not counted on the landing page, not listed as related
   reading and not added to the sitemap. An article with no lifecycle fields is
   published, which is what the original starter data has. */
function isPublished(article) {
  return article.status !== 'draft' && !article.deletedAt;
}

const PUBLISHED = ARTICLES.filter(isPublished);

/* ------------------------------------------------------------------- head */

function head({ title, description, canonical, ogImage, jsonLd, prefix, noindex }) {
  const css = up(prefix);
  // Preview pages are reachable only with an admin session, but they must also
  // ask crawlers to stay away in case a preview URL is ever shared.
  // Empty when indexing is allowed, so published output stays byte-identical.
  const robots = noindex
    ? '\n  <meta name="robots" content="noindex, nofollow" />' +
      '\n  <meta name="googlebot" content="noindex, nofollow" />'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <style>#pt-overlay{position:fixed;inset:0;z-index:99999;pointer-events:none;background:var(--mode-bg,#f9faf5);opacity:1;transition:opacity .5s cubic-bezier(.65,0,.35,1)}</style>
  <meta charset="utf-8" />
  <script>try{var m=localStorage.getItem('fam-seasonal-mode');if(m==='winter'){document.documentElement.classList.add('mode-winter')}else if(m==='green'){document.documentElement.classList.add('mode-green')}}catch(e){}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${metaText(description)}" />${robots}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <title>${esc(title)}</title>
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${metaText(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${metaText(description)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <script type="application/ld+json">
  ${JSON.stringify(jsonLd, null, 2)}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${css}css/style.css?v=24" />
  <link rel="stylesheet" href="${css}css/transitions.css?v=3" />
  <link rel="stylesheet" href="${css}css/journal.css?v=2" />
  <style>
    body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f4ec; color: #1a1c1a; }
    img { max-width: 100%; height: auto; }
    #main-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; margin: 8px 8px 0; border-radius: 9999px; background: rgba(248,244,236,0.8); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border: 1px solid rgba(193,200,192,0.2); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    #main-nav > div { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 8px 12px; max-width: 1400px; margin: 0 auto; }
    #main-nav .nav-brand { font-family: 'Playfair Display', Georgia, serif; font-size: 14px; color: #0a341d; text-decoration: none; white-space: nowrap; }
    #main-nav .nav-desktop { display: none; }
    #main-nav .nav-mobile-actions { display: flex; align-items: center; gap: 8px; }
    #main-nav .nav-hamburger { background: none; border: none; padding: 8px; color: #0a341d; cursor: pointer; display: flex; align-items: center; }
    @media (min-width: 1024px) { #main-nav { margin: 8px 16px 0; } #main-nav > div { padding: 16px 64px; } #main-nav .nav-brand { font-size: 32px; } #main-nav .nav-desktop { display: flex; align-items: center; gap: 32px; } #main-nav .nav-mobile-actions { display: none; } }
    .skip-link { position: absolute; left: -9999px; z-index: 999; padding: 8px 16px; background: #0a341d; color: #fff; text-decoration: none; }
    .skip-link:focus { left: 8px; top: 8px; }
  .img-fallback { background: #e8e8e4; min-height: 100px; display: flex; align-items: center; justify-content: center; color: #727972; font-family: Inter, sans-serif; font-size: 13px; }
</style>
  <script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('img').forEach(function(i){i.onerror=function(){this.onerror=null;this.style.display='none';var p=this.parentElement;if(p){var f=document.createElement('div');f.className='img-fallback';f.textContent='Image unavailable';p.appendChild(f)}}})})</script>
</head>`;
}

/* -------------------------------------------------------------------- nav */

const NAV_ITEMS = [
  { key: 'home', label: 'Home', file: 'index.html' },
  { key: 'rooms', label: 'Rooms', file: 'pages/rooms.html' },
  { key: 'life', label: 'Life at FAM', file: 'pages/life.html' },
  { key: 'explore', label: 'Explore', file: 'pages/explore.html' },
  { key: 'gallery', label: 'Gallery', file: 'pages/gallery.html' },
  { key: 'amenities', label: 'Amenities', file: 'pages/amenities.html' },
  { key: 'journal', label: 'Journal', file: 'pages/blog.html' }
];

function linkClasses(active) {
  return active
    ? 'font-label-sm text-label-sm uppercase tracking-widest text-primary border-b border-primary/30 pb-1'
    : 'font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant hover:text-accent-gold transition-colors';
}

function nav(prefix, current) {
  const items = NAV_ITEMS.map((item) => {
    const active = item.key === current;
    const currentAttr = active ? ' aria-current="page"' : '';
    return `        <a href="${rel(prefix, item.file)}" class="${linkClasses(active)}"${currentAttr}>${item.label}</a>`;
  }).join('\n');

  return `  <nav id="main-nav">
    <div>
      <div class="flex items-center gap-2 md:gap-4">
        <a href="${rel(prefix, 'index.html')}" class="nav-brand">Flamingo aur Maina</a>
      </div>
      <div class="nav-desktop">
${items}
        <div class="flex items-center gap-3">
          <a href="${rel(prefix, 'pages/booking.html')}" class="nav-book-btn" aria-label="Book your stay at FAM">Book Your Stay</a>
        </div>
      </div>
      <div class="nav-mobile-actions">
        <button class="nav-hamburger" id="mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false"><svg class="hamburger-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      </div>
    </div>
  </nav>

  <div class="mobile-menu-overlay" id="mobile-overlay" aria-hidden="true"></div>
  <div class="mobile-menu-panel" id="mobile-panel" role="dialog" aria-modal="true" aria-label="Navigation menu">
    <div class="mobile-menu-header">
      <span class="font-headline-md text-xl text-primary">Menu</span>
      <button class="mobile-menu-close" id="mobile-close" aria-label="Close navigation menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <nav class="mobile-menu-links" aria-label="Mobile navigation">
${NAV_ITEMS.map((item) => `      <a href="${rel(prefix, item.file)}" class="mobile-menu-link"${item.key === current ? ' aria-current="page"' : ''}>${item.label}</a>`).join('\n')}
      <div class="mobile-menu-cta-group">
        <a href="${rel(prefix, 'pages/booking.html')}" class="nav-mobile-book">Book Your Stay</a>
      </div>
    </nav>
    <div class="mobile-menu-footer">
      <a href="tel:9876575673" class="mobile-menu-phone">
        <span class="material-symbols-outlined text-lg">phone</span>
        Property Manager: 98765 75673
      </a>
    </div>
  </div>
`;
}

/* ----------------------------------------------------------------- footer */

function footer(prefix) {
  const link = (file, label) =>
    `            <a href="${rel(prefix, file)}" class="text-on-primary/80 hover:text-accent-gold transition-colors text-sm">${label}</a>`;

  return `  <footer class="bg-charcoal text-on-primary">
    <div class="max-w-max-width mx-auto px-4 md:px-margin-desktop py-16">
      <div class="flex flex-col md:flex-row justify-between items-center md:items-start gap-12 border-b border-on-primary/10 pb-12">
        <div class="flex flex-col items-center md:items-start gap-4">
          <h3 class="font-headline-md text-2xl text-on-primary tracking-wider">Rasavana Foodtech Pvt Ltd</h3>
          <div class="text-on-primary/60 font-body-md max-w-xs text-center md:text-left leading-7">
            <p><strong>CIN:</strong> U56301CH2023PTC044930</p>
            <p><strong>GSTIN:</strong> 02AAMCR5053K1Z9</p>
          </div>
        </div>
        <div class="flex gap-16 text-center md:text-left">
          <div class="flex flex-col gap-4">
            <h4 class="font-label-sm uppercase tracking-widest text-on-primary/40 text-xs mb-2">Explore</h4>
${link('index.html', 'Home')}
${link('pages/rooms.html', 'Rooms')}
${link('pages/life.html', 'Life at FAM')}
${link('pages/explore.html', 'Explore')}
${link('pages/gallery.html', 'Gallery')}
${link('pages/blog.html', 'Journal')}
          </div>
          <div class="flex flex-col gap-4">
            <h4 class="font-label-sm uppercase tracking-widest text-on-primary/40 text-xs mb-2">Connect</h4>
${link('pages/amenities.html', 'Amenities')}
            <a href="${rel(prefix, 'index.html')}#contact" class="text-on-primary/80 hover:text-accent-gold transition-colors text-sm">Contact Us</a>
            <a href="https://www.instagram.com/flamingoaurmaina?igsh=ejFucDV1MWkzam5x" target="_blank" rel="noopener noreferrer" class="text-on-primary/80 hover:text-accent-gold transition-colors text-sm" aria-label="Visit Flamingo aur Maina on Instagram">Instagram</a>
          </div>
        </div>
      </div>
      <div class="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-on-primary/40 font-body-md">
        <p>&copy; 2026 Rasavana Foodtech Pvt Ltd. All rights reserved.</p>
        <div class="flex gap-6">
          <a href="#" class="hover:text-on-primary transition-colors" title="Page coming soon">Privacy Policy</a>
          <a href="#" class="hover:text-on-primary transition-colors" title="Page coming soon">Terms of Service</a>
        </div>
      </div>
    </div>
  </footer>
`;
}

/* ---------------------------------------------------------------- booking */

const BOOKING_MODAL = `  <div id="booking-modal" class="booking-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Book your stay">
    <div class="booking-modal-overlay"></div>
    <div class="booking-modal-panel">
      <div class="booking-modal-header">
        <span class="booking-modal-title">&#x1F4C5; Check Availability</span>
        <button class="booking-modal-close" id="booking-modal-close" aria-label="Close booking">&#x2715;</button>
      </div>
      <div class="booking-modal-body" id="booking-modal-body">
        <div class="booking-form">
          <div class="booking-field">
            <label class="booking-label" for="modal-checkin">Check-in</label>
            <input type="date" class="booking-input" id="modal-checkin" min="" />
          </div>
          <div class="booking-field">
            <label class="booking-label" for="modal-checkout">Check-out</label>
            <input type="date" class="booking-input" id="modal-checkout" min="" />
          </div>
          <div class="booking-field">
            <label class="booking-label">Guests</label>
            <div class="booking-guests">
              <button class="booking-guest-btn" id="modal-guest-minus" aria-label="Remove guest">&#x2212;</button>
              <span class="booking-guest-count" id="modal-guest-count">2</span>
              <button class="booking-guest-btn" id="modal-guest-plus" aria-label="Add guest">+</button>
            </div>
          </div>
          <button class="booking-cta" id="modal-booking-cta">Check Availability</button>
          <p class="booking-footer-text">Full room selection &amp; booking details in next step</p>
        </div>
      </div>
    </div>
  </div>
`;

/* --------------------------------------------------------------- fragments */

function scripts(prefix, extraJs) {
  const js = up(prefix);
  return `
  <script>try { var m = localStorage.getItem('fam-seasonal-mode'); if (m) { document.documentElement.setAttribute('data-seasonal', m); } } catch(e) {}</script>
${BOOKING_MODAL}
  <script src="${js}js/animations.js"></script>
  <script src="${js}js/seasonal.js"></script>
  <script src="${js}js/concierge.js?v=3"></script>
  <script src="${js}js/mobile-nav.js"></script>${extraJs ? `\n  <script src="${extraJs}"></script>` : ''}
  <script>
    function initJournalPage() {
      if (typeof FAM !== 'undefined' && FAM.Animations) {
        FAM.Animations.init({ gsap: false, lenis: false, cardParallax: false });
      }
    }
    document.addEventListener('DOMContentLoaded', initJournalPage);
    window.__pageInit = initJournalPage;
  </script>
  <script>document.querySelectorAll('footer p').forEach(function(p){p.innerHTML=p.innerHTML.replace('2024',new Date().getFullYear());});</script>
  <script src="${js}js/page-transitions.js"></script>
  <script src="/js/site-images.js?v=1" defer></script>
  <script src="/js/service-worker.js"></script>
  <script type="module" src="//instant.page/5.2.0"></script>
</body>
</html>
`;
}

function figure(image, eager) {
  return `      <figure class="journal-figure">
        <img src="${image.src}" alt="${esc(image.alt)}" width="${image.w}" height="${image.h}"${eager ? '' : ' loading="lazy" decoding="async"'} />
        <figcaption>${esc(image.caption)}</figcaption>
      </figure>`;
}

function bookingCta(prefix) {
  return `    <section class="journal-cta reveal">
      <div class="journal-cta-inner">
        <span class="font-label-sm text-accent-gold tracking-widest uppercase">Stay With Us</span>
        <h2 class="font-headline-lg text-4xl md:text-5xl text-primary mb-6">Read it once. Stay once.</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-xl mx-auto">Most of what is written about here is easier to judge from a room than from a screen.</p>
        <a href="${rel(prefix, 'pages/booking.html')}" class="btn-primary inline-flex items-center gap-2 text-base py-4 px-10">
          <span>View All Availability</span>
          <svg class="text-sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </section>`;
}

/* One link per card (the title), stretched over the whole card by CSS.
   The "Read the story" affordance is decorative only, so the accessible
   name stays equal to the headline instead of duplicating it. */
function card(article, prefix, featured) {
  const href = rel(prefix, `pages/blog/${article.slug}.html`);
  const cls = featured ? 'journal-card journal-card-featured reveal' : 'journal-card reveal';
  const body = featured ? article.excerpt : article.dek;
  return `        <article class="${cls}" data-category="${esc(article.category)}">
          <div class="journal-card-media">
            <img src="${article.hero.src}" alt="" width="${article.hero.w}" height="${article.hero.h}" loading="lazy" decoding="async" />
          </div>
          <div class="journal-card-body">
            <div class="journal-card-meta">
              <span class="journal-category">${esc(article.category)}</span>
              <span class="journal-dot" aria-hidden="true">&middot;</span>
              <time datetime="${article.date}">${prettyDate(article.date)}</time>
            </div>
            <h3 class="journal-card-title"><a href="${href}">${esc(article.title)}</a></h3>
            <p class="journal-card-excerpt">${esc(body)}</p>
            <span class="journal-card-more" aria-hidden="true">Read the story
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
          </div>
        </article>`;
}

/* ---------------------------------------------------------- landing page */

/* Nothing published yet is a legitimate state (everything is still a draft), so
   the landing page renders an empty-state hero instead of dereferencing a
   missing featured article. */
function buildLandingHtml() {
  const prefix = 1;
  const empty = PUBLISHED.length === 0;
  const canonical = absoluteUrl('pages/blog.html');
  const title = 'FAM Journal — Stories from Jibhi | Flamingo aur Maina';
  const description =
    'Stories, travel notes and mountain life from Flamingo aur Maina in Jibhi — the places worth walking to, the seasons worth timing, and the mornings worth slowing down for.';

  const featured = PUBLISHED.find((a) => a.featured) || PUBLISHED[0];
  const rest = PUBLISHED.filter((a) => a !== featured);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'FAM Journal',
    url: canonical,
    description,
    image: absoluteUrl(LANDING_HERO.src.replace(/^\//, '')),
    publisher: {
      '@type': 'Organization',
      name: 'Flamingo aur Maina',
      url: `${SITE}/`
    },
    blogPost: PUBLISHED.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: absoluteUrl(`pages/blog/${a.slug}.html`),
      datePublished: a.date,
      image: absoluteUrl(a.hero.src.replace(/^\//, '')),
      author: { '@type': 'Organization', name: 'FAM Journal' }
    }))
  };

  const filters = CATEGORIES.map((c, i) => {
    const active = i === 0;
    return `        <button type="button" class="journal-filter${active ? ' is-active' : ''}" data-filter="${esc(c)}" aria-pressed="${active}">${esc(c)}</button>`;
  }).join('\n');

  const html = `${head({
    title,
    description,
    canonical,
    ogImage: absoluteUrl(LANDING_HERO.src.replace(/^\//, '')),
    jsonLd,
    prefix
  })}
<body class="antialiased overflow-x-hidden bg-background text-on-surface">
<a href="#main-content" class="skip-link">Skip to main content</a>
<div id="pt-overlay" aria-hidden="true"></div>
${nav(prefix, 'journal')}
<div id="page-content">
  <main id="main-content" class="journal-landing-main">

    <section class="journal-hero">
      <img src="${LANDING_HERO.src}" alt="${esc(LANDING_HERO.alt)}" width="${LANDING_HERO.w}" height="${LANDING_HERO.h}" fetchpriority="high" decoding="async" />
      <div class="journal-hero-overlay"></div>
      <div class="journal-hero-content">
        <span class="font-label-sm text-accent-gold tracking-widest uppercase mb-4">The Journal</span>
        <h1 class="journal-hero-title">Words from the valley.</h1>
        <p class="journal-hero-dek">Stories about the mountains, the road to reach them, and the mornings that make the trip worth it.</p>
      </div>
    </section>

    <section class="max-w-max-width mx-auto px-4 md:px-margin-desktop py-section-gap">
      <div class="journal-filterbar">
        <div class="journal-filters" role="group" aria-label="Filter articles by category">
${filters}
        </div>
        <p class="journal-count" id="journal-count" role="status" aria-live="polite">${PUBLISHED.length} stories</p>
      </div>
    </section>

    <section class="journal-section max-w-max-width mx-auto px-4 md:px-margin-desktop" id="journal-featured-section"${empty ? ' hidden' : ''}>
      <h2 class="journal-section-title reveal">Featured</h2>
      <div class="journal-featured" id="journal-featured">
${card(featured, prefix, true)}
      </div>
    </section>

    <section class="journal-section max-w-max-width mx-auto px-4 md:px-margin-desktop pb-section-gap">
      <h2 class="journal-section-title reveal">Latest stories</h2>
      <div class="journal-grid" id="journal-grid">
${rest.map((a) => card(a, prefix, false)).join('\n')}
      </div>
      <p class="journal-empty" id="journal-empty"${empty ? '' : ' hidden'}>${empty ? 'No stories have been published yet.' : 'No stories in this category yet. Try another.'}</p>
    </section>

${bookingCta(prefix)}

  </main>
${footer(prefix)}
</div>
${scripts(prefix, `${up(prefix)}js/journal.js?v=1`)}
`;

  return html;
}

function renderLanding() {
  const html = buildLandingHtml();
  fs.writeFileSync(path.join(PAGES, 'blog.html'), html, 'utf8');
  return { file: 'public/pages/blog.html', count: 0 };
}

/* --------------------------------------------------------- article pages */

function related(article, count) {
  const same = PUBLISHED.filter((a) => a.slug !== article.slug && a.category === article.category);
  const others = PUBLISHED.filter(
    (a) => a.slug !== article.slug && a.category !== article.category
  );
  return same.concat(others).slice(0, count);
}

/* Pure: returns one article page as markup. noindex is only ever set for the
   admin preview of a draft, never for a generated public page. */
function buildArticleHtml(article, { noindex = false } = {}) {
  const prefix = 2;
  const canonical = absoluteUrl(`pages/blog/${article.slug}.html`);
  const title = `${article.title} | FAM Journal — Flamingo aur Maina`;
  const bodyLength = article.body.reduce((n, b) => n + b.text.split(/\s+/).length, 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.dek,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: article.date,
    dateModified: article.date,
    inLanguage: 'en',
    articleSection: article.category,
    wordCount: bodyLength,
    timeRequired: `PT${parseInt(article.readingTime, 10)}M`,
    image: [absoluteUrl(article.hero.src.replace(/^\//, ''))],
    author: { '@type': 'Organization', name: 'FAM Journal', url: `${SITE}/pages/blog.html` },
    publisher: {
      '@type': 'Organization',
      name: 'Flamingo aur Maina',
      url: `${SITE}/`
    }
  };

  const inline = article.inline || [];
  const total = article.body.length;
  const marks = new Set(inline.map((_, i) => Math.floor(((i + 1) * total) / (inline.length + 1))));
  let used = 0;
  const rendered = [];

  article.body.forEach((block, i) => {
    if (inline.length && marks.has(i) && used < inline.length) {
      rendered.push(figure(inline[used], false));
      used += 1;
    }
    if (block.type === 'h2') {
      rendered.push(`        <h2>${esc(block.text)}</h2>`);
    } else if (block.type === 'quote') {
      rendered.push(`        <blockquote><p>${esc(block.text)}</p></blockquote>`);
    } else {
      rendered.push(`        <p>${esc(block.text)}</p>`);
    }
  });
  while (used < inline.length) {
    rendered.push(figure(inline[used], false));
    used += 1;
  }

  const relatedItems = related(article, 3);

  const html = `${head({
    title,
    description: article.dek,
    canonical,
    ogImage: absoluteUrl(article.hero.src.replace(/^\//, '')),
    jsonLd,
    prefix,
    noindex
  })}
<body class="antialiased overflow-x-hidden bg-background text-on-surface">
<a href="#main-content" class="skip-link">Skip to main content</a>
<div id="pt-overlay" aria-hidden="true"></div>
${nav(prefix, 'journal')}
<div id="page-content">
  <main id="main-content" class="pt-24">

    <article class="journal-article">
      <nav class="journal-breadcrumb" aria-label="Breadcrumb">
        <a href="${rel(prefix, 'index.html')}">Home</a>
        <span aria-hidden="true">/</span>
        <a href="${rel(prefix, 'pages/blog.html')}">Journal</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${esc(article.category)}</span>
      </nav>

      <header class="journal-article-head">
        <span class="journal-category">${esc(article.category)}</span>
        <h1 class="journal-article-title">${esc(article.title)}</h1>
        <p class="journal-article-dek">${esc(article.dek)}</p>
        <div class="journal-article-meta">
          <span>FAM Journal</span>
          <span class="journal-dot" aria-hidden="true">&middot;</span>
          <time datetime="${article.date}">${prettyDate(article.date)}</time>
          <span class="journal-dot" aria-hidden="true">&middot;</span>
          <span>${esc(article.readingTime)}</span>
        </div>
      </header>

      <figure class="journal-hero-figure">
        <img src="${article.hero.src}" alt="${esc(article.hero.alt)}" width="${article.hero.w}" height="${article.hero.h}" fetchpriority="high" decoding="async" />
        <figcaption>${esc(article.hero.caption)}</figcaption>
      </figure>

      <div class="journal-prose">
${rendered.join('\n')}
      </div>

      <footer class="journal-article-foot">
        <a href="${rel(prefix, 'pages/blog.html')}" class="journal-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to all stories
        </a>
      </footer>
    </article>

    <section class="journal-section max-w-max-width mx-auto px-4 md:px-margin-desktop pb-section-gap">
      <h2 class="journal-section-title reveal">Keep reading</h2>
      <div class="journal-grid journal-grid-related">
${relatedItems.map((a) => card(a, prefix, false)).join('\n')}
      </div>
    </section>

${bookingCta(prefix)}

  </main>
${footer(prefix)}
</div>
${scripts(prefix)}
`;

  return html;
}

function renderArticle(article) {
  const html = buildArticleHtml(article);
  const file = path.join(BLOG_DIR, `${article.slug}.html`);
  fs.writeFileSync(file, html, 'utf8');
  return { file: `public/pages/blog/${article.slug}.html`, count: null };
}

/* ---------------------------------------------------------------- sitemap */

const SITEMAP_START = '  <!-- FAM Journal: managed by backend/scripts/buildJournal.js -->';
const SITEMAP_END = '  <!-- /FAM Journal -->';

/* The Journal owns its own block inside public/sitemap.xml so the two cannot
   drift. Everything outside the markers is left untouched. */
function updateSitemap() {
  const file = path.join(ROOT, 'sitemap.xml');
  if (!fs.existsSync(file)) {
    console.warn('  ! public/sitemap.xml not found - skipped');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    `  <url><loc>${absoluteUrl('pages/blog.html')}</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`,
    ...PUBLISHED.map(
      (a) =>
        `  <url><loc>${absoluteUrl(`pages/blog/${a.slug}.html`)}</loc>` +
        `<lastmod>${a.date}</lastmod><priority>0.6</priority></url>`
    )
  ];

  const block = [SITEMAP_START, ...rows, SITEMAP_END].join('\n');
  const xml = fs.readFileSync(file, 'utf8');

  let next;
  if (xml.includes(SITEMAP_START) && xml.includes(SITEMAP_END)) {
    next = xml.replace(
      new RegExp(`${SITEMAP_START}[\\s\\S]*?${SITEMAP_END}`),
      block
    );
  } else {
    next = xml.replace('</urlset>', `${block}\n</urlset>`);
  }

  if (next === xml) {
    console.log('  sitemap.xml already up to date');
    return;
  }
  fs.writeFileSync(file, next, 'utf8');
  console.log(`  public/sitemap.xml  (+${rows.length} Journal URLs)`);
}

/* ------------------------------------------------------------------- main */

function main() {
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  // Remove stale article pages from a previous run. This is what takes a
  // draft or a soft-deleted article back out of the public site.
  const keep = new Set(PUBLISHED.map((a) => `${a.slug}.html`));
  fs.readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.html') && !keep.has(f))
    .forEach((f) => fs.unlinkSync(path.join(BLOG_DIR, f)));

  const written = [renderLanding(), ...PUBLISHED.map(renderArticle)];
  updateSitemap();

  const categories = new Set();
  ARTICLES.forEach((a) => {
    if (isPublished(a)) categories.add(a.category);
  });
  const unknown = [...categories].filter((c) => !CATEGORIES.includes(c));
  if (unknown.length) {
    throw new Error(`Category not declared in CATEGORIES: ${unknown.join(', ')}`);
  }

  const draftCount = ARTICLES.length - PUBLISHED.length;
  const draftNote = draftCount ? `, ${draftCount} draft/hidden` : '';
  console.log(`FAM Journal: wrote ${written.length} files (${PUBLISHED.length} articles${draftNote})`);
  written.forEach((w) => console.log(`  ${w.file}`));
}

/* Exported so the admin preview endpoint renders drafts with the same markup as
   the public build, and so tests can assert on generation without shelling out. */
module.exports = {
  SITE,
  ROOT,
  PAGES,
  BLOG_DIR,
  CATEGORIES,
  LANDING_HERO,
  ARTICLES,
  PUBLISHED,
  isPublished,
  buildLandingHtml,
  buildArticleHtml,
  renderLanding,
  renderArticle,
  updateSitemap,
  main
};

if (require.main === module) {
  main();
}
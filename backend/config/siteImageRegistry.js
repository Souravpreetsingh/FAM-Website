// Single source of truth for every manageable public-site image.
//
// A key is a permanent address for one image slot. Keys are referenced by the
// public site (data-fam-img / data-fam-bg / data-fam-meta attributes and the
// window.FamImages helper) and by the admin Images view, so they must never be
// renamed. Only ever add new keys.
//
// Brand marks (favicon, social/payment/Google-Apple SVGs), Instagram embeds and
// Tailwind's generated data: URI textures are deliberately absent: they are not
// owner-managed photography and should not be swappable from this screen.

const OG_HERO = 'https://flamingoaurmaina.com/images/hero/luxury-hero.jpg';
const OG_HERO_BG = 'https://flamingoaurmaina.com/images/hero-bg.jpg';

const ROOM_COVERS = ['flamingo-1', 'flamingo-2', 'flamingo-3', 'maina-1', 'maina-2', 'maina-3'];

const ROOM_NAMES = {
  'flamingo-1': 'Flamingo 1',
  'flamingo-2': 'Flamingo 2',
  'flamingo-3': 'Flamingo 3',
  'maina-1': 'Maina 1',
  'maina-2': 'Maina 2',
  'maina-3': 'Maina 3',
};

// Folder + ordered file list per room. Order must stay identical to
// public/js/room-data.js: the famKey is positional ('rooms.<slug>.<n>'), so
// inserting or renumbering a file would silently repoint every stored admin
// override onto a different photograph. Only ever append.
const ROOM_PHOTOS = {
  'flamingo-1': ['01.jpg', '02.jpg', '03.jpg', '04.jpg'],
  'flamingo-2': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg'],
  'flamingo-3': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg'],
  'maina-1': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg'],
  'maina-2': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg'],
  'maina-3': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg'],
};

const EXPLORE_NAMES = {
  'jibhi-waterfall': 'Jibhi Waterfall',
  'jalori-pass': 'Jalori Pass',
  'serolsar-lake': 'Serolsar Lake',
  'chehni-kothi': 'Chehni Kothi',
  'mini-thailand': 'Mini Thailand',
  'tirthan-valley': 'Tirthan Valley',
  'great-himalayan-national-park': 'Great Himalayan National Park',
  'forest-trails': 'Forest Trails',
};

const EXPLORE_PHOTOS = {
  'jibhi-waterfall': ['01.jpeg', '02.jpeg', '03.jpeg', '04.jpeg', '05.jpeg', '06.jpeg'],
  'jalori-pass': ['01.jpeg', '02.jpeg', '03.jpeg', '04.jpeg'],
  'serolsar-lake': [
    '01.jpg', '02.jpg', '03.jpeg', '04.jpeg', '05.jpeg', '06.jpeg', '07.jpeg', '08.jpeg',
    '09.jpeg', '10.jpeg', '11.jpeg', '12.jpeg', '13.jpeg', '14.jpeg', '15.jpeg', '16.jpeg',
    '17.jpeg',
  ],
  'chehni-kothi': [
    '01.jpeg', '02.jpeg', '03.jpeg', '04.jpeg', '05.jpeg',
    '06.jpeg', '07.jpeg', '08.jpeg', '09.jpeg', '10.jpeg',
  ],
  'mini-thailand': ['01.jpeg', '02.jpeg', '03.jpeg', '04.jpeg', '05.jpeg', '06.jpeg'],
  'tirthan-valley': ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg'],
  'great-himalayan-national-park': ['01.jpeg', '02.jpeg', '03.jpeg', '04.jpeg'],
  'forest-trails': ['01.jpg', '02.jpg', '03.jpeg', '04.jpeg', '05.jpeg', '06.jpeg'],
};

const page = (id, title) => ({ id, title });
const img = (key, pageId, label, fallback, alt) => ({
  key, page: pageId, label, kind: 'img', fallback: fallback || '', alt: alt || '',
});
const bg = (key, pageId, label, fallback) => ({
  key, page: pageId, label, kind: 'bg', fallback: fallback || '',
});
const meta = (key, pageId, label, fallback) => ({
  key, page: pageId, label, kind: 'meta', fallback: fallback || '',
});

function buildPages() {
  const pages = [];

  // ---------------------------------------------------------------- Home ----
  const homeImages = [
    img('home.hero.poster', 'home', 'Hero video poster', '/images/hero/hero-video-poster.jpg'),
    img('home.story', 'home', '"A Journey Back Home" image', '/images/fam-big-pic.jpg',
      'Morning sunlight over Himalayan mountains from the property'),
    img('home.founders', 'home', 'Founders tea photo', '/images/founders-tea.jpg',
      'Founders enjoying tea on a wooden balcony overlooking mountains'),
    bg('home.parallax', 'home', '"Built Around Nature" background', '/images/parallax-dji.jpg'),
    img('home.paradise.left', 'home', 'Paradise portrait - left', 'images/paradise/paradise-left.jpg',
      'Mountain view from the left side of the retreat'),
    img('home.paradise.center', 'home', 'Paradise portrait - centre', 'images/paradise/paradise-center.jpg',
      'Centre view across the retreat'),
    img('home.paradise.right', 'home', 'Paradise portrait - right', 'images/paradise/paradise-right.jpg',
      'View from the right side of the retreat'),
    img('home.tripplanner', 'home', 'Trip planner section artwork', '/images/tp-bg-img6872.jpg'),
    bg('home.cta', 'home', 'CTA background ("Find Your Perfect Stay")', 'images/paradise/cta-bg.jpg'),
    meta('home.og', 'home', 'Social share image (og + Twitter + JSON-LD)', OG_HERO),
  ];
  pages.push({ ...page('home', 'Home'), images: homeImages });

  // ---------------------------------------------------------------- Life ----
  const lifeImages = [
    img('life.chapter.01', 'life', 'Chapter 1 - Wake Up Above The Clouds', '../images/life/chapter-01.jpg',
      'Cinematic morning fog'),
    img('life.chapter.02', 'life', 'Chapter 2', '../images/life/chapter-02.jpg',
      'Apple orchard walk'),
    img('life.chapter.03', 'life', 'Chapter 3 - Every Meal Feels Homemade', '../images/life/chapter-03.jpg',
      'Warm dining interior at FAM'),
    img('life.chapter.04', 'life', 'Chapter 4 - Evenings You\'ll Never Forget', '../images/life/chapter-04.jpg',
      'Bonfire night'),
    img('life.chapter.05', 'life', 'Chapter 5 - Work Where Others Vacation', '../images/life/chapter-05.jpg',
      'Remote work setup'),
    img('life.chapter.06', 'life', 'Chapter 6 - Explore Jibhi', '../images/life/chapter-06.jpg',
      'Jibhi exploration'),
    img('life.chapter.07', 'life', 'Chapter 7 - Stargazing', '../images/life/chapter-07.jpg',
      'Stargazing night'),
    meta('life.og', 'life', 'Social share image', OG_HERO_BG),
  ];
  pages.push({ ...page('life', 'Life at FAM'), images: lifeImages });

  // ------------------------------------------------------------- Explore ----
  const exploreImages = [meta('explore.og', 'explore', 'Social share image', OG_HERO_BG)];
  Object.keys(EXPLORE_PHOTOS).forEach(function (dest) {
    exploreImages.push(img(
      'explore.' + dest + '.cover',
      'explore',
      EXPLORE_NAMES[dest] + ' - card cover',
      '../images/explore/' + dest + '/' + EXPLORE_PHOTOS[dest][0]
    ));
    EXPLORE_PHOTOS[dest].forEach(function (file, i) {
      exploreImages.push(img(
        'explore.' + dest + '.' + (i + 1),
        'explore',
        EXPLORE_NAMES[dest] + ' - slideshow photo ' + (i + 1) + ' of ' + EXPLORE_PHOTOS[dest].length,
        '../images/explore/' + dest + '/' + file
      ));
    });
  });
  pages.push({ ...page('explore', 'Explore'), images: exploreImages });

  // --------------------------------------------------------------- Rooms ----
  const roomImages = [meta('rooms.og', 'rooms', 'Social share image (og + Twitter + JSON-LD)', OG_HERO_BG)];
  ROOM_COVERS.forEach(function (roomId) {
    const name = ROOM_NAMES[roomId];
    const photos = ROOM_PHOTOS[roomId] || [];
    roomImages.push(img(
      'rooms.' + roomId + '.cover',
      'rooms',
      name + ' - booking card cover',
      photos.length ? '../images/rooms/' + roomId + '/' + photos[0] : ''
    ));
    photos.forEach(function (file, i) {
      roomImages.push(img(
        'rooms.' + roomId + '.' + (i + 1),
        'rooms',
        name + ' - slideshow photo ' + (i + 1) + ' of ' + photos.length,
        '../images/rooms/' + roomId + '/' + file
      ));
    });
  });
  roomImages.push(bg('rooms.cta', 'rooms', 'Rooms CTA background',
    '/images/rooms/rooms-cta.jpg'));
  pages.push({ ...page('rooms', 'Rooms'), images: roomImages });

  // ----------------------------------------------------------- Amenities ----
  pages.push({
    ...page('amenities', 'Amenities'),
    images: [
      bg('amenities.hero', 'amenities', 'Page background',
        '/images/amenities/amenities-hero.jpg'),
      meta('amenities.og', 'amenities', 'Social share image', OG_HERO_BG),
    ],
  });

  // -------------------------------------------------------------- Booking ----
  pages.push({
    ...page('booking', 'Booking'),
    images: [
      img('booking.hero.poster', 'booking', 'Booking hero video poster', '/images/hero/hero-video-poster.jpg'),
      meta('booking.og', 'booking', 'Social share image', OG_HERO),
    ],
  });

  // ------------------------------------------------- Auth & shared pages ----
  pages.push({
    ...page('gallery', 'Gallery'),
    images: [meta('gallery.og', 'gallery', 'Social share image', OG_HERO_BG)],
  });

  const authHero = img('auth.hero', 'auth', 'Login + Signup hero background',
    '../images/hero/luxury-hero.jpg');
  pages.push({
    ...page('auth', 'Login & Signup'),
    images: [
      authHero,
      meta('login.og', 'auth', 'Login page social share image', OG_HERO),
      meta('signup.og', 'auth', 'Signup page social share image', OG_HERO),
      meta('forgot.og', 'auth', 'Forgot password social share image', OG_HERO),
      meta('reset.og', 'auth', 'Reset password social share image', OG_HERO),
      meta('verify.og', 'auth', 'Verify email social share image', OG_HERO),
      meta('verified.og', 'auth', 'Email verified social share image', OG_HERO),
    ],
  });

  pages.push({
    ...page('notfound', '404 page'),
    images: [
      meta('notfound.og', 'notfound', 'Social share image', OG_HERO),
    ],
  });

  // Shared by the concierge widget on 5 pages.
  pages.push({
    ...page('concierge', 'Concierge widget'),
    images: [
      bg('concierge.attraction', 'concierge', 'Attraction card thumbnail',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=80&h=80&fit=crop&q=60'),
    ],
  });

  return pages;
}

const PAGES = buildPages();

const ALL_IMAGES = PAGES.reduce(function (acc, p) {
  return acc.concat(p.images);
}, []);

const PAGE_BY_ID = PAGES.reduce(function (acc, p) {
  acc[p.id] = p;
  return acc;
}, {});

module.exports = {
  PAGES,
  ALL_IMAGES,
  PAGE_BY_ID,
  ROOM_COVERS,
  EXPLORE_NAMES,
};

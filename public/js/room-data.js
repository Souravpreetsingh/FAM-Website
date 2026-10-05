/**
 * FAM Room Photo Data — Single source of truth
 * All image paths are relative to the public/ root.
 * Each page resolves the correct base path when loading.
 *
 * To add photos: place .jpg files in the appropriate folder
 * and add the filename to the array below.
 */
var FAM_ROOM_PHOTOS = {
  'flamingo-1': {
    folder: '/images/rooms/flamingo-1',
    photos: [
      { file: '01.jpg', alt: 'Flamingo 1 luxury duplex room interior at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Flamingo 1 bedroom with mountain views at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Flamingo 1 wooden interiors and living space at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Flamingo 1 private sit-out area overlooking the mountains' }
    ]
  },
  'flamingo-2': {
    folder: '/images/rooms/flamingo-2',
    photos: [
      { file: '01.jpg', alt: 'Flamingo 2 king attic room with skylight at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Flamingo 2 cozy attic bedroom interior at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Flamingo 2 vaulted ceiling and wooden architecture at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Flamingo 2 charming room with mountain views at Flamingo aur Maina' },
      { file: '05.jpg', alt: 'Flamingo 2 warm lighting and cozy atmosphere at Flamingo aur Maina' },
      { file: '06.jpg', alt: 'Flamingo 2 bedroom detail with rustic decor at Flamingo aur Maina' },
      { file: '07.jpg', alt: 'Flamingo 2 skylight view from the attic room at Flamingo aur Maina' },
      { file: '08.jpg', alt: 'Flamingo 2 room overview with king bed at Flamingo aur Maina' }
    ]
  },
  'flamingo-3': {
    folder: '/images/rooms/flamingo-3',
    photos: [
      { file: '01.jpg', alt: 'Flamingo 3 duplex room with garden access at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Flamingo 3 spacious living area at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Flamingo 3 Himalayan sunrise view from the room at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Flamingo 3 elegant interiors and premium comforts at Flamingo aur Maina' },
      { file: '05.jpg', alt: 'Flamingo 3 duplex layout with two levels at Flamingo aur Maina' }
    ]
  },
  'maina-1': {
    folder: '/images/rooms/maina-1',
    photos: [
      { file: '01.jpg', alt: 'Maina 1 room interior with natural light at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Maina 1 bedroom and seating area at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Maina 1 wooden interiors and warm decor at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Maina 1 comfortable bed and reading space at Flamingo aur Maina' },
      { file: '05.jpg', alt: 'Maina 1 room overview with mountain light at Flamingo aur Maina' }
    ]
  },
  'maina-2': {
    folder: '/images/rooms/maina-2',
    photos: [
      { file: '01.jpg', alt: 'Maina 2 room interior at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Maina 2 bedroom with bright natural light at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Maina 2 warm wooden decor and cosy atmosphere at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Maina 2 comfortable seating and bed layout at Flamingo aur Maina' },
      { file: '05.jpg', alt: 'Maina 2 private room overview at Flamingo aur Maina' }
    ]
  },
  'maina-3': {
    folder: '/images/rooms/maina-3',
    photos: [
      { file: '01.jpg', alt: 'Maina 3 private room with wooden interiors at Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Maina 3 cozy room with garden access at Flamingo aur Maina' },
      { file: '03.jpg', alt: 'Maina 3 warm wooden decor and modern cosiness at Flamingo aur Maina' },
      { file: '04.jpg', alt: 'Maina 3 comfortable queen bed at Flamingo aur Maina' },
      { file: '05.jpg', alt: 'Maina 3 bright and airy room interior at Flamingo aur Maina' },
      { file: '06.jpg', alt: 'Maina 3 attached bathroom at Flamingo aur Maina' },
      { file: '07.jpg', alt: 'Maina 3 room detail with natural light at Flamingo aur Maina' },
      { file: '08.jpg', alt: 'Maina 3 charming private room overview at Flamingo aur Maina' }
    ]
  }
};

/**
 * Get the full photo list for a room.
 *
 * Each photo carries a stable `famKey` so the admin Images view can replace any
 * single frame, and `src`/`alt` are routed through FamImages so a replacement
 * made in the admin shows up without a rebuild. FamImages falls back to the
 * hard-coded value when nothing is overridden, so the site is unchanged unless
 * the owner actually swaps something.
 *
 * @param {string} roomId - e.g. 'flamingo-1'
 * @param {string} basePath - resolved base path, e.g. '/' or '../'
 * @returns {Array<{src: string, alt: string, famKey: string}>}
 */
function FAMGetRoomPhotos(roomId, basePath) {
  var room = FAM_ROOM_PHOTOS[roomId];
  if (!room || !room.photos || room.photos.length === 0) return [];
  var base = basePath || '/';
  if (base.charAt(base.length - 1) !== '/') base += '/';
  var famImages = window.FamImages;
  return room.photos.map(function(p, i) {
    var fallback = base + room.folder.substring(1) + '/' + p.file;
    var famKey = 'rooms.' + roomId + '.' + (i + 1);
    return {
      src: famImages ? famImages.url(famKey, fallback) : fallback,
      alt: famImages ? famImages.alt(famKey, p.alt) : p.alt,
      famKey: famKey,
      fallback: fallback,
    };
  });
}

/**
 * Get the first photo for a room (used in cards/previews).
 */
function FAMGetRoomFirstPhoto(roomId, basePath) {
  var photos = FAMGetRoomPhotos(roomId, basePath);
  return photos.length > 0 ? photos[0] : null;
}

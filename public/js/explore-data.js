/**
 * FAM Explore Photo Data — Single source of truth
 * All image paths are relative to the public/ root.
 * Each page resolves the correct base path when loading.
 *
 * To add photos: place image files in the appropriate folder
 * and add the filename to the array below.
 */
var FAM_EXPLORE_PHOTOS = {
  'jibhi-waterfall': {
    folder: '/images/explore/jibhi-waterfall',
    photos: [
      { file: '01.jpeg', alt: 'Jibhi Waterfall cascading through lush forest near Flamingo aur Maina' },
      { file: '02.jpeg', alt: 'Jibhi Waterfall stream and rocky path in the Himalayan foothills' },
      { file: '03.jpeg', alt: 'Jibhi Waterfall surrounded by dense pine and deodar trees' },
      { file: '04.jpeg', alt: 'Jibhi Waterfall close-up of rushing water over mossy rocks' },
      { file: '05.jpeg', alt: 'Jibhi Waterfall scenic village trail leading to the falls' },
      { file: '06.jpeg', alt: 'Jibhi Waterfall panoramic view of the cascade in monsoon' }
    ]
  },
  'jalori-pass': {
    folder: '/images/explore/jalori-pass',
    photos: [
      { file: '01.jpeg', alt: 'Jalori Pass mountain landscape with sweeping Himalayan views' },
      { file: '02.jpeg', alt: 'Jalori Pass road winding through high-altitude terrain' },
      { file: '03.jpeg', alt: 'Jalori Pass panoramic ridge overlooking deep valleys' },
      { file: '04.jpeg', alt: 'Jalori Pass snow-dusted peaks and alpine meadows' }
    ]
  },
  'serolsar-lake': {
    folder: '/images/explore/serolsar-lake',
    photos: [
      { file: '01.jpg', alt: 'Serolsar Lake crystal-clear alpine waters reflecting the Himalayas' },
      { file: '02.jpg', alt: 'Serolsar Lake serene landscape surrounded by oak forests' },
      { file: '03.jpeg', alt: 'Serolsar Lake trek trail through rhododendron forest' },
      { file: '04.jpeg', alt: 'Serolsar Lake mirror-like surface on a calm morning' },
      { file: '05.jpeg', alt: 'Serolsar Lake panoramic mountain backdrop in summer' },
      { file: '06.jpeg', alt: 'Serolsar Lake wooden bridge over the inlet stream' },
      { file: '07.jpeg', alt: 'Serolsar Lake dense forest canopy along the trek route' },
      { file: '08.jpeg', alt: 'Serolsar Lake peaceful shoreline with wildflowers' },
      { file: '09.jpeg', alt: 'Serolsar Lake misty morning atmosphere in the mountains' },
      { file: '10.jpeg', alt: 'Serolsar Lake clear water revealing stones beneath the surface' },
      { file: '11.jpeg', alt: 'Serolsar Lake trail through ancient oak trees' },
      { file: '12.jpeg', alt: 'Serolsar Lake wide-angle view of the alpine setting' },
      { file: '13.jpeg', alt: 'Serolsar Lake surrounded by towering Himalayan peaks' },
      { file: '14.jpeg', alt: 'Serolsar Lake nature trail with dappled sunlight' },
      { file: '15.jpeg', alt: 'Serolsar Lake pristine waters in the Great Himalayan landscape' },
      { file: '16.jpeg', alt: 'Serolsar Lake twilight reflections on the still water' },
      { file: '17.jpeg', alt: 'Serolsar Lake breathtaking mountain panorama from the lake' }
    ]
  },
  'chehni-kothi': {
    folder: '/images/explore/chehni-kothi',
    photos: [
      { file: '01.jpeg', alt: 'Chehni Kothi ancient tower with traditional Himachali architecture' },
      { file: '02.jpeg', alt: 'Chehni Kothi historic stone and wood structure in the village' },
      { file: '03.jpeg', alt: 'Chehni Kothi heritage building surrounded by mountain scenery' },
      { file: '04.jpeg', alt: 'Chehni Kothi tall tower against the Himalayan skyline' },
      { file: '05.jpeg', alt: 'Chehni Kothi village paths leading to the ancient structure' },
      { file: '06.jpeg', alt: 'Chehni Kothi traditional architecture detail and craftsmanship' },
      { file: '07.jpeg', alt: 'Chehni Kothi panoramic view of the heritage tower and village' },
      { file: '08.jpeg', alt: 'Chehni Kothi rustic charm of an ancient Himachali settlement' },
      { file: '09.jpeg', alt: 'Chehni Kothi towering structure with forest backdrop' },
      { file: '10.jpeg', alt: 'Chehni Kothi ancient tower illuminated by golden hour light' }
    ]
  },
  'mini-thailand': {
    folder: '/images/explore/mini-thailand',
    photos: [
      { file: '01.jpeg', alt: 'Mini Thailand crystal-blue river waters near Jibhi' },
      { file: '02.jpeg', alt: 'Mini Thailand boulders and clear water surrounded by pine trees' },
      { file: '03.jpeg', alt: 'Mini Thailand riverside paradise with emerald-green pools' },
      { file: '04.jpeg', alt: 'Mini Thailand peaceful rock pools perfect for a dip' },
      { file: '05.jpeg', alt: 'Mini Thailand hidden gem with turquoise Himalayan stream' },
      { file: '06.jpeg', alt: 'Mini Thailand scenic river bend with mountain backdrop' }
    ]
  },
  'tirthan-valley': {
    folder: '/images/explore/tirthan-valley',
    photos: [
      { file: '01.jpg', alt: 'Tirthan Valley overview with the river winding through green hills' },
      { file: '02.jpg', alt: 'Tirthan Valley pristine natural beauty in Himachal Pradesh' },
      { file: '03.jpg', alt: 'Tirthan Valley serene river flowing through the Himalayan landscape' },
      { file: '04.jpg', alt: 'Tirthan Valley lush green valley with mountain views' },
      { file: '05.jpg', alt: 'Tirthan Valley tranquil riverside surrounded by dense forests' }
    ]
  },
  'great-himalayan-national-park': {
    folder: '/images/explore/great-himalayan-national-park',
    photos: [
      { file: '01.jpeg', alt: 'Great Himalayan National Park alpine meadows with snow-capped peaks' },
      { file: '02.jpeg', alt: 'Great Himalayan National Park dense forest trail in the reserve' },
      { file: '03.jpeg', alt: 'Great Himalayan National Park breathtaking mountain vistas' },
      { file: '04.jpeg', alt: 'Great Himalayan National Park pristine wilderness and Himalayan flora' }
    ]
  },
  'forest-trails': {
    folder: '/images/explore/forest-trails',
    photos: [
      { file: '01.jpg', alt: 'Forest trails through ancient deodar trees near Flamingo aur Maina' },
      { file: '02.jpg', alt: 'Peaceful woods of Jibhi with towering pine trees' },
      { file: '03.jpeg', alt: 'Forest trail path with sunlight filtering through the canopy' },
      { file: '04.jpeg', alt: 'Deodar forest walk starting right from the property' },
      { file: '05.jpeg', alt: 'Forest trails winding through lush Himalayan woodland' },
      { file: '06.jpeg', alt: 'Forest trail with mossy ground and birdsong atmosphere' }
    ]
  }
};

/**
 * Get the full photo list for an explore destination.
 * @param {string} destinationId - e.g. 'jibhi-waterfall'
 * @param {string} basePath - resolved base path, e.g. '/' or '../'
 * @returns {Array<{src: string, alt: string}>}
 */
function FAMGetExplorePhotos(destinationId, basePath) {
  var dest = FAM_EXPLORE_PHOTOS[destinationId];
  if (!dest || !dest.photos || dest.photos.length === 0) return [];
  var base = basePath || '/';
  if (base.charAt(base.length - 1) !== '/') base += '/';
  return dest.photos.map(function(p) {
    return { src: base + dest.folder.substring(1) + '/' + p.file, alt: p.alt };
  });
}

/**
 * Get the first photo for an explore destination (used in cards/previews).
 */
function FAMGetExploreFirstPhoto(destinationId, basePath) {
  var photos = FAMGetExplorePhotos(destinationId, basePath);
  return photos.length > 0 ? photos[0] : null;
}

/* ============================================================================
   FAM JOURNAL - content data
   ----------------------------------------------------------------------------
   This is the single place real editorial content enters the Journal.

   Everything here is STARTER content: placeholder entries written to show the
   section working, not published journalism. Nothing below asserts awards,
   reviews, partnerships, staff identities, prices or events. Where a place is
   named, the description follows what the existing Explore page already states.

   TO PUBLISH REAL CONTENT: replace the strings below and run
       node scripts/buildJournal.js
   No HTML needs to be edited by hand.

   body block types:  p | h2 | quote
   inline photography is declared separately per article under `inline`.
   ========================================================================== */

const CATEGORIES = [
  'All',
  'Stories from Jibhi',
  'Travel & Explore',
  'Food & Café',
  'Mountain Life',
  'FAM Stories',
  'Local Culture'
];

/* Landing page hero. Reused from the existing image library - no duplicate
   asset created. */
const LANDING_HERO = {
  src: '/images/life/chapter-06.jpg',
  w: 1776,
  h: 999,
  alt: 'Morning light across the forested hills above Jibhi',
  caption: 'The hills above Jibhi, photographed in the first hour of light.'
};

const ARTICLES = [
  {
    slug: 'a-slower-morning-in-jibhi',
    title: 'A slower morning in Jibhi',
    dek: 'What happens when you stop negotiating with the clock for a single day in the valley.',
    category: 'Stories from Jibhi',
    date: '2026-09-24',
    readingTime: '6 min read',
    featured: true,
    excerpt:
      'There is a particular quality to a Jibhi morning before the road warms up: the light arrives sideways, the water carries a low sound, and nobody is asking you to be anywhere yet.',
    hero: {
      src: '/images/life/chapter-01.jpg',
      w: 2400,
      h: 1350,
      alt: 'Soft early light falling across a green Himalayan hillside',
      caption: 'The hour the valley sounds different.'
    },
    inline: [
      {
        src: '/images/founders-tea.jpg',
        w: 1200,
        h: 1600,
        alt: 'A poured cup of tea held in both hands',
        caption: 'First cup first. Everything else can wait ten minutes.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'Most mornings here begin with a decision that has nothing to do with breakfast. It is the decision about how fast to get out of the door. The default is fast, because the default everywhere else is fast. But the valley does not require it, and once you have spent a night listening to the water rather than the road, urgency starts to feel borrowed.'
      },
      {
        type: 'p',
        text:
          'The light comes in low from the east and takes a long time to cross a hillside. In that light the dewdrops on the grasses stay visible, the pines read as almost black against a pale sky, and the sound of the stream below is closer than it has any right to be. None of this needs you to be anywhere. It only needs you to be up.'
      },
      { type: 'h2', text: 'The first hour' },
      {
        type: 'p',
        text:
          'There is a working rhythm to a slow morning here, and it is worth naming because it is simple. Tea, made properly and drunk without a second task attached. Then the walk to the water, which on the Explore map is barely five minutes from the village centre. Then sitting down again somewhere with a view, for no stated reason, for as long as the light allows.'
      },
      {
        type: 'quote',
        text:
          'The mountains have never once been impressed by a schedule. They are only impressed by attention.'
      },
      {
        type: 'p',
        text:
          'This is not advice about productivity dressed up as philosophy. It is a description of what the place is like when you let it set the pace. The difference is visible by ten in the morning: the walk is done, the tea is finished, and the day still has most of itself ahead.'
      },
      { type: 'h2', text: 'Letting the day be ordinary' },
      {
        type: 'p',
        text:
          'The best thing about an unhurried day in Jibhi is that it becomes entirely ordinary. You read. You notice that the orchard on the far side of the stream has turned. Someone walks past and stops to talk about a road that will be closed in the rains. The day does not produce much, and that is precisely the point — it does not need to, because you are not here to be productive.'
      },
      {
        type: 'p',
        text:
          'By the time the shadows shorten and the day turns warm, you have done very little and you have seen quite a lot. That trade tends to be the whole reason people come to the mountains, and it is the reason most of them come back.'
      }
    ]
  },

  {
    slug: 'the-road-to-jalori-pass',
    title: 'The road to Jalori Pass',
    dek: 'Fifteen kilometres, roughly forty-five minutes, and a change in altitude you feel before you see it.',
    category: 'Travel & Explore',
    date: '2026-09-12',
    readingTime: '7 min read',
    excerpt:
      'The drive to Jalori Pass is short enough to do in an afternoon and high enough to feel like a different country. Here is what the road asks of you, and what it gives back.',
    hero: {
      src: '/images/explore/jalori-pass/01.jpeg',
      w: 1080,
      h: 1080,
      alt: 'A high Himalayan pass road curving above a forested valley',
      caption: 'Above the treeline, the road gets quiet.'
    },
    inline: [
      {
        src: '/images/explore/jalori-pass/02.jpeg',
        w: 1080,
        h: 1440,
        alt: 'Sweeping views across layered ridges from a high pass',
        caption: 'The reward for the switchbacks.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'The road to Jalori Pass begins as ordinary mountain tarmac and then, without ceremony, stops being ordinary. It narrows. It tilts. It finds a series of bends that gain height quickly, and if you look back — which most people do, at least once — the village you left is already smaller than you expected.'
      },
      {
        type: 'h2',
        text: 'Fifteen kilometres, entirely uphill in feeling'
      },
      {
        type: 'p',
        text:
          'Fifteen kilometres is not far, and roughly forty-five minutes is not long. Both numbers are true and neither is the point. The pass sits at around three thousand one hundred and twenty metres, and the body registers that transition more honestly than the map does. Conversation gets shorter somewhere past the halfway point. That is the altitude talking.'
      },
      {
        type: 'quote',
        text: 'You do not climb the pass so much as you arrive at it, gradually, and slightly out of breath.'
      },
      {
        type: 'p',
        text:
          'The Explore page lists this one as moderate difficulty and puts the season at March to June, then September to November. That range is worth respecting rather than optimising around. The monsoon brings cloud, and cloud at this height is not atmosphere, it is simply white.'
      },
      { type: 'h2', text: 'What to bring, and what to leave' },
      {
        type: 'p',
        text:
          'A layer you can put on and take off twice in an hour, water, and shoes with grip. Everything else you are tempted to pack for this drive is weight the car does not need. There is nothing on the pass to buy and nothing on the pass to queue for, which is a good description of the place in one sentence.'
      },
      {
        type: 'p',
        text:
          'Coming down is the part people underestimate. The descent is long and the bends reward attention. Build in the time. Most of the afternoon is better spent back in the valley than in the car, and the valley is not going anywhere.'
      }
    ]
  },

  {
    slug: 'mountain-mornings',
    title: 'What makes a mountain morning taste different',
    dek: 'On altitude, water, and the difference between eating enough and eating well.',
    category: 'Food & Café',
    date: '2026-08-28',
    readingTime: '5 min read',
    excerpt:
      'Hunger at altitude is real and easily misunderstood. A short note on why the first meal of the day matters more here than anywhere else.',
    hero: {
      src: '/images/founders-tea.jpg',
      w: 1200,
      h: 1600,
      alt: 'Tea being poured into a cup at the start of the day',
      caption: 'The first thing worth doing well.'
    },
    inline: [
      {
        src: '/images/life/chapter-05.jpg',
        w: 1600,
        h: 900,
        alt: 'A quiet dining area looking out towards the hills',
        caption: 'Somewhere to sit down before you go out.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'There is a particular kind of hunger that arrives with altitude, and it is more insistent than its equivalent at sea level. It is not a large hunger exactly. It is a persistent one, and it will quietly decide how the rest of your day feels if you let it pick the menu.'
      },
      { type: 'h2', text: 'Water before opinions' },
      {
        type: 'p',
        text:
          'The first thing the mountain asks for is unremarkable and easy to skip. Drink properly, and drink it before you decide you are hungry, because the thirst that mimics hunger has already arrived by the time you notice the hunger. This is the least glamorous and most useful thing in this article.'
      },
      {
        type: 'quote',
        text: 'Most altitude problems begin as a breakfast that was eaten too fast.'
      },
      {
        type: 'p',
        text:
          'After that: something warm, something with salt, and something you can eat without thinking about it. Not a project. A mountain breakfast is fuel with the decency to be pleasant, which is a different and better thing than fuel.'
      },
      { type: 'h2', text: 'The second meal matters more' },
      {
        type: 'p',
        text:
          'It is the second meal that catches people. You walk for two hours, you are pleased with yourself, and then you eat a light thing because the day felt light. By mid-afternoon the error is obvious. Eat properly after the walk. The walk is the reason to be here; the meal is what lets you do it again tomorrow.'
      },
      {
        type: 'p',
        text:
          'None of this is complicated, and that is the point. The cooking at FAM is worth eating slowly, but the discipline that makes it work is simple enough to state in a sentence: drink the water, eat the breakfast, and do not skip the meal after the walk.'
      }
    ]
  },

  {
    slug: 'life-among-the-apple-orchards',
    title: 'Life among the apple orchards',
    dek: 'A season measured in thinning, windfall and the specific quiet of a Tirthan autumn.',
    category: 'Local Culture',
    date: '2026-08-14',
    readingTime: '8 min read',
    excerpt:
      'Up in the Tirthan Valley the year turns on a rhythm that has nothing to do with calendars. This is what an apple year looks like from the inside.',
    hero: {
      src: '/images/explore/tirthan-valley/03.jpg',
      w: 736,
      h: 1410,
      alt: 'Terraced fruit orchards on a steep Himalayan hillside',
      caption: 'Terraces cut into the slope, all the way up.'
    },
    inline: [
      {
        src: '/images/explore/tirthan-valley/02.jpg',
        w: 736,
        h: 1111,
        alt: 'Old fruit trees growing between stone terrace walls',
        caption: 'Every terrace holds water differently. Every grower knows which.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'The Tirthan Valley grows fruit on terraces cut into slopes that were never meant to hold a flat field. The engineering is generations old and largely invisible, and the result is a landscape where farming and forest are interleaved rather than separated. You can stand at a stone wall and look across the top of one orchard and the bottom of the next.'
      },
      { type: 'h2', text: 'Thinning is the real work' },
      {
        type: 'p',
        text:
          'The visible work of an orchard year is picking, and the actual work is the opposite of picking: it is removing fruit, early, by hand, so that what remains is large enough to be worth eating. A grower will spend weeks taking away what could have been a bigger crop in order to have a better one. It is a strange discipline if your frame of reference is retail fruit, and an obvious one if you have ever watched anything grow.'
      },
      {
        type: 'quote',
        text: 'The year is decided in June, weeks before anything is ripe.'
      },
      {
        type: 'p',
        text:
          'Windfall follows. By late autumn the ground beneath the trees is loud with fruit that arrived early or fell short, and the smell of it — sweet, slightly fermented, gone past saving — is the smell of the season ending. Orchards are honest about time in a way that a calendar is not.'
      },
      { type: 'h2', text: 'Visiting without intruding' },
      {
        type: 'p',
        text:
          'These are working landscapes, which means the terraces are somebody\'s income and not a viewpoint. Slow walking, no picking without asking, and an awareness that a quiet hillside in autumn is the result of a great deal of labour and weather luck. It costs nothing to observe that and it changes what you are looking at.'
      },
      {
        type: 'p',
        text:
          'The forest here — the Great Himalayan National Park on the far side — is protected and wild, and the contrast is instructive. On one side of the valley the trees are managed to the leaf for production; on the other they are left to themselves. Both are landscapes. Only one of them has a name.'
      }
    ]
  },

  {
    slug: 'a-quiet-guide-to-exploring-jibhi',
    title: 'A quiet guide to exploring Jibhi',
    dek: 'Waterfalls, lakes, forest trails and a forest that will absorb a whole afternoon.',
    category: 'Travel & Explore',
    date: '2026-07-30',
    readingTime: '7 min read',
    excerpt:
      'Everything within reach of the village, ordered by how much quiet you are likely to get. Distances and difficulty follow the existing Explore listings.',
    hero: {
      src: '/images/explore/jibhi-waterfall/01.jpeg',
      w: 1080,
      h: 1440,
      alt: 'A tall waterfall dropping through a green gorge',
      caption: 'Five minutes from the village, if you are willing to be quiet.'
    },
    inline: [
      {
        src: '/images/explore/jibhi-waterfall/04.jpeg',
        w: 1080,
        h: 1440,
        alt: 'Water falling into a pool surrounded by dense green growth',
        caption: 'The water does most of the talking.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'The useful thing about Jibhi is the ratio between what is close and what is worth seeing. A waterfall sits about five minutes walk from the centre, listed as easy and open to all seasons. A high pass sits fifteen kilometres away and takes most of an afternoon. Both are reachable without arranging anything.'
      },
      { type: 'h2', text: 'Start close: the waterfall' },
      {
        type: 'p',
        text:
          'Begin with the waterfall, because it sets the tone and it is close enough to abandon if the mood is wrong. Five minutes of walking, easy underfoot, all seasons. It is the one place where arriving early is genuinely worth it: the noise of the water covers conversation, and after ten minutes most people stop taking pictures.'
      },
      {
        type: 'quote',
        text: 'Go to the waterfall first. It teaches you what the rest of the valley is going to be like.'
      },
      { type: 'h2', text: 'Then the forest' },
      {
        type: 'p',
        text:
          'The forest trails above the village are the answer to a half-day that has no plan in it. They are not difficult and they are not spectacular in the sense of having a summit photograph. They are simply forest — light through deodar, a stream, birds — and they will take an afternoon without asking you to leave.'
      },
      { type: 'h2', text: 'And a lake, if you want distance' },
      {
        type: 'p',
        text:
          'Serolsar Lake is the excursion for a day with more in it. The drive takes most of the morning and the lake earns the return. Plan it as a full day rather than squeezing it into an afternoon, and go earlier than you think you need to, because the light on the water is short-lived.'
      },
      {
        type: 'p',
        text:
          'One piece of practical advice: this is monsoon country. Trails that are fine in autumn become slippery and occasionally unsafe during the rains, and the Explore listings already flag the season for the higher passes. Trust that guidance rather than generalising from one walk.'
      }
    ]
  },

  {
    slug: 'the-people-and-stories-behind-fam',
    title: 'The people and stories behind FAM',
    dek: 'A boutique stay in Himachal is mostly a question of who is holding the thing together.',
    category: 'FAM Stories',
    date: '2026-07-18',
    readingTime: '6 min read',
    excerpt:
      'The rooms are the easy part. A note on the unglamorous work that decides whether a mountain stay feels easy or not.',
    hero: {
      src: '/images/fam-big-pic.jpg',
      w: 1600,
      h: 900,
      alt: 'A view across the valley from the property',
      caption: 'The property, and the valley it was chosen for.'
    },
    inline: [
      {
        src: '/images/life/chapter-02.jpg',
        w: 2400,
        h: 1350,
        alt: 'The approach road winding through hillside vegetation',
        caption: 'The last stretch of road decides what you expect.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'Guests almost never review the thing that determines whether their stay felt good. They review the room, the breakfast, the view. But those are the visible layer. Underneath is a much less photogenic set of decisions about water, heat, timing and maintenance that nobody notices precisely because they are working.'
      },
      { type: 'h2', text: 'The unglamorous competence' },
      {
        type: 'p',
        text:
          'Hot water at seven in the morning on a winter morning is not an achievement in the ordinary sense. It is the result of someone having got up earlier than everyone, on many days, for a long time. The same is true of a room that is ready when you are, a light that works, and a generator that does not make itself known.'
      },
      {
        type: 'quote',
        text: 'Hospitality in the mountains is mostly the discipline of arriving before your guest does.'
      },
      {
        type: 'p',
        text:
          'This is the part of the work that has no marketing value and total operational weight. It is also, when it is done well, the reason people write the specific sentence that a property becomes known for — and that sentence is almost never about the furniture.'
      },
      { type: 'h2', text: 'What the guests actually came for' },
      {
        type: 'p',
        text:
          'They came for altitude, quiet and a change in air. The building is only the mechanism. Any property in this valley can offer a view; relatively few can offer stillness without the noise of a full dining room at seven. Keeping a place quiet while still running it well is a scheduling problem more than a design one.'
      },
      {
        type: 'p',
        text:
          'So when the place works, the credit does not sit with any one visible thing. It sits with the accumulated ordinary competence of the people running it. They rarely get named in the review, which is its own kind of commentary on how reviews work.'
      }
    ]
  },

  {
    slug: 'monsoon-in-the-mountains',
    title: 'Monsoon in the mountains',
    dek: 'The season that closes trails, doubles the water and changes what the valley sounds like.',
    category: 'Mountain Life',
    date: '2026-07-02',
    readingTime: '6 min read',
    excerpt:
      'Between June and September the mountains reorganise themselves around water. It is worth understanding the season before planning a trip into it.',
    hero: {
      src: '/images/life/chapter-07.jpg',
      w: 2400,
      h: 1350,
      alt: 'Rain moving through a forested mountain valley',
      caption: 'Weather arriving across the ridge.'
    },
    inline: [
      {
        src: '/images/explore/forest-trails/04.jpeg',
        w: 1080,
        h: 1273,
        alt: 'A wet forest path under dense green canopy',
        caption: 'A forest path in the rains. Watch your footing.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'The monsoon is not a rainy season here so much as a change of organising principle. For most of the year the valley is arranged around the view; for four months it is arranged around the water. Streams that were a footnote in April are the main feature by July.'
      },
      { type: 'h2', text: 'What closes, and why' },
      {
        type: 'p',
        text:
          'Trails wash out. Slopes that take forty minutes in dry weather take longer and give you more of the sky. The high passes the Explore listings mark as March to June, then September to November, are marked that way because between those windows the cloud is usually at pass height, and cloud at pass height is just white.'
      },
      {
        type: 'quote',
        text: 'In the monsoon the valley is not less beautiful. It is louder, and it is asking for more attention.'
      },
      {
        type: 'p',
        text:
          'None of that is a warning so much as an adjustment. Guests who come in the rains and expect a dry Alpine week tend to have a worse time than guests who come expecting a different place entirely. The green is extraordinary. The water is loud. The walks are shorter and the evenings are longer.'
      },
      { type: 'h2', text: 'The upside' },
      {
        type: 'p',
        text:
          'Fewer people, lower rates, and a landscape that is genuinely unusual — the kind of green that only happens for about ten weeks a year. If the reason you are drawn to the mountains is the mountains rather than the weather, the monsoon is not a compromise. It is the better bet.'
      }
    ]
  },

  {
    slug: 'where-the-forest-begins',
    title: 'Where the forest begins',
    dek: 'On the protected forest above the valley, and the particular quality of managed land.',
    category: 'Mountain Life',
    date: '2026-06-19',
    readingTime: '5 min read',
    excerpt:
      'Jibhi sits between two kinds of woodland: the forest that is left alone and the forest that feeds people. The difference is visible within an hour\'s walk.',
    hero: {
      src: '/images/explore/forest-trails/01.jpg',
      w: 736,
      h: 1308,
      alt: 'Tall conifer forest rising on a steep slope',
      caption: 'The managed and the wild, within sight of each other.'
    },
    inline: [
      {
        src: '/images/explore/serolsar-lake/05.jpeg',
        w: 1080,
        h: 1350,
        alt: 'Still water at a forest lake reflecting the treeline',
        caption: 'Still water, high in the trees.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'The Great Himalayan National Park begins not at a gate but gradually, which is part of what makes it confusing the first time. There is no line you cross. The forest simply becomes less managed, and then it is not managed at all.'
      },
      { type: 'h2', text: 'Two forests, one walk' },
      {
        type: 'p',
        text:
          'Set out from the village and you move from orchard edge to managed forest to wild forest within an hour. The first is pruned and thinned and terraced for production. The second is harvested in rotation. The third is the park, and inside it the trees decide their own spacing, which is why it feels denser even though it may be the same species.'
      },
      {
        type: 'quote',
        text: 'A managed forest grows to a plan. A protected one grows to a pace, and the difference is in the undergrowth.'
      },
      {
        type: 'p',
        text:
          'The practical consequences for a visitor are small but real: paths inside the park are marked and follow established routes, wildlife is genuinely wild and should be observed from distance, and the ground is unpredictable in a way that managed forestry generally prevents.'
      },
      { type: 'h2', text: 'Why the contrast is worth seeing' },
      {
        type: 'p',
        text:
          'Most places give you a landscape without showing you its opposite. Jibhi happens to contain both a working forest economy and a protected forest reserve within a short walk of each other, which is unusual and is the clearest argument for spending more than a night here.'
      }
    ]
  },

  {
    slug: 'a-weekend-without-a-hurry',
    title: 'A weekend without a hurry',
    dek: 'Two days, done properly, with nothing on the schedule.',
    category: 'Stories from Jibhi',
    date: '2026-06-04',
    readingTime: '7 min read',
    excerpt:
      'A weekend is long enough to stop rushing and short enough to plan once, properly. How to spend it if the point is to come back rested rather than tired.',
    hero: {
      src: '/images/explore/serolsar-lake/03.jpeg',
      w: 1080,
      h: 1350,
      alt: 'A forest lake with a treeline reflected in still water',
      caption: 'One good day trip, taken at the pace it deserves.'
    },
    inline: [
      {
        src: '/images/parallax-dji.jpg',
        w: 1920,
      h: 1080,
        alt: 'Wide valley view showing ridges receding into distance',
        caption: 'The afternoon, with nothing scheduled in it.'
      }
    ],
    body: [
      {
        type: 'p',
        text:
          'A weekend in the mountains fails in a predictable way: you arrive having planned six things, and because you planned six things you do one of them properly and rush the rest. The fix is not more time. It is fewer plans.'
      },
      { type: 'h2', text: 'Day one: arrive properly' },
      {
        type: 'p',
        text:
          'The first day should cost you nothing. Walk into the village, do the waterfall — five minutes, easy, all seasons — and then let the afternoon be unscheduled. This is the day you find out what the place smells like at different hours, which is more useful planning than anything you could have written down.'
      },
      {
        type: 'quote',
        text: 'The first afternoon is not for exploring. It is for finding out what the place is like when you are not looking for anything.'
      },
      { type: 'h2', text: 'Day two: one proper excursion' },
      {
        type: 'p',
        text:
          'Choose one. Serolsar Lake if you want the widest views and most of the day; the forest trails if you want a half-day and no driving. Both are on the Explore page with honest distances. Whatever you pick, start early enough to finish before the light turns hard, and resist adding a second thing on the way back.'
      },
      { type: 'h2', text: 'Leaving on time' },
      {
        type: 'p',
        text:
          'The most underrated part of a good weekend is the departure. Leave with enough margin that the drive home is not a race, because the drive home is the part of the trip people arrive home from still thinking about. Three hours of road is a fine way to finish a weekend. Two and a half hours in a panic is not.'
      },
      {
        type: 'p',
        text:
          'Do all that and you will have walked a great deal less than the ambitious version and remembered considerably more of it.'
      }
    ]
  }
];

module.exports = { CATEGORIES, LANDING_HERO, ARTICLES };
# Journal images

This directory is intentionally **empty of binary files** so the repository stays
light. FAM Journal currently reuses photography from the existing site library
rather than duplicating assets:

| Source | Used for |
| --- | --- |
| `/images/life/chapter-01.jpg` | `a-slower-morning-in-jibhi` (hero) |
| `/images/life/chapter-02.jpg` | `the-people-and-stories-behind-fam` (inline) |
| `/images/life/chapter-05.jpg` | `mountain-mornings` (inline) |
| `/images/life/chapter-06.jpg` | `pages/blog.html` (hero) |
| `/images/life/chapter-07.jpg` | `monsoon-in-the-mountains` (hero) |
| `/images/founders-tea.jpg` | `a-slower-morning-in-jibhi` (inline), `mountain-mornings` (hero) |
| `/images/fam-big-pic.jpg` | `the-people-and-stories-behind-fam` (hero) |
| `/images/parallax-dji.jpg` | `a-weekend-without-a-hurry` (inline) |
| `/images/explore/jalori-pass/01.jpeg` | `the-road-to-jalori-pass` (hero) |
| `/images/explore/jalori-pass/02.jpeg` | `the-road-to-jalori-pass` (inline) |
| `/images/explore/tirthan-valley/03.jpg` | `life-among-the-apple-orchards` (hero) |
| `/images/explore/tirthan-valley/02.jpg` | `life-among-the-apple-orchards` (inline) |
| `/images/explore/jibhi-waterfall/01.jpeg` | `a-quiet-guide-to-exploring-jibhi` (hero) |
| `/images/explore/jibhi-waterfall/04.jpeg` | `a-quiet-guide-to-exploring-jibhi` (inline) |
| `/images/explore/forest-trails/01.jpg` | `where-the-forest-begins` (hero) |
| `/images/explore/forest-trails/04.jpeg` | `monsoon-in-the-mountains` (inline) |
| `/images/explore/serolsar-lake/03.jpeg` | `a-weekend-without-a-hurry` (hero) |
| `/images/explore/serolsar-lake/05.jpeg` | `where-the-forest-begins` (inline) |

## Adding Journal-specific photography

When original Journal images become available, drop them here and point the data
file at them:

```
public/images/blog/<descriptive-slug>.jpg
```

Then set the article's `hero.src` (or an `inline[].src`) to
`/images/blog/<descriptive-slug>.jpg` in `backend/scripts/journalData.js` and
run:

```
node backend/scripts/buildJournal.js
```

Always supply `width`, `height`, `alt` and `caption` alongside the `src`. Width
and height are required to prevent layout shift; `alt` is required for
accessibility.

If a new image should be replaceable at runtime through the admin panel, also
register it in `backend/config/siteImageRegistry.js` and use `data-fam-img`
instead of a plain `src`.
# Judge Everything

A Steam-like dark blue review homepage with Chinese as the default language,
an English switch on the page, and one horizontal row per category such as
games, movies, TV series, and books.

## Files

- `index.html` contains the page shell and language switch.
- `styles.css` contains the dark blue visual system.
- `app.js` renders the bilingual UI and category rows.
- `review.html` and `review-page.js` render one detailed review page.
- `reviews.html` and `reviews-page.js` render the all-reviews page.
- `site.md` stores the homepage copy and category order.
- `reviews/_template.md` is the review template for new entries.
- `reviews/*.md` stores one review per file.
- `sync-content.mjs` converts the markdown files into `content.generated.js`.
- `content.generated.js` is generated output used by the browser.

## Content workflow

1. Duplicate `reviews/_template.md` and rename it, for example `reviews/elden-ring.md`.
2. Fill in the review fields in that file, including `cover` if you have an image.
3. Write the long review under the `---` separator using markdown.
4. Use `## zh` and `## en` sections if you want separate Chinese and English long reviews.
5. Use normal markdown image syntax for figures or GIFs, for example `![Caption](./assets/demo.gif "Caption")`.
6. Run `node sync-content.mjs`.
7. Reload `index.html`.

## What changes when you add one review

- You add or edit one file in `reviews/`, for example `reviews/elden-ring.md`.
- Running `node sync-content.mjs` regenerates `content.generated.js`.
- `index.html`, `reviews.html`, and `review.html` do not need manual edits for normal new entries.
- The homepage rows, the all-reviews archive, and the detail page all read from `content.generated.js`, so the new review appears automatically after sync + reload.

## Site markdown

Edit `site.md` when you want to change the page title, descriptions, or row
order.

```md
# Site
eyebrow_zh: 默认中文，可切换 English
eyebrow_en: Chinese first, English available
title_zh: 万物评审
title_en: Judge Everything
description_zh: 游戏、电影、剧集、图书各自占一行。
description_en: Games, movies, TV series, and books each get their own row.
category_order: games | films | tv | books
```

## Review markdown template

Each review lives in its own file under `reviews/`.

```md
# Review
category: games
title_zh: 黑帝斯
title_en: Hades
cover: ./assets/covers/hades.jpg
creator: Supergiant Games
year: 2020
score: 9.5
reviewed: 2026-05-16
verdict_zh: 神话、动作和成长回路几乎完美咬合。
verdict_en: A near-perfect loop of myth, action, and growth.
palette: #08192d | #12416d | #66c0f4

---
## zh

这里写中文长评正文。可以放图片、动图、列表、引用。

![示意图片](./assets/example.gif "图片说明")

## en

Write the long English review here. Images and GIFs use the same markdown syntax.
```

## Required review fields

- `category`: use `games`, `films`, `tv`, or `books`
- `title_zh` and `title_en`
- `creator`
- `year`
- `score`: use the `0.0` to `10.0` scale
- `reviewed`: use `YYYY-MM-DD`
- `verdict_zh` and `verdict_en`: short description shown on cards and detail headers
- `palette`: three colors separated by `|`

## Optional fields

- `cover`: use a local or remote image URL instead of the generated poster
- `summary_zh` and `summary_en`: if you want a short description field name separate from `verdict`
- markdown body after `---`: the long review content shown on the detail page
- `## zh` and `## en` sections inside the markdown body: use these for separate Chinese and English long reviews
- markdown images like `![Caption](./assets/example.gif "Caption")`: these render as figures and also work for GIFs
- `creator_zh` and `creator_en`: if you want localized creator names

## Quick check

Run this any time you want to verify the project is healthy after adding content:

```bash
node sync-content.mjs
node --check app.js
node --check reviews-page.js
node --check review-page.js
```

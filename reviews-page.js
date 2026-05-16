const data = window.JUDGE_DATA;

if (!data || !Array.isArray(data.reviews)) {
  throw new Error("Missing content data. Run `node sync-content.mjs` first.");
}

const savedLanguage = window.localStorage?.getItem("judge-lang");
const params = new URLSearchParams(window.location.search);

const categoryLabels = {
  games: { zh: "游戏", en: "Games" },
  films: { zh: "电影", en: "Movies" },
  tv: { zh: "剧集", en: "TV Series" },
  books: { zh: "图书", en: "Books" },
};

const sortOptions = [
  { id: "latest", labelKey: "sortLatest" },
  { id: "oldest", labelKey: "sortOldest" },
  { id: "score-desc", labelKey: "sortHighest" },
  { id: "score-asc", labelKey: "sortLowest" },
  { id: "title", labelKey: "sortTitle" },
];

const defaultSort = "latest";

const uiText = {
  zh: {
    langLabel: "切换语言",
    home: "首页",
    eyebrowAll: "所有条目",
    eyebrowCategory: "分类档案",
    titleAll: "全部评审",
    descriptionAll: "在一个页面里查看所有条目，并按分类切换、按最新或分数重新排序。",
    descriptionCategory: (category) =>
      `${category} 分类的全部评审都在这里。你可以按最新、最早、最高分、最低分或标题重新排列。`,
    count: (value) => `${value} 条`,
    openReview: "打开评审详情",
    categoriesLabel: "分类",
    sortLabel: "排序",
    categoryAll: "全部",
    sortLatest: "最新",
    sortOldest: "最早",
    sortHighest: "最高分",
    sortLowest: "最低分",
    sortTitle: "标题",
    summaryAll: (count, sortLabel) => `当前显示 ${count} 条，按${sortLabel}排序。`,
    summaryCategory: (category, count, sortLabel) =>
      `当前显示 ${category} 的 ${count} 条评审，按${sortLabel}排序。`,
    empty: "这个分类暂时还没有评审。",
  },
  en: {
    langLabel: "Switch language",
    home: "Home",
    eyebrowAll: "All Entries",
    eyebrowCategory: "Category Archive",
    titleAll: "All Reviews",
    descriptionAll:
      "Browse every entry in one place, switch categories, and reorder the archive by date or score.",
    descriptionCategory: (category) =>
      `Every ${category} review lives here. Reorder the archive by latest, oldest, highest score, lowest score, or title.`,
    count: (value) => `${value} items`,
    openReview: "Open review details",
    categoriesLabel: "Category",
    sortLabel: "Sort",
    categoryAll: "All",
    sortLatest: "Latest",
    sortOldest: "Oldest",
    sortHighest: "Highest",
    sortLowest: "Lowest",
    sortTitle: "Title",
    summaryAll: (count, sortLabel) => `Showing ${count} items, sorted by ${sortLabel}.`,
    summaryCategory: (category, count, sortLabel) =>
      `Showing ${count} ${category} reviews, sorted by ${sortLabel}.`,
    empty: "There are no reviews in this category yet.",
  },
};

const refs = {
  backdrop: document.querySelector("#page-backdrop"),
  eyebrow: document.querySelector("#reviews-eyebrow"),
  title: document.querySelector("#reviews-title"),
  description: document.querySelector("#reviews-description"),
  app: document.querySelector("#reviews-app"),
  homeLink: document.querySelector("#home-link"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
};

const state = {
  lang: savedLanguage === "en" ? "en" : "zh",
  category: getValidatedCategory(params.get("category")),
  sort: getValidatedSort(params.get("sort")),
};

function getValidatedCategory(value) {
  return value && categoryLabels[value] ? value : "";
}

function getValidatedSort(value) {
  return sortOptions.some((option) => option.id === value) ? value : defaultSort;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getLocalizedSiteField(field, lang) {
  return data.site[`${field}_${lang}`] || data.site[`${field}_en`] || "";
}

function getLocalizedReviewField(review, field, lang) {
  return review[`${field}_${lang}`] || review[`${field}_en`] || review[field] || "";
}

function getLocalizedReviewSummary(review, lang) {
  return (
    getLocalizedReviewField(review, "summary", lang) ||
    getLocalizedReviewField(review, "verdict", lang)
  );
}

function getPosterTitleLines(title) {
  if (!title.includes(" ")) {
    if (title.length <= 6) {
      return [title];
    }

    const midpoint = Math.ceil(title.length / 2);
    return [title.slice(0, midpoint), title.slice(midpoint, midpoint + 6)];
  }

  const words = title.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (lines.length < 1 && next.length <= 16) {
      current = next;
      return;
    }

    if (!current) {
      current = word;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  const trimmed = lines.slice(0, 2);
  const usedLength = trimmed.join(" ").length;

  if (usedLength < title.length) {
    const last = trimmed.length - 1;
    trimmed[last] = `${trimmed[last].slice(0, 13).trimEnd()}...`;
  }

  return trimmed;
}

function buildPoster(review, lang) {
  const [base, accent, glow] = review.palette;
  const title = getLocalizedReviewField(review, "title", lang);
  const creator = getLocalizedReviewField(review, "creator", lang);
  const category = categoryLabels[review.category]?.[lang] || review.category;
  const titleLines = getPosterTitleLines(title)
    .map((line, index) => {
      const dy = index === 0 ? "0" : "64";
      return `<tspan x="68" dy="${dy}">${escapeHtml(line)}</tspan>`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1000" role="img" aria-label="${escapeHtml(title)}">
      <defs>
        <linearGradient id="poster-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="720" height="1000" fill="url(#poster-bg)" />
      <circle cx="548" cy="170" r="180" fill="${glow}" opacity="0.36" />
      <circle cx="176" cy="856" r="244" fill="${glow}" opacity="0.2" />
      <path d="M0 710C160 654 276 626 408 640C538 654 626 730 720 682V1000H0Z" fill="#08111a" opacity="0.34" />
      <text x="68" y="120" fill="rgba(229, 239, 255, 0.82)" font-size="32" font-family="Avenir Next, Arial, sans-serif" font-weight="700" letter-spacing="7">
        ${escapeHtml(category.toUpperCase())}
      </text>
      <text x="68" y="716" fill="#f4f8ff" font-size="70" font-family="Georgia, Palatino, serif" font-weight="700">
        ${titleLines}
      </text>
      <text x="68" y="878" fill="rgba(229, 239, 255, 0.88)" font-size="30" font-family="Avenir Next, Arial, sans-serif">
        ${escapeHtml(creator)}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getOrderedCategories() {
  const configuredOrder = Array.isArray(data.site.category_order) ? data.site.category_order : [];
  const fallbackOrder = Object.keys(categoryLabels);
  const merged = [...configuredOrder, ...fallbackOrder];

  return [...new Set(merged)].filter((category) => categoryLabels[category]);
}

function getFilteredReviews() {
  return state.category
    ? data.reviews.filter((review) => review.category === state.category)
    : [...data.reviews];
}

function compareLatest(left, right) {
  const reviewedDiff = Date.parse(right.reviewed) - Date.parse(left.reviewed);
  if (reviewedDiff !== 0) {
    return reviewedDiff;
  }

  const scoreDiff = right.score - left.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return left.slug.localeCompare(right.slug);
}

function compareOldest(left, right) {
  return -compareLatest(left, right);
}

function compareScoreDesc(left, right) {
  const scoreDiff = right.score - left.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return compareLatest(left, right);
}

function compareScoreAsc(left, right) {
  const scoreDiff = left.score - right.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return compareLatest(left, right);
}

function compareTitle(left, right, lang) {
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const titleDiff = getLocalizedReviewField(left, "title", lang).localeCompare(
    getLocalizedReviewField(right, "title", lang),
    locale,
    { sensitivity: "base" }
  );

  if (titleDiff !== 0) {
    return titleDiff;
  }

  return compareLatest(left, right);
}

function sortReviews(reviews, lang) {
  const items = [...reviews];

  items.sort((left, right) => {
    switch (state.sort) {
      case "oldest":
        return compareOldest(left, right);
      case "score-desc":
        return compareScoreDesc(left, right);
      case "score-asc":
        return compareScoreAsc(left, right);
      case "title":
        return compareTitle(left, right, lang);
      case "latest":
      default:
        return compareLatest(left, right);
    }
  });

  return items;
}

function getBackdropReviews() {
  const source = getFilteredReviews();
  const items = source.length > 0 ? source : data.reviews;

  return [...items]
    .sort(compareScoreDesc)
    .slice(0, window.innerWidth <= 720 ? 12 : 18);
}

function renderBackdrop() {
  if (!refs.backdrop) {
    return;
  }

  const lang = state.lang;
  const items = getBackdropReviews();

  refs.backdrop.innerHTML = `
    <div class="backdrop-grid">
      ${items
        .map((review, index) => {
          const poster = review.cover || buildPoster(review, lang);

          return `
            <figure class="backdrop-tile backdrop-variant-${(index % 6) + 1}">
              <img src="${poster}" alt="" />
            </figure>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCard(review, lang) {
  const title = getLocalizedReviewField(review, "title", lang);
  const creator = getLocalizedReviewField(review, "creator", lang);
  const summary = getLocalizedReviewSummary(review, lang);
  const category = categoryLabels[review.category]?.[lang] || review.category;
  const poster = review.cover || buildPoster(review, lang);

  return `
    <a
      class="card-link"
      href="./review.html?slug=${encodeURIComponent(review.slug)}"
      aria-label="${escapeHtml(`${uiText[lang].openReview}: ${title}`)}"
    >
      <article class="card">
        <figure class="card-poster">
          <img src="${poster}" alt="${escapeHtml(title)}" />
          <span class="card-badge">${escapeHtml(category)}</span>
          <span class="card-score">${review.score}</span>
        </figure>
        <div class="card-copy">
          <h3>${escapeHtml(title)}</h3>
          <p class="card-meta">${escapeHtml(creator)} · ${review.year}</p>
          <p class="card-verdict">${escapeHtml(summary)}</p>
        </div>
      </article>
    </a>
  `;
}

function getSortLabel(lang) {
  const activeSort = sortOptions.find((option) => option.id === state.sort) || sortOptions[0];
  return uiText[lang][activeSort.labelKey];
}

function buildReviewsUrl(nextCategory = state.category, nextSort = state.sort) {
  const nextParams = new URLSearchParams();

  if (nextCategory) {
    nextParams.set("category", nextCategory);
  }

  if (nextSort && nextSort !== defaultSort) {
    nextParams.set("sort", nextSort);
  }

  const query = nextParams.toString();
  return `./reviews.html${query ? `?${query}` : ""}`;
}

function renderCategoryLinks(lang) {
  const items = [
    {
      id: "",
      label: uiText[lang].categoryAll,
    },
    ...getOrderedCategories().map((category) => ({
      id: category,
      label: categoryLabels[category][lang],
    })),
  ];

  return items
    .map((item) => {
      const isActive = state.category === item.id;

      return `
        <a
          class="filter-chip${isActive ? " is-active" : ""}"
          href="${buildReviewsUrl(item.id, state.sort)}"
        >
          ${escapeHtml(item.label)}
        </a>
      `;
    })
    .join("");
}

function renderSortLinks(lang) {
  return sortOptions
    .map((option) => {
      const isActive = state.sort === option.id;

      return `
        <a
          class="filter-chip${isActive ? " is-active" : ""}"
          href="${buildReviewsUrl(state.category, option.id)}"
        >
          ${escapeHtml(uiText[lang][option.labelKey])}
        </a>
      `;
    })
    .join("");
}

function renderPage() {
  const lang = state.lang;
  const items = sortReviews(getFilteredReviews(), lang);
  const activeCategory = state.category ? categoryLabels[state.category][lang] : uiText[lang].categoryAll;
  const activeSort = getSortLabel(lang);
  const isCategoryPage = Boolean(state.category);

  renderBackdrop();

  refs.zhButton.classList.toggle("is-active", lang === "zh");
  refs.enButton.classList.toggle("is-active", lang === "en");
  refs.zhButton.setAttribute("aria-pressed", String(lang === "zh"));
  refs.enButton.setAttribute("aria-pressed", String(lang === "en"));
  refs.zhButton.parentElement.setAttribute("aria-label", uiText[lang].langLabel);
  refs.homeLink.textContent = uiText[lang].home;
  refs.homeLink.href = "./index.html";

  refs.eyebrow.textContent = isCategoryPage ? uiText[lang].eyebrowCategory : uiText[lang].eyebrowAll;
  refs.title.textContent = isCategoryPage ? activeCategory : uiText[lang].titleAll;
  refs.description.textContent = isCategoryPage
    ? uiText[lang].descriptionCategory(activeCategory)
    : uiText[lang].descriptionAll;

  refs.app.innerHTML = `
    <section class="archive-toolbar">
      <div class="archive-filter-row">
        <p class="archive-label">${escapeHtml(uiText[lang].categoriesLabel)}</p>
        <div class="filter-chip-list">
          ${renderCategoryLinks(lang)}
        </div>
      </div>

      <div class="archive-filter-row">
        <p class="archive-label">${escapeHtml(uiText[lang].sortLabel)}</p>
        <div class="filter-chip-list">
          ${renderSortLinks(lang)}
        </div>
      </div>

      <p class="archive-summary">
        ${escapeHtml(
          isCategoryPage
            ? uiText[lang].summaryCategory(activeCategory, items.length, activeSort)
            : uiText[lang].summaryAll(items.length, activeSort)
        )}
      </p>
    </section>

    <section class="review-section review-section--archive">
      ${
        items.length > 0
          ? `
            <div class="review-grid">
              ${items.map((review) => renderCard(review, lang)).join("")}
            </div>
          `
          : `<p class="page-empty">${escapeHtml(uiText[lang].empty)}</p>`
      }
    </section>
  `;

  document.title = `${isCategoryPage ? activeCategory : uiText[lang].titleAll} · ${getLocalizedSiteField("title", lang)}`;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

refs.zhButton.addEventListener("click", () => {
  if (state.lang !== "zh") {
    state.lang = "zh";
    window.localStorage?.setItem("judge-lang", "zh");
    renderPage();
  }
});

refs.enButton.addEventListener("click", () => {
  if (state.lang !== "en") {
    state.lang = "en";
    window.localStorage?.setItem("judge-lang", "en");
    renderPage();
  }
});

renderPage();

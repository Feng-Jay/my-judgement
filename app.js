const data = window.JUDGE_DATA;

if (!data || !Array.isArray(data.reviews)) {
  throw new Error("Missing content data. Run `node sync-content.mjs` first.");
}

const savedLanguage = window.localStorage?.getItem("judge-lang");

const state = {
  lang: savedLanguage === "en" ? "en" : "zh",
};

const uiText = {
  zh: {
    langLabel: "切换语言",
    shelfSubtitle: "按最近评审排序",
    shelfAria: "评审分类",
    count: (value) => `${value} 条`,
    empty: "还没有可展示的评审。",
    allReviews: "全部评审",
    openReview: "打开评审详情",
    browseCategory: (value) => `${value} 条 · 查看全部`,
    browseCategoryAria: (category) => `打开 ${category} 的全部评审`,
  },
  en: {
    langLabel: "Switch language",
    shelfSubtitle: "Sorted by most recent verdicts",
    shelfAria: "Review categories",
    count: (value) => `${value} items`,
    empty: "No reviews to show yet.",
    allReviews: "All Reviews",
    openReview: "Open review details",
    browseCategory: (value) => `${value} items · View All`,
    browseCategoryAria: (category) => `Open all ${category} reviews`,
  },
};

const categoryLabels = {
  games: { zh: "游戏", en: "Games" },
  films: { zh: "电影", en: "Movies" },
  tv: { zh: "剧集", en: "TV Series" },
  books: { zh: "图书", en: "Books" },
};

const shelfMotion = [
  { direction: 1, speed: 0.5 },
  { direction: -1, speed: 0.58 },
  { direction: 1, speed: 0.54 },
  { direction: -1, speed: 0.62 },
];

const refs = {
  backdrop: document.querySelector("#page-backdrop"),
  eyebrow: document.querySelector("#site-eyebrow"),
  title: document.querySelector("#site-title"),
  description: document.querySelector("#site-description"),
  note: document.querySelector("#site-note"),
  allReviewsLink: document.querySelector("#all-reviews-link"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
  shelfContainer: document.querySelector("#shelf-container"),
};

let resizeTimerId = null;
let autoScrollDisposers = [];

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

function formatScore(value) {
  return Number(value).toFixed(1);
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
  const initials = escapeHtml(
    title
      .split(/\s+/)
      .join("")
      .slice(0, 2)
      .toUpperCase()
  );

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
      <text x="68" y="316" fill="rgba(229, 239, 255, 0.1)" font-size="210" font-family="Avenir Next, Arial, sans-serif" font-weight="800">
        ${initials}
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

function getBackdropTileCount() {
  if (window.innerWidth <= 620) {
    return 12;
  }

  if (window.innerWidth <= 960) {
    return 15;
  }

  if (window.innerWidth <= 1360) {
    return 18;
  }

  return 24;
}

function getBackdropReviews() {
  const ordered = [...data.reviews].sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return Date.parse(right.reviewed) - Date.parse(left.reviewed);
  });
  const tileCount = getBackdropTileCount();

  return Array.from({ length: tileCount }, (_, index) => ordered[index % ordered.length]);
}

function getLayoutMetrics() {
  const containerWidth = refs.shelfContainer.clientWidth || window.innerWidth;
  const gap = window.innerWidth <= 720 ? 14 : 18;
  const targetCardWidth =
    window.innerWidth <= 540 ? 150 : window.innerWidth <= 900 ? 170 : 196;
  const maxCardWidth = window.innerWidth <= 720 ? 210 : 240;
  const minVisibleCards = window.innerWidth <= 540 ? 2 : 3;
  const maxVisibleCards =
    window.innerWidth <= 720 ? 3 : window.innerWidth <= 1080 ? 4 : window.innerWidth <= 1440 ? 5 : 6;

  let visibleCards = Math.floor((containerWidth + gap) / (targetCardWidth + gap));
  visibleCards = Math.max(minVisibleCards, Math.min(maxVisibleCards, visibleCards));

  let cardWidth = Math.floor((containerWidth - gap * (visibleCards - 1)) / visibleCards);

  if (cardWidth > maxCardWidth) {
    cardWidth = maxCardWidth;
  }

  return {
    visibleCards,
    cardWidth,
    windowWidth: containerWidth,
  };
}

function getCategoryReviews(category) {
  return data.reviews
    .filter((review) => review.category === category)
    .sort((left, right) => {
      const reviewedDiff = Date.parse(right.reviewed) - Date.parse(left.reviewed);
      if (reviewedDiff !== 0) {
        return reviewedDiff;
      }

      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.slug.localeCompare(right.slug);
    });
}

function renderHero() {
  const lang = state.lang;

  refs.eyebrow.textContent = getLocalizedSiteField("eyebrow", lang);
  refs.title.textContent = getLocalizedSiteField("title", lang);
  refs.description.textContent = getLocalizedSiteField("description", lang);
  refs.note.textContent = getLocalizedSiteField("note", lang);
  document.title = getLocalizedSiteField("title", lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
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

function renderLanguageButtons() {
  const lang = state.lang;

  refs.zhButton.classList.toggle("is-active", lang === "zh");
  refs.enButton.classList.toggle("is-active", lang === "en");
  refs.zhButton.setAttribute("aria-pressed", String(lang === "zh"));
  refs.enButton.setAttribute("aria-pressed", String(lang === "en"));
  refs.zhButton.parentElement.setAttribute("aria-label", uiText[lang].langLabel);
  refs.allReviewsLink.textContent = uiText[lang].allReviews;
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
          <span class="card-score">${formatScore(review.score)}</span>
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

function renderShelves() {
  const lang = state.lang;
  const layout = getLayoutMetrics();
  const categories = getOrderedCategories();

  refs.shelfContainer.setAttribute("aria-label", uiText[lang].shelfAria);

  const rows = categories
    .map((category, index) => {
      const items = getCategoryReviews(category);
      if (items.length === 0) {
        return "";
      }

      const copy = categoryLabels[category]?.[lang] || category;
      const cards = items.map((review) => renderCard(review, lang)).join("");
      const motion = shelfMotion[index % shelfMotion.length];
      const loopable = items.length > layout.visibleCards;
      const categoryUrl = `./reviews.html?category=${encodeURIComponent(category)}`;

      return `
        <section class="shelf">
          <div class="shelf-header">
            <div>
              <h2 class="shelf-title">${escapeHtml(copy)}</h2>
              <p class="shelf-subtitle">${escapeHtml(uiText[lang].shelfSubtitle)}</p>
            </div>
            <div class="shelf-meta">
              <a
                class="shelf-link"
                href="${categoryUrl}"
                aria-label="${escapeHtml(uiText[lang].browseCategoryAria(copy))}"
              >
                ${escapeHtml(uiText[lang].browseCategory(items.length))}
              </a>
            </div>
          </div>
          <div
            class="shelf-window"
            style="--window-width: ${layout.windowWidth}px; --card-width: ${layout.cardWidth}px;"
          >
            <div
              class="shelf-scroller"
              data-speed="${motion.speed}"
              data-direction="${motion.direction}"
              data-loopable="${loopable}"
              data-visible-cards="${layout.visibleCards}"
              data-items-count="${items.length}"
              tabindex="0"
              aria-label="${escapeHtml(copy)}"
            >
              <div class="shelf-group">${cards}</div>
            </div>
          </div>
        </section>
      `;
    })
    .filter(Boolean);

  refs.shelfContainer.innerHTML =
    rows.join("") || `<p class="hero-note">${escapeHtml(uiText[lang].empty)}</p>`;
}

function stopAutoScroll() {
  autoScrollDisposers.forEach((dispose) => dispose());
  autoScrollDisposers = [];
}

function setupAutoScroll() {
  stopAutoScroll();

  document.querySelectorAll('.shelf-scroller[data-loopable="true"]').forEach((scroller) => {
    const viewport = scroller.closest(".shelf-window");
    const firstGroup = scroller.querySelector(".shelf-group");

    if (!viewport || !firstGroup) {
      return;
    }

    const maxShift = Math.max(0, Math.ceil(firstGroup.getBoundingClientRect().width - viewport.clientWidth));
    if (maxShift <= 8) {
      scroller.style.animationName = "none";
      scroller.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const pixelsPerSecond = 20 + Number(scroller.dataset.speed || 0) * 6;
    const durationMs = Math.max(18000, Math.round((maxShift / pixelsPerSecond) * 1000));
    const stateForScroller = {
      paused: false,
      resumeTimerId: null,
    };

    const clearResumeTimer = () => {
      if (stateForScroller.resumeTimerId !== null) {
        window.clearTimeout(stateForScroller.resumeTimerId);
        stateForScroller.resumeTimerId = null;
      }
    };

    scroller.style.setProperty("--drift-distance", `${maxShift}px`);
    scroller.style.animationName = "shelf-drift";
    scroller.style.animationDuration = `${durationMs}ms`;
    scroller.style.animationTimingFunction = "linear";
    scroller.style.animationIterationCount = "infinite";
    scroller.style.animationDirection =
      Number(scroller.dataset.direction) >= 0 ? "alternate" : "alternate-reverse";
    scroller.style.animationPlayState = "running";

    const pause = () => {
      clearResumeTimer();
      stateForScroller.paused = true;
      scroller.style.animationPlayState = "paused";
    };

    const resume = () => {
      clearResumeTimer();
      stateForScroller.paused = false;
      scroller.style.animationPlayState = "running";
    };

    const scheduleResume = (delay = 900) => {
      clearResumeTimer();
      stateForScroller.resumeTimerId = window.setTimeout(() => {
        resume();
      }, delay);
    };

    viewport.addEventListener("pointerdown", pause);
    viewport.addEventListener("pointerup", () => scheduleResume());
    viewport.addEventListener("pointercancel", () => scheduleResume());
    viewport.addEventListener("touchstart", pause, { passive: true });
    viewport.addEventListener("touchend", () => scheduleResume(), { passive: true });
    viewport.addEventListener("touchcancel", () => scheduleResume(), { passive: true });
    viewport.addEventListener(
      "wheel",
      () => {
        pause();
        scheduleResume();
      },
      { passive: true }
    );
    viewport.addEventListener("focusin", pause);
    viewport.addEventListener("focusout", () => {
      if (!viewport.contains(document.activeElement)) {
        scheduleResume(120);
      }
    });

    autoScrollDisposers.push(() => {
      clearResumeTimer();
      scroller.style.animationName = "none";
      scroller.style.animationDuration = "";
      scroller.style.animationTimingFunction = "";
      scroller.style.animationIterationCount = "";
      scroller.style.animationDirection = "";
      scroller.style.animationPlayState = "";
      scroller.style.removeProperty("--drift-distance");
      scroller.style.transform = "translate3d(0, 0, 0)";
    });
  });
}

function render() {
  renderBackdrop();
  renderHero();
  renderLanguageButtons();
  renderShelves();
  setupAutoScroll();
}

refs.zhButton.addEventListener("click", () => {
  if (state.lang !== "zh") {
    state.lang = "zh";
    window.localStorage?.setItem("judge-lang", "zh");
    render();
  }
});

refs.enButton.addEventListener("click", () => {
  if (state.lang !== "en") {
    state.lang = "en";
    window.localStorage?.setItem("judge-lang", "en");
    render();
  }
});

window.addEventListener("resize", () => {
  if (resizeTimerId !== null) {
    window.clearTimeout(resizeTimerId);
  }

  resizeTimerId = window.setTimeout(() => {
    render();
  }, 120);
});

render();

const data = window.JUDGE_DATA;

if (!data || !Array.isArray(data.reviews)) {
  throw new Error("Missing content data. Run `node sync-content.mjs` first.");
}

const savedLanguage = window.localStorage?.getItem("judge-lang");

const state = {
  lang: savedLanguage === "en" ? "en" : "zh",
  slug: new URLSearchParams(window.location.search).get("slug") || "",
};

const uiText = {
  zh: {
    langLabel: "切换语言",
    home: "首页",
    allReviews: "全部评审",
    score: "评分",
    scoreLabel: "主观判断分数",
    creator: "作者 / 创作者",
    year: "年份",
    reviewed: "评审日期",
    category: "分类",
    missing: "找不到这条评审。",
  },
  en: {
    langLabel: "Switch language",
    home: "Home",
    allReviews: "All Reviews",
    score: "Score",
    scoreLabel: "Personal verdict score",
    creator: "Creator",
    year: "Year",
    reviewed: "Reviewed",
    category: "Category",
    missing: "This review could not be found.",
  },
};

const categoryLabels = {
  games: { zh: "游戏", en: "Games" },
  films: { zh: "电影", en: "Movies" },
  tv: { zh: "剧集", en: "TV Series" },
  books: { zh: "图书", en: "Books" },
};

const refs = {
  backdrop: document.querySelector("#page-backdrop"),
  app: document.querySelector("#review-app"),
  homeLink: document.querySelector("#home-link"),
  allReviewsLink: document.querySelector("#all-reviews-link"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
};

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

function getBackdropReviews() {
  return [...data.reviews]
    .sort((left, right) => right.score - left.score)
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

function findReview() {
  return data.reviews.find((review) => review.slug === state.slug) || null;
}

function formatReviewDate(value, lang) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function renderInlineMarkdown(source) {
  const tokens = [];
  const stash = (value) => {
    const id = tokens.push(value) - 1;
    return `\u0000${id}\u0000`;
  };

  let html = source;

  html = html.replace(/`([^`]+)`/g, (_match, value) => stash(`<code>${escapeHtml(value)}</code>`));
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
    (_match, label, url, title) => {
      const safeLabel = escapeHtml(label);
      const safeUrl = escapeHtml(url);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return stash(
        `<a href="${safeUrl}"${titleAttr} target="_blank" rel="noreferrer">${safeLabel}</a>`
      );
    }
  );

  html = escapeHtml(html);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_match, value) => `<strong>${value}</strong>`);
  html = html.replace(/\*([^*]+)\*/g, (_match, value) => `<em>${value}</em>`);
  html = html.replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)] || "");

  return html;
}

function renderMarkdown(source) {
  const markdown = source.trim();

  if (!markdown) {
    return "";
  }

  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let index = 0;

  const isListLine = (line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line);

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
    if (imageMatch) {
      const [, alt, url, caption] = imageMatch;
      const safeAlt = escapeHtml(alt);
      const safeUrl = escapeHtml(url);
      const figureCaption = caption || alt;
      blocks.push(`
        <figure class="review-figure">
          <img src="${safeUrl}" alt="${safeAlt}" loading="lazy" />
          ${figureCaption ? `<figcaption>${renderInlineMarkdown(figureCaption)}</figcaption>` : ""}
        </figure>
      `);
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      if (index < lines.length) {
        index += 1;
      }
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      const quoteParagraphs = quoteLines
        .join("\n")
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${renderInlineMarkdown(paragraph.replace(/\n+/g, " "))}</p>`)
        .join("");

      blocks.push(`<blockquote>${quoteParagraphs}</blockquote>`);
      continue;
    }

    if (isListLine(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items = [];

      while (index < lines.length) {
        const candidate = lines[index].trim();
        if (!candidate || !isListLine(candidate) || /^\d+\.\s+/.test(candidate) !== ordered) {
          break;
        }

        items.push(candidate.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index += 1;
      }

      const tag = ordered ? "ol" : "ul";
      blocks.push(
        `<${tag}>${items
          .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
          .join("")}</${tag}>`
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const candidate = lines[index];
      const candidateTrimmed = candidate.trim();

      if (
        !candidateTrimmed ||
        /^(#{1,6})\s+/.test(candidateTrimmed) ||
        /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/.test(candidateTrimmed) ||
        /^```/.test(candidateTrimmed) ||
        /^>\s?/.test(candidateTrimmed) ||
        isListLine(candidateTrimmed)
      ) {
        break;
      }

      paragraphLines.push(candidate);
      index += 1;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" ").trim())}</p>`);
  }

  return blocks.join("");
}

function renderControls() {
  const lang = state.lang;

  refs.zhButton.classList.toggle("is-active", lang === "zh");
  refs.enButton.classList.toggle("is-active", lang === "en");
  refs.zhButton.setAttribute("aria-pressed", String(lang === "zh"));
  refs.enButton.setAttribute("aria-pressed", String(lang === "en"));
  refs.zhButton.parentElement.setAttribute("aria-label", uiText[lang].langLabel);
  refs.homeLink.textContent = uiText[lang].home;
  refs.allReviewsLink.textContent = uiText[lang].allReviews;
}

function renderPage() {
  const lang = state.lang;
  const review = findReview();

  renderBackdrop();
  renderControls();

  if (!review) {
    refs.app.innerHTML = `<p class="page-empty">${escapeHtml(uiText[lang].missing)}</p>`;
    document.title = `${uiText[lang].allReviews} · ${getLocalizedSiteField("title", lang)}`;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    return;
  }

  const title = getLocalizedReviewField(review, "title", lang);
  const creator = getLocalizedReviewField(review, "creator", lang);
  const summary = getLocalizedReviewSummary(review, lang);
  const category = categoryLabels[review.category]?.[lang] || review.category;
  const cover = review.cover || buildPoster(review, lang);
  const bodyMarkdown =
    getLocalizedReviewField(review, "review", lang) || getLocalizedReviewSummary(review, lang);
  const bodyHtml = renderMarkdown(bodyMarkdown);

  refs.app.innerHTML = `
    <section class="review-header">
      <figure class="review-cover">
        <img src="${cover}" alt="${escapeHtml(title)}" />
      </figure>

      <div class="review-copy">
        <p class="review-kicker">${escapeHtml(category)}</p>
        <h1 class="review-title">${escapeHtml(title)}</h1>
        <p class="review-dek">${escapeHtml(summary)}</p>

        <div class="review-score-row">
          <span class="review-score">${review.score}</span>
          <p class="review-score-label">${escapeHtml(uiText[lang].score)} · ${escapeHtml(uiText[lang].scoreLabel)}</p>
        </div>

        <div class="review-meta-grid">
          <div class="review-meta-item">
            <p class="review-meta-label">${escapeHtml(uiText[lang].creator)}</p>
            <p class="review-meta-value">${escapeHtml(creator)}</p>
          </div>
          <div class="review-meta-item">
            <p class="review-meta-label">${escapeHtml(uiText[lang].year)}</p>
            <p class="review-meta-value">${review.year}</p>
          </div>
          <div class="review-meta-item">
            <p class="review-meta-label">${escapeHtml(uiText[lang].reviewed)}</p>
            <p class="review-meta-value">${escapeHtml(formatReviewDate(review.reviewed, lang))}</p>
          </div>
          <div class="review-meta-item">
            <p class="review-meta-label">${escapeHtml(uiText[lang].category)}</p>
            <p class="review-meta-value">${escapeHtml(category)}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="review-body">
      ${bodyHtml}
    </section>
  `;

  document.title = `${title} · ${getLocalizedSiteField("title", lang)}`;
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

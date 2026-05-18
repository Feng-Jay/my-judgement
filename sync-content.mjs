import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const sitePath = path.join(cwd, "site.md");
const reviewsDir = path.join(cwd, "reviews");
const outputPath = path.join(cwd, "content.generated.js");

const validCategories = new Set(["games", "films", "tv", "books"]);

const requiredSiteFields = [
  "eyebrow_zh",
  "eyebrow_en",
  "title_zh",
  "title_en",
  "description_zh",
  "description_en",
  // "note_zh",
  // "note_en",
  "category_order",
];

const requiredReviewFields = [
  "category",
  "title_zh",
  "title_en",
  "creator",
  "year",
  "score",
  "reviewed",
  "palette",
];

function assignField(target, key, rawValue) {
  const value = rawValue.trim();

  if (key === "year" || key === "score") {
    target[key] = Number(value);
    return;
  }

  if (key === "palette") {
    target[key] = value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    return;
  }

  if (key === "category_order") {
    target[key] = value
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    return;
  }

  target[key] = value;
}

function parseMarkdownFields(source) {
  const fields = {};
  const bodyLines = [];
  const lines = source.split(/\r?\n/);
  let inBody = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (inBody) {
      bodyLines.push(line);
      continue;
    }

    if (trimmed === "---") {
      inBody = true;
      continue;
    }

    if (!trimmed || trimmed.startsWith("<!--") || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([a-z0-9_]+):\s*(.*)$/i);
    if (!match) {
      continue;
    }

    const [, key, value] = match;

    if (value === "|") {
      const blockLines = [];
      let nextIndex = index + 1;

      while (nextIndex < lines.length) {
        const candidate = lines[nextIndex];

        if (candidate.trim() === "") {
          blockLines.push("");
          nextIndex += 1;
          continue;
        }

        if (/^\s{2,}/.test(candidate)) {
          blockLines.push(candidate.replace(/^\s{2}/, ""));
          nextIndex += 1;
          continue;
        }

        break;
      }

      assignField(fields, key, blockLines.join("\n").trim());
      index = nextIndex - 1;
      continue;
    }

    assignField(fields, key, value);
  }

  return {
    fields,
    body: bodyLines.join("\n").trim(),
  };
}

function assignReviewBodies(review, rawBody) {
  if (!rawBody) {
    return;
  }

  const sectionPattern = /^##\s*(zh|en|中文|english)\s*$/i;
  const lines = rawBody.split(/\r?\n/);
  const sections = [];
  let activeSection = null;

  lines.forEach((line) => {
    const match = line.trim().match(sectionPattern);

    if (match) {
      const marker = match[1].toLowerCase();
      const lang = marker === "zh" || marker === "中文" ? "zh" : "en";
      activeSection = { lang, lines: [] };
      sections.push(activeSection);
      return;
    }

    if (activeSection) {
      activeSection.lines.push(line);
    }
  });

  if (sections.length > 0) {
    sections.forEach((section) => {
      const content = section.lines.join("\n").trim();
      if (content) {
        review[`review_${section.lang}`] = content;
      }
    });
    return;
  }

  if (!review.review_zh) {
    review.review_zh = rawBody;
  }

  if (!review.review_en) {
    review.review_en = rawBody;
  }
}

function validateSite(site) {
  requiredSiteFields.forEach((field) => {
    if (
      site[field] === undefined ||
      site[field] === null ||
      site[field] === "" ||
      (Array.isArray(site[field]) && site[field].length === 0)
    ) {
      throw new Error(`Missing site field: ${field}`);
    }
  });

  site.category_order.forEach((category) => {
    if (!validCategories.has(category)) {
      throw new Error(`Unknown category in site.md: ${category}`);
    }
  });
}

function validateReview(review) {
  requiredReviewFields.forEach((field) => {
    if (
      review[field] === undefined ||
      review[field] === null ||
      review[field] === "" ||
      (Array.isArray(review[field]) && review[field].length === 0)
    ) {
      throw new Error(`Review "${review.slug || "unknown"}" is missing field: ${field}`);
    }
  });

  ["zh", "en"].forEach((lang) => {
    if (!review[`summary_${lang}`] && !review[`verdict_${lang}`]) {
      throw new Error(
        `Review "${review.slug || "unknown"}" needs summary_${lang} or verdict_${lang}.`
      );
    }
  });

  if (!validCategories.has(review.category)) {
    throw new Error(`Review "${review.slug}" uses an unknown category: ${review.category}`);
  }

  if (!Array.isArray(review.palette) || review.palette.length !== 3) {
    throw new Error(`Review "${review.slug}" needs exactly 3 palette colors.`);
  }

  if (!Number.isFinite(review.year) || !Number.isFinite(review.score)) {
    throw new Error(`Review "${review.slug}" has an invalid year or score.`);
  }

  if (review.score < 0 || review.score > 10) {
    throw new Error(`Review "${review.slug}" must use a score between 0 and 10.`);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed) || Number.isNaN(Date.parse(review.reviewed))) {
    throw new Error(`Review "${review.slug}" has an invalid reviewed date: ${review.reviewed}`);
  }
}

async function loadSite() {
  const source = await readFile(sitePath, "utf8");
  const { fields: site } = parseMarkdownFields(source);
  validateSite(site);
  return site;
}

async function loadReviews() {
  const entries = await readdir(reviewsDir, { withFileTypes: true });
  const reviewFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (reviewFiles.length === 0) {
    throw new Error("No review markdown files found in reviews/");
  }

  const reviews = await Promise.all(
    reviewFiles.map(async (fileName) => {
      const source = await readFile(path.join(reviewsDir, fileName), "utf8");
      const { fields: review, body } = parseMarkdownFields(source);
      review.slug = fileName.replace(/\.md$/i, "");
      assignReviewBodies(review, body);
      validateReview(review);
      return review;
    })
  );

  return reviews;
}

function buildOutput(data) {
  return `// Generated by sync-content.mjs from site.md and reviews/*.md
window.JUDGE_DATA = ${JSON.stringify(data, null, 2)};
`;
}

const [site, reviews] = await Promise.all([loadSite(), loadReviews()]);
const content = { site, reviews };

await writeFile(outputPath, buildOutput(content), "utf8");

console.log(`Synced ${content.reviews.length} reviews to content.generated.js`);

/**
 * Matle difficulty benchmark
 *
 * Reads all local puzzle/stats files from data/, scores them,
 * prints a Markdown table, saves results JSON, and updates README.md.
 *
 * Usage:  npm run benchmark
 */

import {
  calculateDifficulty,
  TIER_BASIC_MAX,
  TIER_HARD_MIN,
} from "../difficulty.js";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PUZZLE_DIR = "data/puzzles";
export const STATS_DIR = "data/stats";

/** Measure display width, counting emoji as 2 columns wide. */
function displayWidth(str) {
  const emojiRe =
    /[\u{1F000}-\u{1FFFF}]|[\u2700-\u27BF]|[\u2600-\u26FF]|[\u2B50-\u2B55]|[\u{FE00}-\u{FEFF}]/gu;
  let width = 0,
    m;
  let last = 0;
  while ((m = emojiRe.exec(str)) !== null) {
    width += m.index - last + 2;
    last = m.index + m[0].length;
  }
  width += str.length - last;
  return width;
}

export function extractStats(raw) {
  if (!raw) return {};

  const pcts = raw.percentages;
  if (Array.isArray(pcts)) {
    let solved3 = 0,
      fails = 0,
      guessSum = 0,
      totalPct = 0;
    for (let i = 0; i < pcts.length; i++) {
      const p = pcts[i];
      totalPct += p;
      if (i <= 2) solved3 += p;
      if (i === 5) fails += p;
      guessSum += (i < 5 ? i + 1 : 6) * p;
    }
    if (totalPct > 0) {
      return {
        pctSolved3: Math.round(solved3),
        failPct: Math.round(fails),
        avgGuesses: (guessSum / totalPct).toFixed(2),
        total: "(pct)",
      };
    }
  }

  return {};
}

export const TIER_ORDER = { Basic: 0, Medium: 1, Hard: 2 };
export const ACTUAL_TIER_BASIC_MAX = TIER_BASIC_MAX;
export const ACTUAL_TIER_HARD_MIN = TIER_HARD_MIN;

function tierDeltaArrow(rating, actual) {
  if (!rating || !actual) return "-";
  if (rating === actual) return "-";
  return TIER_ORDER[rating] > TIER_ORDER[actual] ? "↑" : "↓";
}

export function actualDifficultyScore(s) {
  if (!s.total) return null;
  const avg = parseFloat(s.avgGuesses);
  const fail = parseFloat(s.failPct);
  return Math.round(Math.max(0, Math.min(100, (avg - 1.5) * 25 + fail * 1.5)));
}

export function actualTier(s) {
  const score = actualDifficultyScore(s);
  if (score === null) return null;
  if (score < ACTUAL_TIER_BASIC_MAX) return "Basic";
  if (score >= ACTUAL_TIER_HARD_MIN) return "Hard";
  return "Medium";
}

export function loadLocalData(options = {}) {
  const { calibration, includePuzzle = false } = options;
  if (!existsSync(PUZZLE_DIR)) return [];

  const files = readdirSync(PUZZLE_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const results = [];
  for (const file of files) {
    const date = file.replace(".json", "");
    try {
      const puzzle = JSON.parse(readFileSync(join(PUZZLE_DIR, file), "utf8"));
      const statsPath = join(STATS_DIR, file);
      const stats = existsSync(statsPath)
        ? JSON.parse(readFileSync(statsPath, "utf8"))
        : null;

      const diff = calculateDifficulty(puzzle, calibration);
      if (diff.error) {
        console.warn(`  ${date}: ${diff.error}`);
        continue;
      }

      const entry = {
        date,
        serverDiff: puzzle.Difficulty ?? "?",
        ...diff,
        stats: extractStats(stats),
      };

      if (includePuzzle) {
        entry.puzzle = puzzle;
      }

      results.push(entry);
    } catch (err) {
      console.warn(`  ${date}: failed to parse – ${err.message}`);
    }
  }
  return results;
}

export function buildTable(results) {
  const cols = [
    "Date",
    "Server",
    "Actual Results",
    "Actual Tier",
    "Our Rating",
    "Accuracy",
    "Δ",
  ];

  let matches = 0,
    total = 0;

  const rows = [];
  for (const r of results) {
    const s = r.stats;
    const actual = s.total
      ? `%≤3: ${s.pctSolved3} · Fail: ${s.failPct} · Avg: ${s.avgGuesses}`
      : "no stats";

    const gt = actualTier(s);
    const actualScore = actualDifficultyScore(s);
    const actualTierStr = gt ? `${gt} (${actualScore})` : "-";
    const ourRating = `${r.tier} (${r.score})`;

    let accuracy, delta;
    if (!gt) {
      accuracy = "-";
      delta = "-S -O";
    } else {
      total++;
      if (r.tier === gt) {
        accuracy = "✅ Match";
        matches++;
      } else {
        accuracy = "❌ Miss";
      }
      const serverDelta = tierDeltaArrow(r.serverDiff, gt);
      const ourDelta = tierDeltaArrow(r.tier, gt);
      delta = `${serverDelta}S ${ourDelta}O`;
    }

    rows.push([
      r.date,
      r.serverDiff,
      actual,
      actualTierStr,
      ourRating,
      accuracy,
      delta,
    ]);
  }

  const widths = cols.map((h, i) => {
    const cellMax = rows.reduce(
      (mx, row) => Math.max(mx, displayWidth(row[i])),
      0,
    );
    return Math.max(h.length, cellMax);
  });

  const pad = (str, w) => str + " ".repeat(Math.max(0, w - displayWidth(str)));
  const fmtRow = (cells) =>
    "| " + cells.map((c, i) => pad(c, widths[i])).join(" | ") + " |";

  const lines = [];
  lines.push(fmtRow(cols));
  lines.push("| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");
  for (const row of rows) lines.push(fmtRow(row));

  if (total > 0) {
    const pct = ((matches / total) * 100).toFixed(0);
    lines.push(
      "",
      `**Accuracy: ${matches}/${total} (${pct}%)** across puzzles with community stats.`,
    );
  }

  return lines.join("\n");
}

const START_MARKER = "<!-- BENCHMARK:START -->";
const END_MARKER = "<!-- BENCHMARK:END -->";

export function updateReadme(tableMarkdown) {
  const readmePath = "README.md";
  let content = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";

  const block = `${START_MARKER}\n## Benchmark Results\n\n### Last updated: ${new Date().toISOString().split("T")[0]}\n\n${tableMarkdown}\n${END_MARKER}`;

  if (content.includes(START_MARKER) && content.includes(END_MARKER)) {
    const re = new RegExp(
      escapeRegex(START_MARKER) + "[\\s\\S]*?" + escapeRegex(END_MARKER),
    );
    content = content.replace(re, block);
  } else {
    content += (content.length ? "\n\n" : "") + block + "\n";
  }

  writeFileSync(readmePath, content);
  console.log("Updated README.md");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function main() {
  const results = loadLocalData();
  if (!results.length) {
    console.log("No local puzzles found in data/puzzles/. Run: npm run fetch");
    process.exit(0);
  }

  const table = buildTable(results);
  console.log(table);

  writeFileSync("benchmark-results.json", JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} results → benchmark-results.json`);

  updateReadme(table);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main();
}

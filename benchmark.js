/**
 * Matle difficulty benchmark
 *
 * Reads all local puzzle/stats files from data/, scores them,
 * prints a Markdown table, saves results JSON, and updates README.md.
 *
 * Usage:  node benchmark.js
 */

import { calculateDifficulty, tierFromScore } from "./difficulty.js";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUZZLE_DIR = "data/puzzles";
const STATS_DIR = "data/stats";

/** Measure display width, counting emoji as 2 columns wide. */
function displayWidth(str) {
  const emojiRe =
    /[\u{1F000}-\u{1FFFF}]|[\u2700-\u27BF]|[\u2600-\u26FF]|[\u2B50-\u2B55]|[\u{FE00}-\u{FEFF}]/gu;
  let width = 0,
    m;
  let last = 0;
  while ((m = emojiRe.exec(str)) !== null) {
    width += m.index - last + 2; // chars before emoji + 2 for the emoji
    last = m.index + m[0].length;
  }
  width += str.length - last;
  return width;
}

// ── Stats extraction ─────────────────────────────────────────────
function extractStats(raw) {
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
      if (i <= 2) solved3 += p; // indices 0-2 = 1-3 guesses
      if (i === 5) fails += p; // index 5 = failed to solve
      guessSum += (i < 5 ? i + 1 : 6) * p; // 1-5 guesses, fails count as 6
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

// ── Tier derivation from community stats ─────────────────────────
const TIER_ORDER = { Basic: 0, Medium: 1, Hard: 2 };

/**
 * Derive an objective difficulty score (0-100) from community stats.
 *
 * Uses a continuous composite of avg guesses and fail rate,
 * avoiding hand-picked thresholds that could inadvertently
 * mirror the server labels.
 *
 * Anchors:
 *   avg=2.0, fail=0%  →  ~20 (trivially easy)
 *   avg=3.0, fail=2%  →  ~52 (typical medium)
 *   avg=4.0, fail=10% →  ~87 (clearly hard)
 */
function actualDifficultyScore(s) {
  if (!s.total) return null;
  const avg = parseFloat(s.avgGuesses);
  const fail = parseFloat(s.failPct);
  // avg guesses range roughly 1.5–4.5; scale to 0-100
  // fail rate range roughly 0–15; each % adds difficulty
  return Math.round(Math.max(0, Math.min(100, (avg - 1.5) * 25 + fail * 1.5)));
}

function actualTier(s) {
  const score = actualDifficultyScore(s);
  if (score === null) return null;
  return tierFromScore(score);
}

// ── Load local files ─────────────────────────────────────────────
function loadLocalData() {
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

      const diff = calculateDifficulty(puzzle);
      if (diff.error) {
        console.warn(`  ${date}: ${diff.error}`);
        continue;
      }

      results.push({
        date,
        serverDiff: puzzle.Difficulty ?? "?",
        ...diff,
        stats: extractStats(stats),
      });
    } catch (err) {
      console.warn(`  ${date}: failed to parse – ${err.message}`);
    }
  }
  return results;
}

// ── Markdown table generation ────────────────────────────────────
function buildTable(results) {
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

  // Build row data first so we can measure column widths
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
      delta = "-";
    } else {
      total++;
      if (r.tier === gt) {
        accuracy = "✅ Match";
        matches++;
      } else {
        accuracy = "❌ Miss";
      }
      // Delta: how the server rating compares to the actual tier
      if (r.serverDiff === gt) {
        delta = "—";
      } else {
        delta =
          TIER_ORDER[r.serverDiff] > TIER_ORDER[gt] ? "↑ Harder" : "↓ Easier";
      }
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

  // Compute column widths (emoji chars count as 2 columns wide)
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

// ── Update README.md ─────────────────────────────────────────────
const START_MARKER = "<!-- BENCHMARK:START -->";
const END_MARKER = "<!-- BENCHMARK:END -->";

function updateReadme(tableMarkdown) {
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

// ── Main ─────────────────────────────────────────────────────────
function main() {
  const results = loadLocalData();
  if (!results.length) {
    console.log("No local puzzles found in data/puzzles/. Run: node fetch.js");
    process.exit(0);
  }

  const table = buildTable(results);
  console.log(table);

  writeFileSync("benchmark-results.json", JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} results → benchmark-results.json`);

  updateReadme(table);
}

main();

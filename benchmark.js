/**
 * Matle difficulty benchmark
 *
 * Reads all local puzzle/stats files from data/, scores them,
 * prints a Markdown table, saves results JSON, and updates README.md.
 *
 * Usage:  node benchmark.js
 */

import { calculateDifficulty } from "./difficulty.js";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUZZLE_DIR = "data/puzzles";
const STATS_DIR = "data/stats";

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
      if (i >= 1 && i <= 3) solved3 += p;
      if (i >= 6) fails += p;
      guessSum += i * p;
    }
    if (totalPct > 0) {
      return {
        pctSolved3: solved3.toFixed(1),
        failPct: fails.toFixed(1),
        avgGuesses: (guessSum / totalPct).toFixed(2),
        total: "(pct)",
      };
    }
  }

  return {};
}

// ── Tier derivation from community stats ─────────────────────────
const TIER_ORDER = { Basic: 0, Medium: 1, Hard: 2 };

function actualTier(s) {
  if (!s.total) return null;
  const avg = parseFloat(s.avgGuesses);
  const fail = parseFloat(s.failPct);
  if (avg >= 3.5 || fail >= 15) return "Hard";
  if (avg <= 2.5 && fail < 5) return "Basic";
  return "Medium";
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
  const lines = [];

  const hdr =
    "| Date | Server | Actual Results | Actual Tier | Our Rating | Accuracy | Δ |";
  const sep =
    "|------|--------|----------------|-------------|------------|----------|---|";
  lines.push(hdr, sep);

  let matches = 0,
    total = 0;

  for (const r of results) {
    const s = r.stats;
    const actual = s.total
      ? `%≤3: ${s.pctSolved3} · Fail: ${s.failPct} · Avg: ${s.avgGuesses}`
      : "no stats";

    const gt = actualTier(s);
    const ourRating = `${r.tier} (${r.score})`;

    let accuracy, delta;
    if (!gt) {
      accuracy = "-";
      delta = "-";
    } else if (r.tier === gt) {
      accuracy = "✅ Match";
      delta = "—";
      matches++;
      total++;
    } else {
      accuracy = "❌ Miss";
      delta = TIER_ORDER[r.tier] > TIER_ORDER[gt] ? "↑ Harder" : "↓ Easier";
      total++;
    }

    lines.push(
      `| ${r.date} | ${r.serverDiff} | ${actual} | ${gt || "-"} | ${ourRating} | ${accuracy} | ${delta} |`,
    );
  }

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

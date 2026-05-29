/**
 * Detects new "non-close" benchmark misses introduced by the latest run.
 *
 * Compares the freshly-generated benchmark-results.json against the previously
 * committed README.md (read via `git show HEAD:README.md`) and reports any
 * puzzles that:
 *   - are now misses, AND
 *   - were not misses (or did not exist) in the prior committed state, AND
 *   - are not within a small tolerance of the correct tier boundary.
 *
 * Outputs:
 *   - Human-readable summary on stdout.
 *   - When run in GitHub Actions (GITHUB_OUTPUT set), writes:
 *       has_regression=true|false
 *       issue_title=...
 *       issue_body_path=path
 *   - When a regression is detected, writes the issue body to
 *     regression-issue.md in the working directory.
 *
 * Usage:  node utils/regression-check.js
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

import {
  TIER_BASIC_MAX,
  TIER_HARD_MIN,
  puzzleToLichessAnalysis,
} from "../difficulty.js";
import {
  actualDifficultyScore,
  actualTier,
  loadLocalData,
} from "./benchmark.js";

const TIER_ORDER = { Basic: 0, Medium: 1, Hard: 2 };
const CLOSENESS_TOLERANCE = 5; // distance ≤ 5 → "close" → suppressed

/**
 * Distance (in score points) between `ourScore` and the nearest boundary that
 * would have placed us in `actualTierLabel`. Returns 0 if we are already in the
 * actual tier.
 */
export function tierBoundaryDistance(ourScore, actualTierLabel) {
  if (!actualTierLabel || ourScore == null) return null;
  const basicMax = TIER_BASIC_MAX; // Basic: score < basicMax
  const hardMin = TIER_HARD_MIN; // Hard:  score >= hardMin

  switch (actualTierLabel) {
    case "Basic":
      // need ourScore < basicMax
      return ourScore < basicMax ? 0 : ourScore - (basicMax - 1);
    case "Medium":
      // need basicMax <= ourScore < hardMin
      if (ourScore < basicMax) return basicMax - ourScore;
      if (ourScore >= hardMin) return ourScore - (hardMin - 1);
      return 0;
    case "Hard":
      // need ourScore >= hardMin
      return ourScore >= hardMin ? 0 : hardMin - ourScore;
    default:
      return null;
  }
}

/** Parse miss dates out of a README.md string. */
export function parseReadmeMissDates(readmeContent) {
  const misses = new Set();
  if (!readmeContent) return misses;
  const lines = readmeContent.split("\n");
  for (const line of lines) {
    if (!line.includes("❌ Miss")) continue;
    const m = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (m) misses.add(m[1]);
  }
  return misses;
}

/** Parse all dated rows out of README.md so we can detect newly added dates. */
export function parseReadmeDates(readmeContent) {
  const dates = new Set();
  if (!readmeContent) return dates;
  const re = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/;
  for (const line of readmeContent.split("\n")) {
    const m = line.match(re);
    if (m) dates.add(m[1]);
  }
  return dates;
}

function readPriorReadme() {
  try {
    return execSync("git show HEAD:README.md", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function loadCurrentResults() {
  if (existsSync("benchmark-results.json")) {
    return JSON.parse(readFileSync("benchmark-results.json", "utf8"));
  }
  // Fallback: re-derive from local data (no puzzle objects needed for IDs but
  // we want them for Lichess links).
  return loadLocalData({ includePuzzle: true });
}

function ensurePuzzles(results) {
  // benchmark-results.json doesn't include the raw `puzzle` payload, so re-load
  // to attach it for Lichess link generation.
  const withPuzzle = loadLocalData({ includePuzzle: true });
  const byDate = new Map(withPuzzle.map((r) => [r.date, r.puzzle]));
  for (const r of results) {
    if (!r.puzzle && byDate.has(r.date)) r.puzzle = byDate.get(r.date);
  }
  return results;
}

export function findNewNonCloseMisses(results, priorReadme) {
  const priorMisses = parseReadmeMissDates(priorReadme);
  const priorDates = parseReadmeDates(priorReadme);
  // Oldest date that was visible in the prior committed README. Any current
  // miss with an older date was already off the windowed table, so we have no
  // basis to call it a "new" regression — skip it to avoid false positives
  // when the table windows out historical rows.
  const priorOldest = priorDates.size ? [...priorDates].sort()[0] : null;

  const regressions = [];
  for (const r of results) {
    const gt = actualTier(r.stats);
    if (!gt) continue; // no community stats yet
    if (r.tier === gt) continue; // matches

    // Already a known miss in the previously committed table → not new.
    if (priorMisses.has(r.date)) continue;
    // Date predates the prior README's window → can't tell if this is new.
    if (priorOldest && r.date < priorOldest) continue;

    const distance = tierBoundaryDistance(r.score, gt);
    if (distance == null || distance <= CLOSENESS_TOLERANCE) continue;

    regressions.push({
      date: r.date,
      ourTier: r.tier,
      ourScore: r.score,
      actualTier: gt,
      actualScore: actualDifficultyScore(r.stats),
      stats: r.stats,
      distance,
      tierGap: Math.abs(TIER_ORDER[r.tier] - TIER_ORDER[gt]),
      details: r.details,
      puzzle: r.puzzle,
    });
  }
  return regressions;
}

function describeStats(s) {
  if (!s || !s.total) return "no stats";
  return `%≤3: ${s.pctSolved3} · Fail: ${s.failPct} · Avg: ${s.avgGuesses}`;
}

export function buildIssueBody(regressions) {
  const lines = [];
  lines.push(
    "The latest daily benchmark run introduced one or more non-close misses",
    "(score is more than " +
      CLOSENESS_TOLERANCE +
      " points from the community tier boundary).",
    "",
    "Please investigate the puzzle(s) below, identify which feature(s) of",
    "`difficulty.js` should have flagged the position, and propose a narrow,",
    "well-gated rule or calibration tweak that resolves the miss without",
    "regressing the rest of the benchmark (`npm run benchmark`).",
    "",
    "Guidance:",
    "- Prefer minimal edits to `difficulty.js`.",
    "- Keep new rules tightly gated; verify the rule fires on the offending",
    "  puzzle but not broadly across the dataset.",
    "- Re-run `npm run benchmark` and confirm the overall accuracy did not drop.",
    "- While new rules should be narrowly-scoped, consider that the goal is to improve future accuracy on unseen puzzles, so avoid overfitting to the specific puzzle at hand. If the miss is due to a previously unknown tactic or pattern, consider how to best capture that pattern in a generalisable way.",
    "",
    "---",
    "",
  );

  for (const r of regressions) {
    lines.push(`### ${r.date} — ${r.actualTier} actual, scored ${r.ourTier}`);
    lines.push("");
    lines.push(`- Our score: **${r.ourScore}** (${r.ourTier})`);
    lines.push(`- Community score: **${r.actualScore}** (${r.actualTier})`);
    lines.push(
      `- Distance from correct tier boundary: **${r.distance}** points`,
    );
    lines.push(`- Tier gap: ${r.tierGap}`);
    lines.push(`- Community stats: ${describeStats(r.stats)}`);

    if (r.puzzle) {
      const analysis = puzzleToLichessAnalysis(r.puzzle);
      if (!analysis.error) {
        lines.push(`- Lichess analysis: ${analysis.url}`);
        lines.push("");
        lines.push("```text");
        lines.push(analysis.fen);
        lines.push("```");
      }
    }

    if (r.details) {
      lines.push("");
      lines.push("<details><summary>Scoring details</summary>");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(r.details, null, 2));
      lines.push("```");
      lines.push("");
      lines.push("</details>");
    }

    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function writeGithubOutput(entries) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  const payload =
    Object.entries(entries)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
  appendFileSync(out, payload);
}

export function main() {
  const priorReadme = readPriorReadme();
  let results = loadCurrentResults();
  results = ensurePuzzles(results);

  const regressions = findNewNonCloseMisses(results, priorReadme);

  if (!regressions.length) {
    console.log("No new non-close misses detected.");
    writeGithubOutput({ has_regression: "false" });
    return;
  }

  console.log(
    `Detected ${regressions.length} new non-close miss(es):`,
    regressions.map((r) => r.date).join(", "),
  );

  const body = buildIssueBody(regressions);
  const bodyPath = "regression-issue.md";
  writeFileSync(bodyPath, body);

  const dates = regressions.map((r) => r.date).join(", ");
  const title =
    regressions.length === 1
      ? `Benchmark regression: non-close miss on ${dates}`
      : `Benchmark regression: ${regressions.length} non-close misses (${dates})`;

  writeGithubOutput({
    has_regression: "true",
    issue_title: title,
    issue_body_path: bodyPath,
  });
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main();
}

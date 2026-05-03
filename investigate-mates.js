/**
 * Investigate the "all possible mates" difficulty signal.
 *
 * For every locally-cached puzzle, this script counts the number of distinct
 * piece arrangements at the 5 hidden squares that still produce a checkmate
 * (see `possibleMates.js`), and reports the result alongside the current
 * heuristic rating and community stats. It then prints a Pearson correlation
 * coefficient against the community-derived "actual" difficulty score so we
 * can judge whether the new metric is worth folding into the main scorer.
 *
 * Usage:
 *   node investigate-mates.js                 # run on all local puzzles
 *   node investigate-mates.js --limit 10      # only the first N puzzles
 *   node investigate-mates.js --max-candidates 250000
 */
import { fileURLToPath } from "node:url";

import {
  actualDifficultyScore,
  actualTier,
  loadLocalData,
} from "./utils/benchmark.js";
import { countPossibleMates } from "./possibleMates.js";

function parseArgs(argv) {
  const args = { limit: Infinity, maxCandidates: 500_000, reasonable: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") args.limit = Number(argv[++i]);
    else if (a === "--max-candidates") args.maxCandidates = Number(argv[++i]);
    else if (a === "--no-reasonable") args.reasonable = false;
  }
  return args;
}

/** Pearson correlation of two equal-length numeric arrays. */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? null : num / den;
}

function pad(s, w) {
  s = String(s);
  return s + " ".repeat(Math.max(0, w - s.length));
}

export function main() {
  const { limit, maxCandidates, reasonable } = parseArgs(process.argv.slice(2));

  const rows = loadLocalData({ includePuzzle: true });
  if (!rows.length) {
    console.log("No local puzzles found in data/puzzles/. Run: node fetch.js");
    process.exit(0);
  }

  const subset = rows.slice(0, limit);
  console.log(
    `Investigating ${subset.length} puzzle(s) (maxCandidates=${maxCandidates}, reasonable=${reasonable})…\n`,
  );

  const cols = [
    "Date",
    "Server",
    "Our Score",
    "Actual Score",
    "Actual Tier",
    "Possible Mates",
    "Examined",
    "Time (ms)",
  ];
  const widths = cols.map((c) => c.length);

  const records = [];
  for (const row of subset) {
    const t0 = Date.now();
    const res = countPossibleMates(row.puzzle, { maxCandidates, reasonable });
    const elapsedMs = Date.now() - t0;

    if (res.error) {
      console.warn(`  ${row.date}: ${res.error}`);
      continue;
    }

    const aScore = actualDifficultyScore(row.stats);
    const aTier = actualTier(row.stats);
    const cell = [
      row.date,
      row.serverDiff ?? "?",
      String(row.score),
      aScore === null ? "-" : String(aScore),
      aTier ?? "-",
      res.capped ? `${res.count}+` : String(res.count),
      String(res.examined),
      String(elapsedMs),
    ];
    cell.forEach((v, i) => {
      widths[i] = Math.max(widths[i], v.length);
    });

    records.push({
      date: row.date,
      serverDiff: row.serverDiff,
      ourScore: row.score,
      actualScore: aScore,
      actualTier: aTier,
      possibleMates: res.count,
      possibleMatesCapped: res.capped,
      examined: res.examined,
      elapsedMs,
      cell,
    });
  }

  // Print table.
  const fmtRow = (cells) =>
    "| " + cells.map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  console.log(fmtRow(cols));
  console.log("|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|");
  for (const r of records) console.log(fmtRow(r.cell));

  // Correlations against the community-derived difficulty score.
  const withStats = records.filter(
    (r) => typeof r.actualScore === "number" && !r.possibleMatesCapped,
  );
  if (withStats.length >= 2) {
    const xs = withStats.map((r) => r.possibleMates);
    const ys = withStats.map((r) => r.actualScore);
    const xsLog = xs.map((v) => Math.log1p(v));
    const ourXs = withStats.map((r) => r.ourScore);

    const linear = pearson(xs, ys);
    const log = pearson(xsLog, ys);
    const heuristicCorr = pearson(ourXs, ys);

    console.log(
      `\nCorrelation with actual difficulty score (n=${withStats.length}):`,
    );
    console.log(`  possibleMates       r = ${linear?.toFixed(3) ?? "n/a"}`);
    console.log(`  log(possibleMates)  r = ${log?.toFixed(3) ?? "n/a"}`);
    console.log(`  current heuristic   r = ${heuristicCorr?.toFixed(3) ?? "n/a"}`);
  } else {
    console.log("\nNot enough puzzles with community stats to correlate.");
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  actualDifficultyScore,
  actualTier,
  loadLocalData,
} from "./benchmark.js";
import { puzzleToLichessAnalysis } from "../difficulty.js";

export function buildDailySummary(result) {
  const lines = ["## Latest puzzle", ""];

  lines.push(`- Date: ${result.date}`);
  lines.push(`- Server difficulty: ${result.serverDiff}`);
  lines.push(`- Our rating: ${result.tier} (${result.score})`);

  const actualTierLabel = actualTier(result.stats);
  const actualScore = actualDifficultyScore(result.stats);
  if (actualTierLabel && actualScore !== null) {
    lines.push(`- Community result: ${actualTierLabel} (${actualScore})`);
  }

  const analysis = puzzleToLichessAnalysis(result.puzzle);
  if (analysis.error) {
    lines.push(`- Lichess analysis: unavailable (${analysis.error})`);
  } else {
    lines.push(`- Lichess analysis: [Open analysis board](${analysis.url})`);
    if (analysis.urlMode === "pgn") {
      lines.push(`- Encoded mainline: ${analysis.moveCount} plies`);
    } else if (analysis.pgnError) {
      lines.push(`- Mainline export note: ${analysis.pgnError}`);
    }
    lines.push("");
    lines.push("```text");
    lines.push(analysis.fen);
    lines.push("```");
  }

  return lines.join("\n") + "\n";
}

export function main() {
  const results = loadLocalData({ includePuzzle: true });
  if (!results.length) {
    console.log("No local puzzles found.");
    return;
  }

  const latest = results.at(-1);
  const summary = buildDailySummary(latest);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (summaryPath) {
    appendFileSync(summaryPath, summary);
    console.log(`Appended daily summary for ${latest.date}`);
    return;
  }

  console.log(summary);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main();
}

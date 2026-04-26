import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { puzzleToLichessAnalysis } from "../difficulty.js";

const PUZZLE_DIR = "data/puzzles";

export function loadPuzzleByDate(date) {
  const puzzlePath = join(PUZZLE_DIR, `${date}.json`);
  if (!existsSync(puzzlePath)) {
    return { error: `Puzzle not found: ${puzzlePath}` };
  }

  try {
    return JSON.parse(readFileSync(puzzlePath, "utf8"));
  } catch (err) {
    return { error: `Failed to read ${puzzlePath}: ${err.message}` };
  }
}

export function buildNotationOutput(date) {
  const puzzle = loadPuzzleByDate(date);
  if (puzzle.error) {
    return puzzle;
  }

  const analysis = puzzleToLichessAnalysis(puzzle);
  if (analysis.error) {
    return analysis;
  }

  return {
    date,
    ...analysis,
  };
}

export function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: node utils/notations.js <YYYY-MM-DD>");
    process.exit(1);
  }

  const result = buildNotationOutput(date);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(`Date: ${result.date}`);
  console.log(`Turn: ${result.turn}`);
  if (result.moveCount) {
    console.log(`Mainline plies: ${result.moveCount}`);
  }
  console.log(`FEN: ${result.fen}`);
  if (result.pgn) {
    console.log(`PGN: ${result.pgn}`);
  }
  console.log(`Lichess: ${result.url}`);
  if (result.fenUrl) {
    console.log(`Lichess FEN fallback: ${result.fenUrl}`);
  }
  if (result.pgnError) {
    console.log(`Mainline note: ${result.pgnError}`);
  }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main();
}

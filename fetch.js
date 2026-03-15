/**
 * Fetch the last N days of Matle puzzles + community stats
 * and save them to data/puzzles/ and data/stats/.
 *
 * Usage:  node fetch.js [days]   (default 2)
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUZZLE_URL = (d) => `https://puzzles.matle.io/${d}.json`;
const STATS_URL = (d) =>
  `https://4nxwlq0olb.execute-api.us-east-1.amazonaws.com/v1/guess?game_id=${d}`;
const DELAY_MS = 100;

const PUZZLE_DIR = "data/puzzles";
const STATS_DIR = "data/stats";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function main() {
  const LOOKBACK = parseInt(process.argv[2], 10) || 2;

  mkdirSync(PUZZLE_DIR, { recursive: true });
  mkdirSync(STATS_DIR, { recursive: true });

  const today = new Date();
  let fetched = 0;
  let skipped = 0;

  console.log(`Fetching up to ${LOOKBACK} days of puzzles…\n`);

  for (let i = 1; i <= LOOKBACK; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = fmtDate(d);

    const puzzlePath = join(PUZZLE_DIR, `${ds}.json`);
    const statsPath = join(STATS_DIR, `${ds}.json`);

    // Skip dates we already have both files for
    if (existsSync(puzzlePath) && existsSync(statsPath)) {
      console.log(`  ${ds}  already exists, skipping`);
      skipped++;
      continue;
    }

    // Fetch puzzle
    if (!existsSync(puzzlePath)) {
      const puzzle = await fetchJSON(PUZZLE_URL(ds));
      await sleep(DELAY_MS);
      if (puzzle) {
        writeFileSync(puzzlePath, JSON.stringify(puzzle, null, 2));
        console.log(`  ${ds}  puzzle ✓`);
      } else {
        console.log(`  ${ds}  puzzle not available`);
        continue; // no point fetching stats without a puzzle
      }
    }

    // Fetch stats
    if (!existsSync(statsPath)) {
      const stats = await fetchJSON(STATS_URL(ds));
      await sleep(DELAY_MS);
      if (stats) {
        writeFileSync(statsPath, JSON.stringify(stats, null, 2));
        console.log(`  ${ds}  stats  ✓`);
      } else {
        console.log(`  ${ds}  stats  not available`);
      }
    }

    fetched++;
  }

  console.log(`\nDone. Fetched: ${fetched}, Skipped: ${skipped}`);
}

main().catch(console.error);

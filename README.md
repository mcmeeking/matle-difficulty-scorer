# Matle Difficulty Scorer

Heuristic difficulty scoring for [Matle.io](https://matle.io) chess puzzles.

> [!NOTE]
> Since the source code of the core project is not public, this logic is written
> in JS to allow for client-side incorporation into the project if desired.

## How it works

`difficulty.js` scores each puzzle 0–100 based on board features:

| Feature                            | Effect                               |
| ---------------------------------- | ------------------------------------ |
| Fewer total pieces                 | Harder (sparser board)               |
| Hidden squares close to mated king | Harder (part of mating net)          |
| Mate-net attackers                 | Harder (complex mating pattern)      |
| Both kings hidden                  | Harder (fewer anchor points)         |
| Promoted pieces hidden             | Harder (unexpected piece types)      |
| Hidden empty squares               | Easier (fewer pieces to guess)       |
| Multiple easy-to-guess squares     | Easier (compound elimination effect) |

**Tiers:** Basic (0–33) · Medium (34–66) · Hard (67–100)

## Usage

```bash
npm install

# Fetch the latest puzzles (last 2 days available on S3)
npm run fetch

# Search for better weight and tier values from local data
npm run calibrate

# Search and immediately apply the tuned values to live defaults
npm run calibrate -- --apply

# Print a puzzle FEN, move history, and matching Lichess analysis URL for a given date
npm run notations -- 2026-04-24

# Or search first and confirm interactively before applying
npm run calibrate -- --prompt

# Run benchmark against all local puzzles & update this README
npm run benchmark
```

## Scripts

| Script                        | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `npm run fetch -- [days]`     | Fetch puzzles + stats → `data/` (default: 2 days)   |
| `npm run calibrate`           | Tune score weights + tier cutoffs, save local JSON  |
| `npm run notations -- <date>` | Print a puzzle FEN, PGN, and Lichess analysis URL   |
| `npm run benchmark`           | Score all local puzzles, print table, update README |

`npm run calibrate` writes `calibration-results.json` with the baseline metrics,
the best locally tuned calibration it found, and the miss list before/after.
Add `--apply` to write those tuned values into `difficulty.js`, or `--prompt`
to ask before applying them.

For code use, `difficulty.js` also exports `puzzleToFen()`, `puzzleToPgn()`,
and `puzzleToLichessAnalysis()` for turning a Matle puzzle payload into a valid
FEN, a reconstructed mainline PGN, and a ready-to-open Lichess analysis link.

Most of the operational scripts now live under `utils/`, so the main project
entry point for the scoring logic itself remains `difficulty.js`.

## Automation

A GitHub Action runs daily at 08:00 UTC to fetch new puzzles, run the benchmark,
append the latest puzzle's move-aware Lichess analysis link to the run summary,
and commit updates. Local benchmark JSON output is now ignored.

<!-- BENCHMARK:START -->
## Benchmark Results

### Last updated: 2026-07-04

| Date       | Server | Actual Results                | Actual Tier | Our Rating  | Accuracy | Δ     |
| ---------- | ------ | ----------------------------- | ----------- | ----------- | -------- | ----- |
| 2026-06-04 | Hard   | %≤3: 62 · Fail: 5 · Avg: 3.38 | Medium (55) | Medium (38) | ✅ Match | ↑S -O |
| 2026-06-05 | Medium | %≤3: 83 · Fail: 1 · Avg: 2.98 | Medium (39) | Medium (53) | ✅ Match | -S -O |
| 2026-06-06 | Hard   | %≤3: 56 · Fail: 3 · Avg: 3.44 | Medium (53) | Medium (48) | ✅ Match | ↑S -O |
| 2026-06-07 | Medium | %≤3: 49 · Fail: 2 · Avg: 3.50 | Medium (53) | Medium (36) | ✅ Match | -S -O |
| 2026-06-08 | Hard   | %≤3: 66 · Fail: 3 · Avg: 3.15 | Medium (46) | Medium (39) | ✅ Match | ↑S -O |
| 2026-06-09 | Medium | %≤3: 85 · Fail: 1 · Avg: 2.83 | Medium (35) | Medium (43) | ✅ Match | -S -O |
| 2026-06-10 | Medium | %≤3: 75 · Fail: 1 · Avg: 3.02 | Medium (40) | Medium (55) | ✅ Match | -S -O |
| 2026-06-11 | Hard   | %≤3: 45 · Fail: 2 · Avg: 3.60 | Medium (56) | Medium (63) | ✅ Match | ↑S -O |
| 2026-06-12 | Basic  | %≤3: 70 · Fail: 1 · Avg: 3.12 | Medium (42) | Hard (100)  | ❌ Miss  | ↓S ↑O |
| 2026-06-13 | Medium | %≤3: 89 · Fail: 1 · Avg: 2.77 | Basic (33)  | Medium (53) | ❌ Miss  | ↑S ↑O |
| 2026-06-14 | Hard   | %≤3: 41 · Fail: 2 · Avg: 3.68 | Medium (58) | Medium (35) | ✅ Match | ↑S -O |
| 2026-06-15 | Basic  | %≤3: 55 · Fail: 1 · Avg: 3.45 | Medium (50) | Basic (19)  | ❌ Miss  | ↓S ↓O |
| 2026-06-16 | Hard   | %≤3: 89 · Fail: 1 · Avg: 2.83 | Medium (35) | Medium (46) | ✅ Match | ↑S -O |
| 2026-06-17 | Medium | %≤3: 57 · Fail: 2 · Avg: 3.49 | Medium (53) | Medium (55) | ✅ Match | -S -O |
| 2026-06-18 | Medium | %≤3: 51 · Fail: 1 · Avg: 3.52 | Medium (52) | Medium (46) | ✅ Match | -S -O |
| 2026-06-19 | Medium | %≤3: 81 · Fail: 1 · Avg: 2.93 | Medium (37) | Medium (54) | ✅ Match | -S -O |
| 2026-06-20 | Medium | %≤3: 64 · Fail: 1 · Avg: 3.34 | Medium (48) | Medium (42) | ✅ Match | -S -O |
| 2026-06-21 | Medium | %≤3: 86 · Fail: 1 · Avg: 2.73 | Basic (32)  | Medium (50) | ❌ Miss  | ↑S ↑O |
| 2026-06-22 | Basic  | %≤3: 89 · Fail: 1 · Avg: 2.72 | Basic (32)  | Basic (24)  | ✅ Match | -S -O |
| 2026-06-23 | Hard   | %≤3: 80 · Fail: 0 · Avg: 2.92 | Medium (36) | Medium (54) | ✅ Match | ↑S -O |
| 2026-06-24 | Hard   | %≤3: 89 · Fail: 0 · Avg: 2.51 | Basic (25)  | Medium (37) | ❌ Miss  | ↑S ↑O |
| 2026-06-25 | Hard   | %≤3: 62 · Fail: 2 · Avg: 3.28 | Medium (47) | Medium (44) | ✅ Match | ↑S -O |
| 2026-06-26 | Medium | %≤3: 54 · Fail: 3 · Avg: 3.49 | Medium (54) | Medium (51) | ✅ Match | -S -O |
| 2026-06-27 | Basic  | %≤3: 57 · Fail: 3 · Avg: 3.58 | Medium (57) | Medium (44) | ✅ Match | ↓S -O |
| 2026-06-28 | Medium | %≤3: 63 · Fail: 1 · Avg: 3.22 | Medium (45) | Medium (54) | ✅ Match | -S -O |
| 2026-06-29 | Medium | %≤3: 63 · Fail: 2 · Avg: 3.32 | Medium (48) | Basic (19)  | ❌ Miss  | -S ↓O |
| 2026-06-30 | Hard   | %≤3: 62 · Fail: 2 · Avg: 3.38 | Medium (50) | Medium (52) | ✅ Match | ↑S -O |
| 2026-07-01 | Hard   | %≤3: 28 · Fail: 5 · Avg: 4.02 | Hard (70)   | Medium (50) | ❌ Miss  | -S ↓O |
| 2026-07-02 | Medium | %≤3: 43 · Fail: 6 · Avg: 3.80 | Hard (67)   | Medium (65) | ❌ Miss  | ↓S ↓O |
| 2026-07-03 | Medium | %≤3: 54 · Fail: 3 · Avg: 3.58 | Medium (57) | Medium (54) | ✅ Match | -S -O |

**Past 30 days accuracy: 22/30 (73%)**
**Overall accuracy: 102/113 (90%)** across all puzzles with community stats.

_Showing the last 30 of 113 puzzles. See git history for older results._
<!-- BENCHMARK:END -->

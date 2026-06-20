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

### Last updated: 2026-06-20

| Date       | Server | Actual Results                | Actual Tier | Our Rating  | Accuracy | Δ     |
| ---------- | ------ | ----------------------------- | ----------- | ----------- | -------- | ----- |
| 2026-05-21 | Hard   | %≤3: 45 · Fail: 5 · Avg: 3.67 | Medium (62) | Medium (53) | ✅ Match | ↑S -O |
| 2026-05-22 | Hard   | %≤3: 45 · Fail: 7 · Avg: 3.88 | Hard (70)   | Hard (68)   | ✅ Match | -S -O |
| 2026-05-23 | Medium | %≤3: 93 · Fail: 1 · Avg: 2.62 | Basic (30)  | Basic (32)  | ✅ Match | ↑S -O |
| 2026-05-24 | Medium | %≤3: 55 · Fail: 1 · Avg: 3.39 | Medium (49) | Medium (37) | ✅ Match | -S -O |
| 2026-05-25 | Medium | %≤3: 78 · Fail: 2 · Avg: 2.92 | Medium (39) | Medium (52) | ✅ Match | -S -O |
| 2026-05-26 | Medium | %≤3: 88 · Fail: 1 · Avg: 3.00 | Medium (39) | Medium (56) | ✅ Match | -S -O |
| 2026-05-27 | Hard   | %≤3: 75 · Fail: 2 · Avg: 3.03 | Medium (41) | Medium (47) | ✅ Match | ↑S -O |
| 2026-05-28 | Medium | %≤3: 45 · Fail: 9 · Avg: 3.71 | Hard (69)   | Hard (69)   | ✅ Match | ↓S -O |
| 2026-05-29 | Medium | %≤3: 70 · Fail: 3 · Avg: 3.20 | Medium (47) | Medium (37) | ✅ Match | -S -O |
| 2026-05-30 | Hard   | %≤3: 44 · Fail: 4 · Avg: 3.69 | Medium (61) | Medium (42) | ✅ Match | ↑S -O |
| 2026-05-31 | Basic  | %≤3: 72 · Fail: 1 · Avg: 3.16 | Medium (43) | Medium (36) | ✅ Match | ↓S -O |
| 2026-06-01 | Medium | %≤3: 90 · Fail: 1 · Avg: 2.71 | Basic (32)  | Medium (35) | ❌ Miss  | ↑S ↑O |
| 2026-06-02 | Medium | %≤3: 42 · Fail: 3 · Avg: 3.71 | Medium (60) | Medium (51) | ✅ Match | -S -O |
| 2026-06-03 | Basic  | %≤3: 85 · Fail: 0 · Avg: 2.98 | Medium (37) | Medium (65) | ✅ Match | ↓S -O |
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

**Past 30 days accuracy: 26/30 (87%)**
**Overall accuracy: 93/99 (94%)** across all puzzles with community stats.

_Showing the last 30 of 99 puzzles. See git history for older results._
<!-- BENCHMARK:END -->

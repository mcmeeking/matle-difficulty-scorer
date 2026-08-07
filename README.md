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

### Last updated: 2026-08-07

| Date       | Server | Actual Results                 | Actual Tier | Our Rating  | Accuracy | Δ     |
| ---------- | ------ | ------------------------------ | ----------- | ----------- | -------- | ----- |
| 2026-07-08 | Medium | %≤3: 44 · Fail: 1 · Avg: 3.57  | Medium (53) | Medium (35) | ✅ Match | -S -O |
| 2026-07-09 | Medium | %≤3: 84 · Fail: 0 · Avg: 2.70  | Basic (30)  | Basic (30)  | ✅ Match | ↑S -O |
| 2026-07-10 | Basic  | %≤3: 86 · Fail: 0 · Avg: 2.74  | Basic (31)  | Basic (31)  | ✅ Match | -S -O |
| 2026-07-11 | Medium | %≤3: 40 · Fail: 17 · Avg: 3.76 | Hard (82)   | Hard (69)   | ✅ Match | ↓S -O |
| 2026-07-12 | Hard   | %≤3: 51 · Fail: 9 · Avg: 3.66  | Hard (68)   | Medium (62) | ❌ Miss  | -S ↓O |
| 2026-07-13 | Hard   | %≤3: 68 · Fail: 1 · Avg: 3.26  | Medium (45) | Medium (39) | ✅ Match | ↑S -O |
| 2026-07-14 | Medium | %≤3: 68 · Fail: 2 · Avg: 3.33  | Medium (49) | Medium (52) | ✅ Match | -S -O |
| 2026-07-15 | Basic  | %≤3: 94 · Fail: 0 · Avg: 2.38  | Basic (22)  | Medium (37) | ❌ Miss  | -S ↑O |
| 2026-07-16 | Medium | %≤3: 74 · Fail: 0 · Avg: 3.09  | Medium (40) | Medium (36) | ✅ Match | -S -O |
| 2026-07-17 | Medium | %≤3: 93 · Fail: 1 · Avg: 2.39  | Basic (24)  | Basic (22)  | ✅ Match | ↑S -O |
| 2026-07-18 | Hard   | %≤3: 84 · Fail: 0 · Avg: 2.70  | Basic (30)  | Basic (28)  | ✅ Match | ↑S -O |
| 2026-07-19 | Hard   | %≤3: 78 · Fail: 1 · Avg: 2.75  | Basic (33)  | Medium (37) | ❌ Miss  | ↑S ↑O |
| 2026-07-20 | Medium | %≤3: 84 · Fail: 2 · Avg: 2.67  | Basic (32)  | Basic (30)  | ✅ Match | ↑S -O |
| 2026-07-21 | Basic  | %≤3: 50 · Fail: 2 · Avg: 3.58  | Medium (55) | Medium (49) | ✅ Match | ↓S -O |
| 2026-07-22 | Medium | %≤3: 64 · Fail: 1 · Avg: 3.28  | Medium (46) | Medium (55) | ✅ Match | -S -O |
| 2026-07-23 | Medium | %≤3: 42 · Fail: 4 · Avg: 3.66  | Medium (60) | Medium (39) | ✅ Match | -S -O |
| 2026-07-24 | Hard   | %≤3: 87 · Fail: 2 · Avg: 2.53  | Basic (29)  | Medium (34) | ❌ Miss  | ↑S ↑O |
| 2026-07-25 | Medium | %≤3: 69 · Fail: 1 · Avg: 3.32  | Medium (47) | Medium (54) | ✅ Match | -S -O |
| 2026-07-26 | Hard   | %≤3: 59 · Fail: 1 · Avg: 3.37  | Medium (48) | Medium (50) | ✅ Match | ↑S -O |
| 2026-07-27 | Medium | %≤3: 56 · Fail: 1 · Avg: 3.45  | Medium (50) | Medium (37) | ✅ Match | -S -O |
| 2026-07-28 | Basic  | %≤3: 76 · Fail: 2 · Avg: 3.05  | Medium (42) | Medium (41) | ✅ Match | ↓S -O |
| 2026-07-29 | Hard   | %≤3: 37 · Fail: 1 · Avg: 3.69  | Medium (56) | Medium (42) | ✅ Match | ↑S -O |
| 2026-07-30 | Medium | %≤3: 85 · Fail: 0 · Avg: 2.90  | Medium (35) | Medium (35) | ✅ Match | -S -O |
| 2026-07-31 | Medium | %≤3: 56 · Fail: 3 · Avg: 3.41  | Medium (52) | Medium (49) | ✅ Match | -S -O |
| 2026-08-01 | Basic  | %≤3: 78 · Fail: 3 · Avg: 3.06  | Medium (44) | Medium (48) | ✅ Match | ↓S -O |
| 2026-08-02 | Hard   | %≤3: 60 · Fail: 1 · Avg: 3.32  | Medium (47) | Medium (59) | ✅ Match | ↑S -O |
| 2026-08-03 | Medium | %≤3: 55 · Fail: 3 · Avg: 3.46  | Medium (54) | Medium (42) | ✅ Match | -S -O |
| 2026-08-04 | Medium | %≤3: 74 · Fail: 1 · Avg: 2.98  | Medium (39) | Medium (34) | ✅ Match | -S -O |
| 2026-08-05 | Hard   | %≤3: 73 · Fail: 1 · Avg: 3.19  | Medium (44) | Medium (41) | ✅ Match | ↑S -O |
| 2026-08-06 | Hard   | %≤3: 17 · Fail: 13 · Avg: 4.24 | Hard (88)   | Medium (63) | ❌ Miss  | -S ↓O |

**Past 30 days accuracy: 25/30 (83%)**
**Overall accuracy: 140/147 (95%)** across all puzzles with community stats.

_Showing the last 30 of 147 puzzles. See git history for older results._
<!-- BENCHMARK:END -->

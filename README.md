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

**Tiers:** Basic (0–32) · Medium (33–60) · Hard (61–100)

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

### Last updated: 2026-05-02

| Date       | Server | Actual Results                 | Actual Tier | Our Rating  | Accuracy | Δ     |
| ---------- | ------ | ------------------------------ | ----------- | ----------- | -------- | ----- |
| 2026-03-13 | Medium | %≤3: 83 · Fail: 0 · Avg: 3.00  | Medium (38) | Medium (38) | ✅ Match | -S -O |
| 2026-03-14 | Hard   | %≤3: 46 · Fail: 4 · Avg: 3.72  | Hard (62)   | Medium (58) | ❌ Miss  | -S ↓O |
| 2026-03-15 | Medium | %≤3: 72 · Fail: 2 · Avg: 3.06  | Medium (42) | Medium (36) | ✅ Match | -S -O |
| 2026-03-16 | Hard   | %≤3: 58 · Fail: 6 · Avg: 3.47  | Medium (58) | Medium (45) | ✅ Match | ↑S -O |
| 2026-03-17 | Basic  | %≤3: 90 · Fail: 0 · Avg: 2.76  | Basic (31)  | Basic (31)  | ✅ Match | -S -O |
| 2026-03-18 | Medium | %≤3: 86 · Fail: 1 · Avg: 2.88  | Medium (36) | Medium (42) | ✅ Match | -S -O |
| 2026-03-19 | Hard   | %≤3: 42 · Fail: 4 · Avg: 3.68  | Hard (61)   | Hard (59)   | ✅ Match | -S -O |
| 2026-03-20 | Medium | %≤3: 65 · Fail: 1 · Avg: 3.21  | Medium (44) | Medium (33) | ✅ Match | -S -O |
| 2026-03-21 | Hard   | %≤3: 49 · Fail: 0 · Avg: 3.52  | Medium (51) | Medium (51) | ✅ Match | ↑S -O |
| 2026-03-22 | Basic  | %≤3: 62 · Fail: 1 · Avg: 3.35  | Medium (48) | Medium (56) | ✅ Match | ↓S -O |
| 2026-03-23 | Medium | %≤3: 48 · Fail: 0 · Avg: 3.51  | Medium (50) | Medium (37) | ✅ Match | -S -O |
| 2026-03-24 | Medium | %≤3: 34 · Fail: 8 · Avg: 3.91  | Hard (72)   | Hard (73)   | ✅ Match | ↓S -O |
| 2026-03-25 | Medium | %≤3: 83 · Fail: 3 · Avg: 2.83  | Medium (38) | Medium (39) | ✅ Match | -S -O |
| 2026-03-26 | Hard   | %≤3: 59 · Fail: 4 · Avg: 3.30  | Medium (51) | Medium (58) | ✅ Match | ↑S -O |
| 2026-03-27 | Medium | %≤3: 64 · Fail: 2 · Avg: 3.28  | Medium (47) | Medium (42) | ✅ Match | -S -O |
| 2026-03-28 | Medium | %≤3: 71 · Fail: 1 · Avg: 2.96  | Medium (38) | Medium (42) | ✅ Match | -S -O |
| 2026-03-29 | Basic  | %≤3: 90 · Fail: 1 · Avg: 2.72  | Basic (32)  | Basic (32)  | ✅ Match | -S -O |
| 2026-03-30 | Hard   | %≤3: 84 · Fail: 2 · Avg: 2.95  | Medium (39) | Medium (44) | ✅ Match | ↑S -O |
| 2026-03-31 | Medium | %≤3: 74 · Fail: 0 · Avg: 3.20  | Medium (43) | Medium (58) | ✅ Match | -S -O |
| 2026-04-01 | Hard   | %≤3: 70 · Fail: 1 · Avg: 3.27  | Medium (46) | Medium (45) | ✅ Match | ↑S -O |
| 2026-04-02 | Hard   | %≤3: 51 · Fail: 4 · Avg: 3.48  | Medium (56) | Medium (52) | ✅ Match | ↑S -O |
| 2026-04-03 | Medium | %≤3: 70 · Fail: 2 · Avg: 3.05  | Medium (42) | Medium (45) | ✅ Match | -S -O |
| 2026-04-04 | Medium | %≤3: 75 · Fail: 2 · Avg: 3.14  | Medium (44) | Medium (47) | ✅ Match | -S -O |
| 2026-04-05 | Medium | %≤3: 56 · Fail: 1 · Avg: 3.41  | Medium (49) | Medium (58) | ✅ Match | -S -O |
| 2026-04-06 | Basic  | %≤3: 97 · Fail: 0 · Avg: 2.19  | Basic (17)  | Basic (19)  | ✅ Match | -S -O |
| 2026-04-07 | Hard   | %≤3: 60 · Fail: 4 · Avg: 3.32  | Medium (51) | Medium (43) | ✅ Match | ↑S -O |
| 2026-04-08 | Medium | %≤3: 82 · Fail: 1 · Avg: 2.91  | Medium (37) | Medium (37) | ✅ Match | -S -O |
| 2026-04-09 | Basic  | %≤3: 90 · Fail: 0 · Avg: 2.71  | Basic (30)  | Basic (23)  | ✅ Match | -S -O |
| 2026-04-10 | Medium | %≤3: 72 · Fail: 1 · Avg: 3.15  | Medium (43) | Medium (50) | ✅ Match | -S -O |
| 2026-04-11 | Hard   | %≤3: 86 · Fail: 1 · Avg: 2.79  | Medium (34) | Medium (39) | ✅ Match | ↑S -O |
| 2026-04-12 | Medium | %≤3: 75 · Fail: 2 · Avg: 2.99  | Medium (40) | Medium (54) | ✅ Match | -S -O |
| 2026-04-13 | Hard   | %≤3: 55 · Fail: 6 · Avg: 3.40  | Medium (57) | Medium (48) | ✅ Match | ↑S -O |
| 2026-04-14 | Medium | %≤3: 74 · Fail: 0 · Avg: 3.14  | Medium (41) | Medium (56) | ✅ Match | -S -O |
| 2026-04-15 | Medium | %≤3: 73 · Fail: 2 · Avg: 3.16  | Medium (45) | Medium (45) | ✅ Match | -S -O |
| 2026-04-16 | Hard   | %≤3: 63 · Fail: 5 · Avg: 3.32  | Medium (53) | Medium (52) | ✅ Match | ↑S -O |
| 2026-04-17 | Medium | %≤3: 76 · Fail: 1 · Avg: 3.02  | Medium (40) | Medium (40) | ✅ Match | -S -O |
| 2026-04-18 | Basic  | %≤3: 65 · Fail: 1 · Avg: 3.34  | Medium (48) | Medium (34) | ✅ Match | ↓S -O |
| 2026-04-19 | Hard   | %≤3: 63 · Fail: 3 · Avg: 3.13  | Medium (45) | Medium (57) | ✅ Match | ↑S -O |
| 2026-04-20 | Medium | %≤3: 92 · Fail: 1 · Avg: 2.79  | Medium (34) | Medium (33) | ✅ Match | -S -O |
| 2026-04-21 | Hard   | %≤3: 83 · Fail: 2 · Avg: 2.94  | Medium (39) | Medium (52) | ✅ Match | ↑S -O |
| 2026-04-22 | Medium | %≤3: 61 · Fail: 3 · Avg: 3.41  | Medium (52) | Medium (55) | ✅ Match | -S -O |
| 2026-04-23 | Medium | %≤3: 85 · Fail: 1 · Avg: 2.96  | Medium (38) | Medium (49) | ✅ Match | -S -O |
| 2026-04-24 | Basic  | %≤3: 74 · Fail: 1 · Avg: 3.13  | Medium (42) | Medium (41) | ✅ Match | ↓S -O |
| 2026-04-25 | Hard   | %≤3: 75 · Fail: 5 · Avg: 3.00  | Medium (45) | Medium (53) | ✅ Match | ↑S -O |
| 2026-04-26 | Medium | %≤3: 80 · Fail: 2 · Avg: 2.84  | Medium (37) | Medium (48) | ✅ Match | -S -O |
| 2026-04-27 | Medium | %≤3: 34 · Fail: 14 · Avg: 4.04 | Hard (85)   | Hard (84)   | ✅ Match | ↓S -O |
| 2026-04-28 | Medium | %≤3: 62 · Fail: 2 · Avg: 3.24  | Medium (47) | Medium (56) | ✅ Match | -S -O |
| 2026-04-29 | Hard   | %≤3: 18 · Fail: 13 · Avg: 4.33 | Hard (90)   | Hard (88)   | ✅ Match | -S -O |
| 2026-04-30 | Basic  | %≤3: 93 · Fail: 1 · Avg: 2.49  | Basic (26)  | Basic (30)  | ✅ Match | -S -O |

**Accuracy: 48/49 (98%)** across puzzles with community stats.

<!-- BENCHMARK:END -->

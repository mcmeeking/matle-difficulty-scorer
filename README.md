# Matle Difficulty Scorer

Heuristic difficulty scoring for [Matle.io](https://matle.io) chess puzzles.

> [!NOTE]
> Since the source code of the core project is not public, this logic is written
> in JS to allow for client-side incorporation into the project if desired.

## How it works

`difficulty.js` scores each puzzle 0–100 with a linear combination of
continuous board features (no boolean motif zoo). Community ground truth is
fail-first: stats buckets are `[fail, 1, 2, 3, 4, 5]`, and the frozen map

`(avgGuesses - 2.5) * 30 + failPct * 1.5 + 50`

recenters a typical puzzle (~2.5 average guesses) near 50.

| Feature                            | Effect                               |
| ---------------------------------- | ------------------------------------ |
| Fewer total pieces                 | Harder (sparser board)               |
| Hidden squares close to mated king | Harder (part of mating net)          |
| Mate-net attackers                 | Harder (complex mating pattern)      |
| Hidden queen / promoted pieces     | Harder (unexpected identities)       |
| King-zone cage pressure            | Harder (hidden king × local pieces)  |
| Hidden empty / starting-home sq.   | Easier (strong deduction anchors)    |
| Multiple easy-to-guess squares     | Easier (compound elimination effect) |

**Tiers:** Basic (0–33) · Medium (34–64) · Hard (65–100)

Calibrate tunes weights only. It must not retune the community map or the
34 / 65 gates.

## Usage

```bash
npm install

# Fetch today's puzzle plus the previous 2 days
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
| `npm run fetch -- [days]`     | Fetch today's puzzle plus the previous N days; today's stats are deferred until tomorrow |
| `npm run calibrate`           | Tune score weights (34/65 gates frozen), save JSON  |
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

A GitHub Action runs daily at 07:00 UTC to fetch today’s puzzle, defer today’s
community stats until the following run, append the latest puzzle's move-aware
Lichess analysis link to the run summary, and commit updates. The README gains
a predictive row with the server rating and our rating until the following run
fills in the community result. Local benchmark JSON output is now ignored.

<!-- BENCHMARK:START -->
## Benchmark Results

### Last updated: 2026-09-24

| Date       | Server | Actual Results                 | Actual Tier | Our Rating  | Accuracy | Δ     |
| ---------- | ------ | ------------------------------ | ----------- | ----------- | -------- | ----- |
| 2026-08-24 | Basic  | %≤3: 94 · Fail: 1 · Avg: 2.07  | Medium (39) | Medium (43) | ✅ Match | ↓S -O |
| 2026-08-25 | Medium | %≤3: 81 · Fail: 2 · Avg: 2.86  | Medium (64) | Medium (55) | ✅ Match | -S -O |
| 2026-08-26 | Medium | %≤3: 94 · Fail: 2 · Avg: 2.15  | Medium (43) | Medium (38) | ✅ Match | -S -O |
| 2026-08-27 | Medium | %≤3: 86 · Fail: 2 · Avg: 2.59  | Medium (56) | Medium (61) | ✅ Match | -S -O |
| 2026-08-28 | Hard   | %≤3: 92 · Fail: 1 · Avg: 1.79  | Basic (30)  | Medium (40) | ❌ Miss  | ↑S ↑O |
| 2026-08-29 | Hard   | %≤3: 76 · Fail: 4 · Avg: 2.77  | Medium (64) | Medium (50) | ✅ Match | ↑S -O |
| 2026-08-30 | Hard   | %≤3: 90 · Fail: 1 · Avg: 2.13  | Medium (40) | Medium (40) | ✅ Match | ↑S -O |
| 2026-08-31 | Medium | %≤3: 91 · Fail: 0 · Avg: 2.50  | Medium (50) | Medium (60) | ✅ Match | -S -O |
| 2026-09-01 | Basic  | %≤3: 95 · Fail: 2 · Avg: 1.75  | Basic (31)  | Medium (41) | ❌ Miss  | -S ↑O |
| 2026-09-02 | Medium | %≤3: 90 · Fail: 2 · Avg: 2.19  | Medium (44) | Medium (55) | ✅ Match | -S -O |
| 2026-09-03 | Hard   | %≤3: 87 · Fail: 2 · Avg: 2.19  | Medium (44) | Medium (53) | ✅ Match | ↑S -O |
| 2026-09-04 | Medium | %≤3: 97 · Fail: 1 · Avg: 1.84  | Basic (32)  | Basic (29)  | ✅ Match | ↑S -O |
| 2026-09-05 | Medium | %≤3: 86 · Fail: 2 · Avg: 2.51  | Medium (53) | Medium (51) | ✅ Match | -S -O |
| 2026-09-06 | Medium | %≤3: 18 · Fail: 19 · Avg: 4.39 | Hard (100)  | Hard (65)   | ✅ Match | ↓S -O |
| 2026-09-07 | Hard   | %≤3: 91 · Fail: 1 · Avg: 2.35  | Medium (47) | Medium (52) | ✅ Match | ↑S -O |
| 2026-09-08 | Medium | %≤3: 41 · Fail: 9 · Avg: 3.80  | Hard (100)  | Hard (73)   | ✅ Match | ↓S -O |
| 2026-09-09 | Basic  | %≤3: 89 · Fail: 0 · Avg: 2.27  | Medium (43) | Medium (34) | ✅ Match | ↓S -O |
| 2026-09-10 | Hard   | %≤3: 91 · Fail: 3 · Avg: 2.19  | Medium (45) | Medium (39) | ✅ Match | ↑S -O |
| 2026-09-11 | Medium | %≤3: 54 · Fail: 6 · Avg: 3.53  | Hard (90)   | Hard (77)   | ✅ Match | ↓S -O |
| 2026-09-12 | Basic  | %≤3: 93 · Fail: 0 · Avg: 2.31  | Medium (44) | Medium (50) | ✅ Match | ↓S -O |
| 2026-09-13 | Medium | %≤3: 92 · Fail: 2 · Avg: 2.35  | Medium (49) | Medium (43) | ✅ Match | -S -O |
| 2026-09-14 | Medium | %≤3: 84 · Fail: 2 · Avg: 2.63  | Medium (57) | Hard (70)   | ❌ Miss  | -S ↑O |
| 2026-09-15 | Hard   | %≤3: 88 · Fail: 3 · Avg: 2.66  | Medium (59) | Medium (42) | ✅ Match | ↑S -O |
| 2026-09-16 | Hard   | %≤3: 89 · Fail: 0 · Avg: 1.92  | Basic (33)  | Medium (47) | ❌ Miss  | ↑S ↑O |
| 2026-09-17 | Basic  | %≤3: 88 · Fail: 2 · Avg: 2.52  | Medium (54) | Medium (49) | ✅ Match | ↓S -O |
| 2026-09-18 | Medium | %≤3: 78 · Fail: 4 · Avg: 2.75  | Medium (64) | Medium (58) | ✅ Match | -S -O |
| 2026-09-19 | Hard   | %≤3: 87 · Fail: 2 · Avg: 2.19  | Medium (44) | Medium (39) | ✅ Match | ↑S -O |
| 2026-09-20 | Medium | %≤3: 73 · Fail: 2 · Avg: 3.06  | Hard (70)   | Medium (46) | ❌ Miss  | ↓S ↓O |
| 2026-09-21 | Medium | %≤3: 93 · Fail: 1 · Avg: 2.01  | Medium (37) | Medium (44) | ✅ Match | -S -O |
| 2026-09-22 | Hard   | %≤3: 92 · Fail: 1 · Avg: 2.40  | Medium (49) | Medium (52) | ✅ Match | ↑S -O |

**Past 30 days accuracy: 25/30 (83%)**
**Overall accuracy: 141/194 (73%)** across all puzzles with community stats.

_Showing the last 30 of 194 puzzles. See git history for older results._
<!-- BENCHMARK:END -->

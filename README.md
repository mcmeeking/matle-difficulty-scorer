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
node fetch.js

# Run benchmark against all local puzzles & update this README
node benchmark.js
```

## Scripts

| Script                 | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `node fetch.js [days]` | Fetch puzzles + stats → `data/` (default: 2 days)   |
| `node benchmark.js`    | Score all local puzzles, print table, update README |

## Automation

A GitHub Action runs daily at 08:00 UTC to fetch new puzzles, run the benchmark, and commit updates.

<!-- BENCHMARK:START -->
## Benchmark Results

### Last updated: 2026-04-09

| Date       | Server | Actual Results                | Actual Tier | Our Rating  | Accuracy | Δ        |
| ---------- | ------ | ----------------------------- | ----------- | ----------- | -------- | -------- |
| 2026-03-13 | Medium | %≤3: 83 · Fail: 0 · Avg: 3.00 | Medium (38) | Medium (39) | ✅ Match | —        |
| 2026-03-14 | Hard   | %≤3: 46 · Fail: 4 · Avg: 3.72 | Hard (62)   | Hard (61)   | ✅ Match | —        |
| 2026-03-15 | Medium | %≤3: 72 · Fail: 2 · Avg: 3.06 | Medium (42) | Medium (50) | ✅ Match | —        |
| 2026-03-16 | Hard   | %≤3: 58 · Fail: 6 · Avg: 3.47 | Medium (58) | Medium (52) | ✅ Match | ↑ Harder |
| 2026-03-17 | Basic  | %≤3: 90 · Fail: 0 · Avg: 2.76 | Basic (31)  | Basic (31)  | ✅ Match | —        |
| 2026-03-18 | Medium | %≤3: 86 · Fail: 1 · Avg: 2.88 | Medium (36) | Medium (41) | ✅ Match | —        |
| 2026-03-19 | Hard   | %≤3: 42 · Fail: 4 · Avg: 3.68 | Hard (61)   | Hard (72)   | ✅ Match | —        |
| 2026-03-20 | Medium | %≤3: 65 · Fail: 1 · Avg: 3.21 | Medium (44) | Medium (38) | ✅ Match | —        |
| 2026-03-21 | Hard   | %≤3: 49 · Fail: 0 · Avg: 3.52 | Medium (51) | Medium (55) | ✅ Match | ↑ Harder |
| 2026-03-22 | Basic  | %≤3: 62 · Fail: 1 · Avg: 3.35 | Medium (48) | Medium (40) | ✅ Match | ↓ Easier |
| 2026-03-23 | Medium | %≤3: 48 · Fail: 0 · Avg: 3.51 | Medium (50) | Basic (24)  | ❌ Miss  | —        |
| 2026-03-24 | Medium | %≤3: 34 · Fail: 8 · Avg: 3.91 | Hard (72)   | Medium (59) | ❌ Miss  | ↓ Easier |
| 2026-03-25 | Medium | %≤3: 83 · Fail: 3 · Avg: 2.83 | Medium (38) | Medium (33) | ✅ Match | —        |
| 2026-03-26 | Hard   | %≤3: 59 · Fail: 4 · Avg: 3.30 | Medium (51) | Hard (78)   | ❌ Miss  | ↑ Harder |
| 2026-03-27 | Medium | %≤3: 64 · Fail: 2 · Avg: 3.28 | Medium (47) | Medium (40) | ✅ Match | —        |
| 2026-03-28 | Medium | %≤3: 71 · Fail: 1 · Avg: 2.96 | Medium (38) | Medium (44) | ✅ Match | —        |
| 2026-03-29 | Basic  | %≤3: 90 · Fail: 1 · Avg: 2.72 | Basic (32)  | Basic (18)  | ✅ Match | —        |
| 2026-03-30 | Hard   | %≤3: 84 · Fail: 2 · Avg: 2.95 | Medium (39) | Medium (39) | ✅ Match | ↑ Harder |
| 2026-03-31 | Medium | %≤3: 74 · Fail: 0 · Avg: 3.20 | Medium (43) | Medium (52) | ✅ Match | —        |
| 2026-04-01 | Hard   | %≤3: 70 · Fail: 1 · Avg: 3.27 | Medium (46) | Medium (44) | ✅ Match | ↑ Harder |
| 2026-04-02 | Hard   | %≤3: 51 · Fail: 4 · Avg: 3.48 | Medium (56) | Hard (66)   | ❌ Miss  | ↑ Harder |
| 2026-04-03 | Medium | %≤3: 70 · Fail: 2 · Avg: 3.05 | Medium (42) | Hard (61)   | ❌ Miss  | —        |
| 2026-04-04 | Medium | %≤3: 75 · Fail: 2 · Avg: 3.14 | Medium (44) | Medium (43) | ✅ Match | —        |
| 2026-04-05 | Medium | %≤3: 56 · Fail: 1 · Avg: 3.41 | Medium (49) | Hard (62)   | ❌ Miss  | —        |
| 2026-04-06 | Basic  | %≤3: 97 · Fail: 0 · Avg: 2.19 | Basic (17)  | Basic (4)   | ✅ Match | —        |
| 2026-04-07 | Hard   | %≤3: 60 · Fail: 4 · Avg: 3.32 | Medium (51) | Medium (53) | ✅ Match | ↑ Harder |
| 2026-04-08 | Medium | %≤3: 82 · Fail: 1 · Avg: 2.91 | Medium (37) | Medium (33) | ✅ Match | —        |

**Accuracy: 21/27 (78%)** across puzzles with community stats.
<!-- BENCHMARK:END -->

# Matle Difficulty Scorer

Heuristic difficulty scoring for [Matle.io](https://matle.io) chess puzzles.

> [!NOTE]
> Since the source code of the core project is not public, this logic is written
> in JS to allow for client-side incorporation into the project if desired.

## How it works

`difficulty.js` scores each puzzle 0–100 based on board features:

| Feature                                | Effect                              |
| -------------------------------------- | ----------------------------------- |
| Defender pieces adjacent to mated king | Harder (passive blockers)           |
| Fewer total pieces                     | Harder (sparser board)              |
| King far from starting square          | Harder                              |
| Hidden checking pieces                 | Harder                              |
| Hidden empty squares                   | Harder (more combinatorial options) |
| Hidden squares far from mated king     | Harder                              |
| Pieces on starting squares             | Easier (obvious placement)          |
| King on castled square (g1/g8/c1/c8)   | Easier (trivially guessable)        |
| Pawns near home rank                   | Easier (predictable)                |
| Multiple easy-to-guess hidden pieces   | Easier (compound discount)          |

**Tiers:** Basic (<45) · Medium (45–74) · Hard (≥75)

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

### Last updated: 2026-03-20

| Date | Server | Actual Results | Actual Tier | Our Rating | Accuracy | Δ |
|------|--------|----------------|-------------|------------|----------|---|
| 2026-03-13 | Medium | %≤3: 97.0 · Fail: 0.0 · Avg: 2.00 | Basic | Basic (44) | ✅ Match | — |
| 2026-03-14 | Hard | %≤3: 80.0 · Fail: 0.0 · Avg: 2.72 | Medium | Medium (50) | ✅ Match | — |
| 2026-03-15 | Medium | %≤3: 90.0 · Fail: 0.0 · Avg: 2.06 | Basic | Medium (62) | ❌ Miss | ↑ Harder |
| 2026-03-16 | Hard | %≤3: 82.0 · Fail: 0.0 · Avg: 2.47 | Basic | Medium (47) | ❌ Miss | ↑ Harder |
| 2026-03-17 | Basic | %≤3: 98.0 · Fail: 0.0 · Avg: 1.76 | Basic | Basic (14) | ✅ Match | — |
| 2026-03-18 | Medium | %≤3: 96.0 · Fail: 0.0 · Avg: 1.88 | Basic | Basic (42) | ✅ Match | — |
| 2026-03-19 | Hard | %≤3: 81.0 · Fail: 0.0 · Avg: 2.68 | Medium | Medium (57) | ✅ Match | — |

**Accuracy: 5/7 (71%)** across puzzles with community stats.
<!-- BENCHMARK:END -->

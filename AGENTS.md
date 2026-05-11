# AGENTS.md

## Project Summary

This repository scores daily Matle puzzles using heuristics derived from the
published board state and community stats.

- `difficulty.js` is the main top-level code file and the primary place to look
  for scoring logic.
- Operational CLI scripts live under `utils/`.
- Local puzzle and stats snapshots live under `data/puzzles/` and `data/stats/`.
- The repo uses Node.js ESM (`"type": "module"`).

## Important Files

- `difficulty.js`: core difficulty features, scoring, calibration defaults, and
  notation/Lichess export helpers.
- `utils/fetch.js`: fetches recent puzzle and stats JSON into `data/`.
- `utils/benchmark.js`: scores local puzzles, updates `README.md`, and writes
  `benchmark-results.json` locally.
- `utils/calibrate.js`: searches for better calibration values and can write
  tuned defaults back into `difficulty.js`.
- `utils/notations.js`: prints a puzzle FEN, reconstructed PGN, and Lichess
  analysis URL for a given date.
- `utils/summary.js`: generates the GitHub Actions daily run summary.
- `.github/workflows/daily.yml`: daily automation for fetch, benchmark, summary,
  and commit.
- `README.md`: human-facing usage docs plus the generated benchmark section.

## Common Commands

Run these from the repo root:

```bash
npm install
npm run fetch
npm run fetch -- 7
npm run benchmark
npm run calibrate
npm run calibrate -- --prompt
npm run calibrate -- --apply
npm run notations -- 2026-04-24
npm run daily-summary
```

## Repo-Specific Guidance

- Prefer editing `difficulty.js` for scoring behavior changes. The `utils/`
  scripts are mostly orchestration and analysis tooling.
- `utils/benchmark.js` owns the `README.md` benchmark block between
  `<!-- BENCHMARK:START -->` and `<!-- BENCHMARK:END -->`. Do not hand-edit that
  section unless you are also changing the benchmark generator.
- `benchmark-results.json` and `calibration-results.json` are local/generated
  outputs and should stay ignored.
- The benchmark's community-ground-truth thresholds are intentionally sourced
  from `difficulty.js` (`TIER_BASIC_MAX`, `TIER_HARD_MIN`) and consumed in
  `utils/benchmark.js` so benchmark comparisons stay aligned with live tier
  boundaries.
- `utils/calibrate.js --apply` edits `difficulty.js` directly by replacing the
  calibration block bounded by `// CALIBRATION:START` and `// CALIBRATION:END`.
  Preserve those markers.
- Lichess export prefers reconstructed PGN when `Mainline` is valid and falls
  back to FEN otherwise.

## Validation Expectations

After changing behavior, prefer validating with the script that exercises that
path directly:

- scoring/README benchmark changes: `npm run benchmark`
- notation/Lichess changes: `npm run notations -- <date>`
- workflow summary changes: `npm run daily-summary`
- fetch changes: `npm run fetch -- 2`
- calibration changes: `npm run calibrate`

## Editing Notes

- Keep changes minimal and consistent with the current plain Node script style.
- Avoid moving core logic from `difficulty.js` into utilities unless there is a
  strong reason; the repo is intentionally organized so newcomers can start
  there.
- If a code, workflow, script, or repo-layout change affects user-facing or
  agent-facing guidance, update `README.md` and `AGENTS.md` as needed so both
  stay accurate.
- If `README.md` changes unexpectedly after running `npm run benchmark`, inspect
  `utils/benchmark.js` first rather than patching the generated section by hand.

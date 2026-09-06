import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractStats,
  actualDifficultyScore,
  actualTier,
} from "../utils/benchmark.js";
import {
  DEFAULT_CALIBRATION,
  extractDifficultyFeatures,
  scoreDifficultyFeatures,
} from "../difficulty.js";

const MOTIF_FEATURE_KEYS = [
  "ambiguousPawnPromotion",
  "deceptivePawnAnchorCluster",
  "anchoredKnightSimplification",
  "knightOnlyKingShellEase",
  "sparsePeripheralReveal",
  "crowdedAnomalyLoad",
  "sparseEndgameEase",
  "pawnlessSparseEndgame",
  "castledKingSparseEndgameEase",
  "sparseHiddenBishopMateEase",
  "dispersedAttackComplexity",
  "concealedKingHeavyAttack",
  "smotheredSupportMajor",
  "hiddenQueenMate",
  "hiddenRookCageMate",
  "concealedPawnQueenCageComplexity",
  "dualMajorHiddenKingCage",
  "overDeterminedBishopMate",
  "hiddenQueenBishopCageMate",
  "hiddenBishopMate",
  "visibleKingHiddenBishopMate",
  "concealedBishopNetComplexity",
  "concealedKnightCageMate",
  "decoyMajorKnightShellEase",
  "marchedKingKnightMate",
  "marchedKingPawnMate",
  "scatteredHiddenKingMate",
  "homeCagedKingMate",
  "visibleKingCongestion",
  "singleEasyGuessDense",
  "thresholdTacticalLift",
  "heavyHiddenMaterial",
  "heavyHiddenAchievementDamp",
  "ambiguousRoamingBlockers",
  "hiddenKingCagePressure",
];

const MOTIF_WEIGHT_KEYS = [
  "ambiguousRoamingBlockerWeight",
  "ambiguousPawnPromotionWeight",
  "deceptivePawnAnchorClusterWeight",
  "anchoredKnightSimplificationWeight",
  "knightOnlyKingShellEaseWeight",
  "sparsePeripheralRevealWeight",
  "crowdedAnomalyWeight",
  "excessAttackerWeight",
  "visibleKingCongestionWeight",
  "singleEasyGuessDenseWeight",
  "thresholdTacticalLiftWeight",
  "heavyHiddenAchievementDamp",
  "sparseEndgameEaseWeight",
  "pawnlessSparseEndgameWeight",
  "castledKingSparseEndgameEaseWeight",
  "sparseHiddenBishopMateEaseWeight",
  "dispersedAttackComplexityWeight",
  "concealedKingHeavyAttackWeight",
  "smotheredSupportMajorWeight",
  "hiddenQueenMateWeight",
  "hiddenRookCageMateWeight",
  "concealedPawnQueenCageComplexityWeight",
  "dualMajorHiddenKingCageWeight",
  "overDeterminedBishopMateWeight",
  "hiddenQueenBishopCageMateWeight",
  "hiddenBishopMateWeight",
  "visibleKingHiddenBishopMateWeight",
  "concealedBishopNetComplexityWeight",
  "concealedKnightCageMateWeight",
  "decoyMajorKnightShellEaseWeight",
  "marchedKingKnightMateWeight",
  "marchedKingPawnMateWeight",
  "scatteredHiddenKingMateWeight",
  "homeCagedKingMateWeight",
  "bothKingsBase",
  "bothKingsEmptyPenalty",
  "pawnNearHomeWeight",
];

test("extractStats treats percentages as fail-first [X, 1, 2, 3, 4, 5]", () => {
  const stats = extractStats({
    percentages: [10, 20, 30, 25, 10, 5],
  });

  assert.equal(stats.failPct, 10);
  assert.equal(stats.pctSolved3, 75);
  assert.equal(stats.avgGuesses, "2.80");
});

test("extractStats parses easy, typical, and hard community fixtures", () => {
  const easy = extractStats({ percentages: [0, 59, 39, 2, 0, 0] });
  assert.equal(easy.failPct, 0);
  assert.equal(easy.pctSolved3, 100);
  assert.equal(easy.avgGuesses, "1.43");

  const typical = extractStats({ percentages: [2, 16, 38, 32, 9, 3] });
  assert.equal(typical.failPct, 2);
  assert.equal(typical.pctSolved3, 86);
  assert.equal(typical.avgGuesses, "2.51");

  const hard = extractStats({ percentages: [19, 3, 4, 12, 36, 26] });
  assert.equal(hard.failPct, 19);
  assert.equal(hard.pctSolved3, 19);
  assert.equal(hard.avgGuesses, "4.35");
});

test("actualDifficultyScore recenters fail-first stats around a typical puzzle", () => {
  const easy = extractStats({ percentages: [0, 59, 39, 2, 0, 0] });
  assert.equal(actualDifficultyScore(easy), 18);
  assert.equal(actualTier(easy), "Basic");

  const typical = extractStats({ percentages: [2, 16, 38, 32, 9, 3] });
  assert.equal(actualDifficultyScore(typical), 53);
  assert.equal(actualTier(typical), "Medium");

  const historicalHard = extractStats({ percentages: [6, 4, 27, 34, 21, 8] });
  assert.equal(actualDifficultyScore(historicalHard), 80);
  assert.equal(actualTier(historicalHard), "Hard");

  const extreme = extractStats({ percentages: [19, 3, 4, 12, 36, 26] });
  assert.equal(actualDifficultyScore(extreme), 100);
  assert.equal(actualTier(extreme), "Hard");
});

test("extractDifficultyFeatures keeps continuous signals and omits motif flags", () => {
  const puzzle = JSON.parse(
    readFileSync("data/puzzles/2026-08-08.json", "utf8"),
  );
  const features = extractDifficultyFeatures(puzzle);
  assert.equal(features.error, undefined);

  for (const key of [
    "totalPieces",
    "avgHiddenDist",
    "mateNetAttackers",
    "hiddenEmpties",
    "bothKingsHidden",
    "matedKingHidden",
    "kingDist",
    "hiddenPieceCounts",
    "promotedHidden",
    "easyGuesses",
    "hiddenCheckers",
    "defenderBlockers",
    "kingZoneHiddenSquares",
    "kingZoneHiddenPieces",
    "kingZoneHiddenEmpties",
    "startingHome",
    "castledKings",
    "achievements",
    "sparseAttackProduct",
    "hiddenKingCage",
    "remainingUnknowns",
  ]) {
    assert.notEqual(features[key], undefined, `missing ${key}`);
  }

  for (const key of MOTIF_FEATURE_KEYS) {
    assert.equal(features[key], undefined, `unexpected motif feature ${key}`);
  }
});

test("remainingUnknowns counts hidden squares after easy anchors", () => {
  const puzzle = JSON.parse(
    readFileSync("data/puzzles/2026-08-08.json", "utf8"),
  );
  const features = extractDifficultyFeatures(puzzle);
  assert.equal(features.remainingUnknowns, 5 - features.easyGuesses);
});

test("live scorer keeps an easy historical puzzle Basic and a hard one Hard", () => {
  const easy = JSON.parse(readFileSync("data/puzzles/2026-08-08.json", "utf8"));
  const hard = JSON.parse(readFileSync("data/puzzles/2026-08-23.json", "utf8"));

  const easyScore = scoreDifficultyFeatures(extractDifficultyFeatures(easy));
  const hardScore = scoreDifficultyFeatures(extractDifficultyFeatures(hard));

  assert.equal(easyScore.tier, "Basic");
  assert.ok(easyScore.score < DEFAULT_CALIBRATION.basicMax);
  assert.equal(hardScore.tier, "Hard");
  assert.ok(hardScore.score >= DEFAULT_CALIBRATION.hardMin);
});

test("DEFAULT_CALIBRATION and score details omit motif-zoo weights", () => {
  for (const key of MOTIF_WEIGHT_KEYS) {
    assert.equal(
      DEFAULT_CALIBRATION[key],
      undefined,
      `unexpected motif weight ${key}`,
    );
  }

  const puzzle = JSON.parse(
    readFileSync("data/puzzles/2026-08-08.json", "utf8"),
  );
  const features = extractDifficultyFeatures(puzzle);
  const scored = scoreDifficultyFeatures(features);
  assert.equal(typeof scored.score, "number");
  assert.match(scored.tier, /^(Basic|Medium|Hard)$/);

  for (const key of MOTIF_FEATURE_KEYS) {
    assert.equal(
      scored.details[key],
      undefined,
      `unexpected motif detail ${key}`,
    );
  }
});

import { readFileSync, writeFileSync } from "node:fs";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  actualDifficultyScore,
  actualTier,
  loadLocalData,
} from "./benchmark.js";
import {
  DEFAULT_CALIBRATION,
  extractDifficultyFeatures,
  scoreDifficultyFeatures,
} from "./difficulty.js";

const OUTPUT_PATH = "calibration-results.json";
const SCALAR_SEARCH_SPACE = {
  pieceWeight: [0.8, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
  hiddenDistWeight: [4, 6, 8, 9, 10, 11, 12, 13, 14],
  attackerWeight: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
  emptyWeight: [-4, -3, -2, -1, 0, 1],
  bothKingsBase: [0, 2, 4, 6, 8],
  bothKingsEmptyPenalty: [0, 1, 2, 3, 4],
  promotedWeight: [0, 4, 6, 8, 10, 12],
  easyGuessDiscount: [0, 2, 4, 6, 8, 10],
  baseOffset: [0, 4, 8, 12, 14, 16, 18, 20],
  hiddenCheckerWeight: [-8, -6, -4, -2, 0, 2, 4, 6, 8],
  defenderBlockerWeight: [-8, -6, -4, -2, 0, 2, 4, 6, 8],
  kingDistWeight: [-4, -3, -2, -1, 0, 1, 2, 3, 4],
  startingHomeWeight: [-8, -6, -4, -2, 0, 2],
  castledKingWeight: [-8, -6, -4, -2, 0, 2],
  pawnNearHomeWeight: [-8, -6, -4, -2, 0, 2],
  sparseAttackerWeight: [-4, -3, -2, -1, 0, 1, 2, 3, 4],
  kingZoneHiddenWeight: [-4, -3, -2, -1, 0, 1, 2, 3, 4],
  kingZonePieceWeight: [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6],
  kingZoneEmptyWeight: [-6, -5, -4, -3, -2, -1, 0, 1],
  hiddenKingCageWeight: [0, 1, 2, 3, 4, 5, 6, 8],
  excessAttackerWeight: [-8, -6, -4, -2, 0, 2],
};
const MAP_WEIGHT_CANDIDATES = [-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10];
const HIDDEN_PIECE_TYPES = ["k", "q", "r", "b", "n", "p"];
const DIFFICULTY_PATH = "difficulty.js";
const APPLY_FLAG = "--apply";
const PROMPT_FLAG = "--prompt";

function buildDataset() {
  return loadLocalData({ includePuzzle: true })
    .map((row) => {
      const actualScore = actualDifficultyScore(row.stats);
      const actualTierValue = actualTier(row.stats);
      const features = extractDifficultyFeatures(row.puzzle);

      if (actualScore === null || !actualTierValue || features.error) {
        return null;
      }

      return {
        date: row.date,
        serverDiff: row.serverDiff,
        stats: row.stats,
        features,
        actualScore,
        actualTier: actualTierValue,
      };
    })
    .filter(Boolean);
}

function collectAchievementTags(dataset) {
  return [
    ...new Set(dataset.flatMap((item) => item.features.achievements)),
  ].sort();
}

function predictDataset(dataset, calibration) {
  return dataset.map((item) => {
    const predicted = scoreDifficultyFeatures(item.features, calibration);
    return {
      ...item,
      predictedScore: predicted.score,
      predictedDetails: predicted.details,
    };
  });
}

function newConfusionMatrix() {
  return {
    Basic: { Basic: 0, Medium: 0, Hard: 0 },
    Medium: { Basic: 0, Medium: 0, Hard: 0 },
    Hard: { Basic: 0, Medium: 0, Hard: 0 },
  };
}

function evaluatePredictions(predictions, calibration) {
  let matches = 0;
  let absError = 0;
  let squaredError = 0;
  const confusion = newConfusionMatrix();
  const misses = [];

  for (const item of predictions) {
    const predictedTier =
      item.predictedScore < calibration.basicMax
        ? "Basic"
        : item.predictedScore >= calibration.hardMin
          ? "Hard"
          : "Medium";
    const delta = item.predictedScore - item.actualScore;

    confusion[item.actualTier][predictedTier] += 1;
    absError += Math.abs(delta);
    squaredError += delta * delta;

    if (predictedTier === item.actualTier) {
      matches += 1;
      continue;
    }

    misses.push({
      date: item.date,
      predictedTier,
      predictedScore: item.predictedScore,
      actualTier: item.actualTier,
      actualScore: item.actualScore,
      scoreDelta: delta,
      pctSolved3: item.stats.pctSolved3,
      failPct: item.stats.failPct,
      avgGuesses: item.stats.avgGuesses,
      details: item.predictedDetails,
    });
  }

  const total = predictions.length;
  const accuracy = total ? matches / total : 0;
  return {
    total,
    matches,
    accuracy,
    accuracyPct: accuracy * 100,
    mae: total ? absError / total : 0,
    rmse: total ? Math.sqrt(squaredError / total) : 0,
    confusion,
    misses: misses.sort(
      (left, right) => Math.abs(right.scoreDelta) - Math.abs(left.scoreDelta),
    ),
  };
}

function optimizeThresholds(predictions, calibration) {
  let bestCalibration = { ...calibration };
  let bestMetrics = evaluatePredictions(predictions, bestCalibration);

  for (let basicMax = 20; basicMax <= 45; basicMax++) {
    for (let hardMin = basicMax + 5; hardMin <= 80; hardMin++) {
      const trial = { ...calibration, basicMax, hardMin };
      const metrics = evaluatePredictions(predictions, trial);
      if (isBetter(metrics, bestMetrics)) {
        bestCalibration = trial;
        bestMetrics = metrics;
      }
    }
  }

  return {
    calibration: bestCalibration,
    metrics: bestMetrics,
  };
}

function evaluateCalibration(dataset, calibration) {
  const predictions = predictDataset(dataset, calibration);
  return evaluatePredictions(predictions, calibration);
}

function isBetter(candidate, incumbent) {
  if (candidate.accuracy !== incumbent.accuracy) {
    return candidate.accuracy > incumbent.accuracy;
  }
  if (candidate.mae !== incumbent.mae) {
    return candidate.mae < incumbent.mae;
  }
  return candidate.rmse < incumbent.rmse;
}

function getNestedValue(obj, path) {
  return path.reduce((value, key) => value?.[key], obj);
}

function setNestedValue(obj, path, nextValue) {
  const clone = {
    ...obj,
    hiddenPieceWeights: { ...(obj.hiddenPieceWeights ?? {}) },
    achievementWeights: { ...(obj.achievementWeights ?? {}) },
  };

  let target = clone;
  for (let index = 0; index < path.length - 1; index++) {
    target = target[path[index]];
  }
  target[path[path.length - 1]] = nextValue;
  return clone;
}

function buildSearchParameters(dataset) {
  const achievementTags = collectAchievementTags(dataset);
  const parameters = Object.entries(SCALAR_SEARCH_SPACE).map(
    ([key, candidates]) => ({
      path: [key],
      label: key,
      candidates,
    }),
  );

  for (const type of HIDDEN_PIECE_TYPES) {
    parameters.push({
      path: ["hiddenPieceWeights", type],
      label: `hiddenPieceWeights.${type}`,
      candidates: MAP_WEIGHT_CANDIDATES,
    });
  }

  for (const tag of achievementTags) {
    parameters.push({
      path: ["achievementWeights", tag],
      label: `achievementWeights.${tag}`,
      candidates: MAP_WEIGHT_CANDIDATES,
    });
  }

  return parameters;
}

function buildParameterOrders(parameters) {
  const orders = [];
  orders.push(parameters);
  orders.push([...parameters].reverse());

  if (parameters.length > 4) {
    const rotation = Math.floor(parameters.length / 3);
    orders.push([
      ...parameters.slice(rotation),
      ...parameters.slice(0, rotation),
    ]);
    orders.push([
      ...parameters.filter((parameter) =>
        parameter.label.startsWith("achievementWeights."),
      ),
      ...parameters.filter((parameter) =>
        parameter.label.startsWith("hiddenPieceWeights."),
      ),
      ...parameters.filter(
        (parameter) =>
          !parameter.label.startsWith("achievementWeights.") &&
          !parameter.label.startsWith("hiddenPieceWeights."),
      ),
    ]);
  }

  return orders;
}

function tuneCalibration(dataset, initialCalibration) {
  const parameters = buildSearchParameters(dataset);
  let bestRun = null;

  for (const parameterOrder of buildParameterOrders(parameters)) {
    const history = [];
    let bestCalibration = { ...initialCalibration };
    let bestPredictions = predictDataset(dataset, bestCalibration);
    let thresholdSearch = optimizeThresholds(bestPredictions, bestCalibration);
    bestCalibration = thresholdSearch.calibration;
    let bestMetrics = thresholdSearch.metrics;

    for (let pass = 1; pass <= 5; pass++) {
      let improved = false;

      for (const parameter of parameterOrder) {
        let candidateCalibration = bestCalibration;
        let candidatePredictions = bestPredictions;
        let candidateMetrics = bestMetrics;
        const currentValue = getNestedValue(bestCalibration, parameter.path);

        for (const value of parameter.candidates) {
          if (value === currentValue) {
            continue;
          }

          const trial = setNestedValue(bestCalibration, parameter.path, value);
          const predictions = predictDataset(dataset, trial);
          const optimized = optimizeThresholds(predictions, trial);

          if (isBetter(optimized.metrics, candidateMetrics)) {
            candidateCalibration = optimized.calibration;
            candidatePredictions = predictions;
            candidateMetrics = optimized.metrics;
          }
        }

        if (candidateCalibration !== bestCalibration) {
          history.push({
            pass,
            parameter: parameter.label,
            from: currentValue,
            to: getNestedValue(candidateCalibration, parameter.path),
            basicMax: candidateCalibration.basicMax,
            hardMin: candidateCalibration.hardMin,
            accuracyPct: Number(candidateMetrics.accuracyPct.toFixed(2)),
            mae: Number(candidateMetrics.mae.toFixed(2)),
            rmse: Number(candidateMetrics.rmse.toFixed(2)),
          });
          bestCalibration = candidateCalibration;
          bestPredictions = candidatePredictions;
          bestMetrics = candidateMetrics;
          improved = true;
        }
      }

      if (!improved) {
        break;
      }
    }

    const run = {
      calibration: bestCalibration,
      metrics: bestMetrics,
      history,
    };
    if (!bestRun || isBetter(run.metrics, bestRun.metrics)) {
      bestRun = run;
    }
  }

  return bestRun;
}

function formatMetrics(label, metrics) {
  return `${label}: ${metrics.matches}/${metrics.total} (${metrics.accuracyPct.toFixed(0)}%) | MAE ${metrics.mae.toFixed(2)} | RMSE ${metrics.rmse.toFixed(2)}`;
}

function printConfusionMatrix(title, confusion) {
  console.log(title);
  console.log("Actual\\Pred  Basic  Medium  Hard");
  for (const tier of ["Basic", "Medium", "Hard"]) {
    const row = confusion[tier];
    console.log(
      `${tier.padEnd(11)} ${String(row.Basic).padEnd(6)} ${String(row.Medium).padEnd(7)} ${String(row.Hard).padEnd(4)}`,
    );
  }
}

function printTopMisses(title, misses) {
  console.log(title);
  for (const miss of misses.slice(0, 5)) {
    console.log(
      `  ${miss.date}: predicted ${miss.predictedTier} (${miss.predictedScore}) vs actual ${miss.actualTier} (${miss.actualScore}) | %≤3 ${miss.pctSolved3} | fail ${miss.failPct} | avg ${miss.avgGuesses}`,
    );
  }
}

function formatCalibrationObject(calibration) {
  return JSON.stringify(calibration, null, 2).replace(
    /"([A-Za-z_$][\w$]*)":/g,
    "$1:",
  );
}

function applyCalibrationToDifficulty(calibration) {
  const difficultySource = readFileSync(DIFFICULTY_PATH, "utf8");
  const nextBlock = `// CALIBRATION:START\nexport const DEFAULT_CALIBRATION = Object.freeze(${formatCalibrationObject(calibration)});\n// CALIBRATION:END`;

  if (
    !difficultySource.includes("// CALIBRATION:START") ||
    !difficultySource.includes("// CALIBRATION:END")
  ) {
    throw new Error("difficulty.js is missing calibration markers");
  }

  const updated = difficultySource.replace(
    /\/\/ CALIBRATION:START[\s\S]*?\/\/ CALIBRATION:END/,
    nextBlock,
  );
  writeFileSync(DIFFICULTY_PATH, updated);
}

async function confirmApply() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      "Apply tuned calibration to difficulty.js live defaults? [y/N] ",
    );
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main() {
  const dataset = buildDataset();
  if (!dataset.length) {
    console.log("No puzzles with community stats found to calibrate.");
    process.exit(0);
  }

  const baselineCalibration = { ...DEFAULT_CALIBRATION };
  const baselineMetrics = evaluateCalibration(dataset, baselineCalibration);
  const tuned = tuneCalibration(dataset, baselineCalibration);

  console.log(formatMetrics("Baseline", baselineMetrics));
  printConfusionMatrix("Baseline confusion matrix", baselineMetrics.confusion);
  printTopMisses("Baseline top misses", baselineMetrics.misses);
  console.log("");
  console.log(formatMetrics("Tuned", tuned.metrics));
  printConfusionMatrix("Tuned confusion matrix", tuned.metrics.confusion);
  printTopMisses("Tuned top misses", tuned.metrics.misses);
  console.log("");
  console.log("Recommended calibration:");
  console.log(JSON.stringify(tuned.calibration, null, 2));

  const shouldApply = process.argv.includes(APPLY_FLAG);
  const shouldPrompt = process.argv.includes(PROMPT_FLAG);
  let applied = false;

  if (shouldApply || (shouldPrompt && (await confirmApply()))) {
    applyCalibrationToDifficulty(tuned.calibration);
    applied = true;
    console.log("\nApplied tuned calibration to difficulty.js live defaults.");
  } else if (shouldPrompt) {
    console.log("\nSkipped applying tuned calibration.");
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sampleSize: dataset.length,
    baselineCalibration,
    baselineMetrics,
    targetAccuracyPct: 95,
    tunedCalibration: tuned.calibration,
    tunedMetrics: tuned.metrics,
    applied,
    history: tuned.history,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nSaved calibration summary → ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

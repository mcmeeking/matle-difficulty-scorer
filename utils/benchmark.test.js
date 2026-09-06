import test from "node:test";
import assert from "node:assert/strict";
import { extractStats } from "./benchmark.js";

test("extractStats keeps legacy positional percentages behavior", () => {
  const stats = extractStats({ percentages: [3, 5, 10, 35, 24, 23] });
  assert.deepEqual(stats, {
    pctSolved3: 18,
    failPct: 23,
    avgGuesses: "4.41",
    total: "(pct)",
  });
});

test("extractStats honors labeled reordered percentages", () => {
  const stats = extractStats({
    percentages: [35, 24, 23, 3, 5, 10],
    labels: ["4", "5", "X", "1", "2", "3"],
  });
  assert.deepEqual(stats, {
    pctSolved3: 18,
    failPct: 23,
    avgGuesses: "4.41",
    total: "(pct)",
  });
});

test("extractStats fills missing labeled buckets as zero", () => {
  const stats = extractStats({
    percentages: [35, 24, 3, 5, 10],
    labels: ["4", "5", "1", "2", "3"],
  });
  assert.deepEqual(stats, {
    pctSolved3: 18,
    failPct: 0,
    avgGuesses: "3.94",
    total: "(pct)",
  });
});

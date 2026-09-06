import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStats } from "../utils/benchmark.js";

test("extractStats treats percentages as fail-first [X, 1, 2, 3, 4, 5]", () => {
  const stats = extractStats({
    percentages: [10, 20, 30, 25, 10, 5],
  });

  assert.equal(stats.failPct, 10);
  assert.equal(stats.pctSolved3, 75);
  assert.equal(stats.avgGuesses, "2.80");
});

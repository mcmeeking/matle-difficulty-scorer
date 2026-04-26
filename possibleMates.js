/**
 * "All possible mates" difficulty signal.
 *
 * Given a Matle puzzle (full board + 5 hidden squares), this module enumerates
 * every plausible content for the hidden squares and counts how many distinct
 * arrangements still produce a checkmate position. The intuition (issue
 * `Investigate "all possible mates" difficulty rating`) is that the more
 * alternative checkmates fit the visible position, the harder the puzzle is.
 *
 * Performance is bounded by a candidate budget — the search prunes obvious
 * dead-ends (illegal king counts, pawns on the back rank, mated king not in
 * check, side-not-to-move illegally in check) before spending time on the
 * full chess.js checkmate verification.
 */
import { Chess } from "chess.js";
import {
  ALL_SQUARES,
  attacks,
  fr,
  parseBoardMap,
  toSq,
} from "./difficulty.js";

const COLORS = ["w", "b"];
const PIECE_TYPES = ["k", "q", "r", "b", "n", "p"];

/**
 * Per-colour starting piece counts. Real games almost never exceed these
 * (a third queen / fourth rook is theoretically possible via promotion but
 * vanishingly rare in practice), so they form a useful "reasonableness"
 * bracket for shrinking the candidate pool.
 */
const STARTING_COUNTS = { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };

/** Build a FEN string directly from a square→piece map. */
function mapToFen(boardMap, turn) {
  const ranks = [];
  for (let r = 7; r >= 0; r--) {
    let line = "";
    let gap = 0;
    for (let f = 0; f < 8; f++) {
      const p = boardMap[toSq(f, r)];
      if (!p) {
        gap++;
      } else {
        if (gap) {
          line += gap;
          gap = 0;
        }
        line += p.color === "w" ? p.type.toUpperCase() : p.type;
      }
    }
    if (gap) line += gap;
    ranks.push(line);
  }
  return ranks.join("/") + ` ${turn} - - 0 1`;
}

/** Allowed contents for a hidden square (empty or any piece, minus illegal pawns). */
function squareCandidates(sq) {
  const [, rank] = fr(sq);
  const cands = [null]; // empty
  for (const color of COLORS) {
    for (const type of PIECE_TYPES) {
      if (type === "p" && (rank === 0 || rank === 7)) continue;
      cands.push({ type, color });
    }
  }
  return cands;
}

function findKing(boardMap, color) {
  for (const sq of ALL_SQUARES) {
    const p = boardMap[sq];
    if (p && p.type === "k" && p.color === color) return sq;
  }
  return null;
}

function isAttackedBy(boardMap, targetSq, attackerColor) {
  for (const sq of ALL_SQUARES) {
    const p = boardMap[sq];
    if (!p || p.color !== attackerColor) continue;
    if (attacks(p, sq, targetSq, boardMap)) return true;
  }
  return false;
}

/** Find the side that's checkmated in the given full position, or null. */
function detectMatedColor(boardMap) {
  for (const turn of COLORS) {
    try {
      const c = new Chess();
      c.load(mapToFen(boardMap, turn), { skipValidation: true });
      if (c.isCheckmate()) return turn;
    } catch {
      /* try the other side */
    }
  }
  return null;
}

/**
 * Count mate-equivalent arrangements consistent with the visible board.
 *
 * @param {{Board: string, HiddenSquares: string[]}} puzzle
 * @param {{maxCandidates?: number, reasonable?: boolean}} [options]
 *   `reasonable` (default `true`) caps each colour's piece counts at the
 *   starting counts ({k:1, q:1, r:2, b:2, n:2, p:8}). Set `false` to allow
 *   theoretically-possible promotion stacks (e.g. three queens).
 * @returns {{count: number, examined: number, capped: boolean,
 *            matedColor: string} | {error: string}}
 */
export function countPossibleMates(puzzle, options = {}) {
  const { maxCandidates = 500_000, reasonable = true } = options;
  const { Board: boardStr, HiddenSquares: hidden } = puzzle ?? {};

  if (!boardStr || !Array.isArray(hidden) || hidden.length !== 5) {
    return {
      error: "Invalid puzzle: need Board and exactly 5 HiddenSquares",
    };
  }

  const fullMap = parseBoardMap(boardStr);
  const matedColor = detectMatedColor(fullMap);
  if (!matedColor) {
    return { error: "Position is not checkmate for either side" };
  }
  const attackerColor = matedColor === "w" ? "b" : "w";

  // Strip the hidden squares from the visible board — that's all the solver
  // truly knows when staring at a Matle puzzle.
  const hiddenSet = new Set(hidden);
  const visibleMap = {};
  const visibleCounts = {
    w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
  };
  for (const sq of ALL_SQUARES) {
    const p = fullMap[sq];
    if (!p || hiddenSet.has(sq)) continue;
    visibleMap[sq] = p;
    visibleCounts[p.color][p.type]++;
  }
  if (visibleCounts.w.k > 1 || visibleCounts.b.k > 1) {
    return { error: "Visible board has more than one king of a colour" };
  }

  // Per-colour caps for the "reasonable" bracket: starting counts minus what
  // the visible board already accounts for. Non-positive caps prune the type
  // entirely. Kings are always capped at 1 regardless of the flag.
  const remainingCaps = { w: {}, b: {} };
  for (const color of COLORS) {
    for (const type of PIECE_TYPES) {
      const cap = reasonable || type === "k" ? STARTING_COUNTS[type] : Infinity;
      remainingCaps[color][type] = cap - visibleCounts[color][type];
    }
  }

  const perSquare = hidden.map(squareCandidates);
  const placement = new Array(hidden.length).fill(null);
  // Working counts of pieces *placed on hidden squares so far*. Combined with
  // `remainingCaps` they enforce the reasonableness bracket.
  const placedCounts = {
    w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  let count = 0;
  let examined = 0;
  let capped = false;

  const recurse = (i, workingMap) => {
    if (capped) return;
    if (i === hidden.length) {
      examined++;
      if (examined > maxCandidates) {
        capped = true;
        return;
      }
      // Need exactly one king of each colour for a loadable mate position.
      const wKings = visibleCounts.w.k + placedCounts.w.k;
      const bKings = visibleCounts.b.k + placedCounts.b.k;
      if (wKings !== 1 || bKings !== 1) return;

      const matedKingSq = findKing(workingMap, matedColor);
      const otherKingSq = findKing(workingMap, attackerColor);
      if (!matedKingSq || !otherKingSq) return;

      // Cheap pre-filters before spending a chess.js verification:
      //   1. The mated king must actually be in check.
      //   2. The side not to move must not be in check (illegal position).
      if (!isAttackedBy(workingMap, matedKingSq, attackerColor)) return;
      if (isAttackedBy(workingMap, otherKingSq, matedColor)) return;

      try {
        const c = new Chess();
        c.load(mapToFen(workingMap, matedColor), { skipValidation: true });
        if (c.isCheckmate()) count++;
      } catch {
        /* not a loadable position — skip */
      }
      return;
    }

    const sq = hidden[i];
    for (const cand of perSquare[i]) {
      if (cand) {
        // Reasonableness / king-uniqueness bracket: skip any placement that
        // would push this colour's count of this piece type above the cap.
        if (placedCounts[cand.color][cand.type] >= remainingCaps[cand.color][cand.type]) {
          continue;
        }
        placedCounts[cand.color][cand.type]++;
        workingMap[sq] = cand;
      } else {
        delete workingMap[sq];
      }
      placement[i] = cand;

      recurse(i + 1, workingMap);

      if (cand) placedCounts[cand.color][cand.type]--;
      // `sq` is a hidden square and therefore never present in `visibleMap`,
      // so unconditionally clearing it correctly restores the pre-call state.
      delete workingMap[sq];
      if (capped) return;
    }
  };

  recurse(0, { ...visibleMap });

  return { count, examined, capped, matedColor };
}

// Re-export helpers to keep an explicit module-level surface for tooling.
export { mapToFen, squareCandidates };

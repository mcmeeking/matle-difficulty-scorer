import { Chess } from "chess.js";

// ── All 64 squares (manual list – no Chess.SQUARES dependency) ───
const FILES = "abcdefgh";
const ALL_SQUARES = [];
for (let f = 0; f < 8; f++) {
  for (let r = 1; r <= 8; r++) {
    ALL_SQUARES.push(FILES[f] + r);
  }
}

// ── Starting-position lookup ─────────────────────────────────────
const STARTING = {};
{
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let f = 0; f < 8; f++) {
    const file = FILES[f];
    STARTING[file + "1"] = { type: back[f], color: "w" };
    STARTING[file + "2"] = { type: "p", color: "w" };
    STARTING[file + "7"] = { type: "p", color: "b" };
    STARTING[file + "8"] = { type: back[f], color: "b" };
  }
}
// ── Common / easily-guessable positions ──────────────────────
const CASTLED_KING = new Set(["g1", "c1", "g8", "c8"]);

/** Pawn home ranks: white pawns start on rank 2, black on rank 7. */
function pawnHomeRank(color) {
  return color === "w" ? 1 : 6;
} // 0-indexed
// ── Coordinate helpers ───────────────────────────────────────────
function fr(sq) {
  return [sq.charCodeAt(0) - 97, +sq[1] - 1]; // [file 0-7, rank 0-7]
}

function toSq(f, r) {
  return FILES[f] + (r + 1);
}

function chebyshev(a, b) {
  const [af, ar] = fr(a);
  const [bf, br] = fr(b);
  return Math.max(Math.abs(af - bf), Math.abs(ar - br));
}

// ── Board parsing ────────────────────────────────────────────────

/** Parse the Matle "Board" string into a { [square]: {type, color} } map. */
function parseBoardMap(boardStr) {
  const map = {};
  const rows = boardStr.split("\n").filter((l) => l.trim());
  for (let row = 0; row < 8; row++) {
    const cells = rows[row].trim().split(/\s+/);
    for (let col = 0; col < 8; col++) {
      const ch = cells[col];
      if (ch !== ".") {
        map[toSq(col, 7 - row)] = {
          type: ch.toLowerCase(),
          color: ch === ch.toUpperCase() ? "w" : "b",
        };
      }
    }
  }
  return map;
}

/** Convert the Matle board string to a FEN with the given side to move. */
export function boardToFen(boardStr, turn) {
  const rows = boardStr.split("\n").filter((l) => l.trim());
  const fenRanks = [];
  for (const line of rows) {
    const cells = line.trim().split(/\s+/);
    let fen = "";
    let gap = 0;
    for (const ch of cells) {
      if (ch === ".") {
        gap++;
      } else {
        if (gap) {
          fen += gap;
          gap = 0;
        }
        fen += ch;
      }
    }
    if (gap) fen += gap;
    fenRanks.push(fen);
  }
  return fenRanks.join("/") + ` ${turn} - - 0 1`;
}

export function inferCheckmatedSide(boardStr) {
  for (const turn of ["w", "b"]) {
    try {
      const chess = new Chess();
      chess.load(boardToFen(boardStr, turn), { skipValidation: true });
      if (chess.isCheckmate()) {
        return turn;
      }
    } catch {
      /* try the other side */
    }
  }

  return null;
}

export function fenToLichessAnalysisUrl(fen) {
  return `https://lichess.org/analysis/${fen.trim().replaceAll(" ", "_")}`;
}

export function pgnToLichessAnalysisUrl(pgn) {
  const encoded = encodeURIComponent(pgn.trim()).replaceAll("%20", "_");
  return `https://lichess.org/analysis/pgn/${encoded}`;
}

function parseUciMove(uci) {
  if (typeof uci !== "string" || (uci.length !== 4 && uci.length !== 5)) {
    return null;
  }

  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  };
}

function normalizePgn(pgn) {
  return pgn.replace(/\s+/g, " ").trim();
}

function sanMovesToPgn(sanMoves) {
  const parts = [];

  for (let i = 0; i < sanMoves.length; i += 2) {
    parts.push(`${Math.floor(i / 2) + 1}. ${sanMoves[i]}`);
    if (sanMoves[i + 1]) {
      parts.push(sanMoves[i + 1]);
    }
  }

  parts.push("*");
  return parts.join(" ");
}

export function mainlineToPgn(mainline) {
  if (!Array.isArray(mainline) || mainline.length === 0) {
    return { error: "Invalid puzzle: need non-empty Mainline" };
  }

  const chess = new Chess();
  for (const uci of mainline) {
    const move = parseUciMove(uci);
    if (!move) {
      return { error: `Invalid UCI move: ${uci}` };
    }

    const played = chess.move(move);
    if (!played) {
      return { error: `Illegal UCI move: ${uci}` };
    }
  }

  return {
    pgn: normalizePgn(sanMovesToPgn(chess.history())),
    replayFen: chess.fen(),
    moveCount: mainline.length,
  };
}

export function puzzleToFen(puzzle) {
  const boardStr = puzzle?.Board;
  if (!boardStr) {
    return { error: "Invalid puzzle: need Board" };
  }

  const turn = inferCheckmatedSide(boardStr);
  if (!turn) {
    return { error: "Position is not checkmate for either side" };
  }

  return {
    fen: boardToFen(boardStr, turn),
    turn,
  };
}

export function puzzleToPgn(puzzle) {
  const boardResult = puzzleToFen(puzzle);
  if (boardResult.error) {
    return boardResult;
  }

  const mainlineResult = mainlineToPgn(puzzle?.Mainline);
  if (mainlineResult.error) {
    return mainlineResult;
  }

  const [replayBoard, replayTurn] = mainlineResult.replayFen.split(" ");
  const [targetBoard, targetTurn] = boardResult.fen.split(" ");
  if (replayBoard !== targetBoard || replayTurn !== targetTurn) {
    return {
      error: "Mainline does not reconstruct the published puzzle position",
    };
  }

  return {
    pgn: mainlineResult.pgn,
    moveCount: mainlineResult.moveCount,
  };
}

export function puzzleToLichessAnalysis(puzzle) {
  const fenResult = puzzleToFen(puzzle);
  if (fenResult.error) {
    return fenResult;
  }

  const pgnResult = puzzleToPgn(puzzle);
  if (!pgnResult.error) {
    return {
      ...fenResult,
      ...pgnResult,
      url: pgnToLichessAnalysisUrl(pgnResult.pgn),
      urlMode: "pgn",
      fenUrl: fenToLichessAnalysisUrl(fenResult.fen),
    };
  }

  return {
    ...fenResult,
    url: fenToLichessAnalysisUrl(fenResult.fen),
    urlMode: "fen",
    pgnError: pgnResult.error,
  };
}

// ── Attack detection (manual – no engine dependency) ─────────────

function lineClear(ff, fRank, tf, tRank, boardMap) {
  const sf = Math.sign(tf - ff);
  const sr = Math.sign(tRank - fRank);
  let f = ff + sf;
  let r = fRank + sr;
  while (f !== tf || r !== tRank) {
    if (boardMap[toSq(f, r)]) return false;
    f += sf;
    r += sr;
  }
  return true;
}

/** Does `piece` sitting on `fromSq` attack `targetSq`? */
function attacks(piece, fromSq, targetSq, boardMap) {
  const [ff, fRank] = fr(fromSq);
  const [tf, tRank] = fr(targetSq);
  const df = tf - ff;
  const dr = tRank - fRank;
  if (!df && !dr) return false;

  switch (piece.type) {
    case "p":
      return Math.abs(df) === 1 && dr === (piece.color === "w" ? 1 : -1);
    case "n":
      return (
        (Math.abs(df) === 1 && Math.abs(dr) === 2) ||
        (Math.abs(df) === 2 && Math.abs(dr) === 1)
      );
    case "k":
      return Math.abs(df) <= 1 && Math.abs(dr) <= 1;
    case "b":
      return (
        Math.abs(df) === Math.abs(dr) &&
        lineClear(ff, fRank, tf, tRank, boardMap)
      );
    case "r":
      return (
        (df === 0 || dr === 0) && lineClear(ff, fRank, tf, tRank, boardMap)
      );
    case "q":
      return (
        (Math.abs(df) === Math.abs(dr) || df === 0 || dr === 0) &&
        lineClear(ff, fRank, tf, tRank, boardMap)
      );
    default:
      return false;
  }
}

// ── Shared tier thresholds ────────────────────────────────────────
// CALIBRATION:START
export const DEFAULT_CALIBRATION = Object.freeze({
  basicMax: 34,
  hardMin: 67,
  pieceWeight: 1.2,
  hiddenDistWeight: 9,
  attackerWeight: 4,
  emptyWeight: 1,
  bothKingsBase: 0,
  bothKingsEmptyPenalty: 2,
  promotedWeight: 8,
  easyGuessDiscount: 2,
  baseOffset: 12,
  hiddenCheckerWeight: 2,
  defenderBlockerWeight: -6,
  ambiguousRoamingBlockerWeight: 8,
  kingDistWeight: -1,
  startingHomeWeight: -2,
  castledKingWeight: 2,
  pawnNearHomeWeight: 0,
  sparseAttackerWeight: 1,
  kingZoneHiddenWeight: -1,
  kingZonePieceWeight: 1,
  kingZoneEmptyWeight: -2,
  hiddenKingCageWeight: 3,
  ambiguousPawnPromotionWeight: 26,
  sparsePeripheralRevealWeight: -4,
  crowdedAnomalyWeight: 4,
  excessAttackerWeight: -2,
  hiddenPieceWeights: {
    k: 2,
    q: 4,
    r: 4,
    b: -2,
    n: -2,
    p: 0,
  },
  achievementWeights: {
    bishop: 2,
    "double-check": 10,
    knight: 10,
    pawn: -8,
    pin: 8,
    queen: 2,
    rook: -4,
    "two-kings": -10,
    discovered: 4,
  },
});
// CALIBRATION:END

export const TIER_BASIC_MAX = DEFAULT_CALIBRATION.basicMax; // Basic:  score < 34  (0–33)
export const TIER_HARD_MIN = DEFAULT_CALIBRATION.hardMin; // Hard:   score >= 67 (67–100)
// Medium: 34–66

function resolveCalibration(calibration) {
  return {
    ...DEFAULT_CALIBRATION,
    ...(calibration ?? {}),
    hiddenPieceWeights: {
      ...DEFAULT_CALIBRATION.hiddenPieceWeights,
      ...(calibration?.hiddenPieceWeights ?? {}),
    },
    achievementWeights: {
      ...DEFAULT_CALIBRATION.achievementWeights,
      ...(calibration?.achievementWeights ?? {}),
    },
  };
}

export function tierFromScore(score, calibration = DEFAULT_CALIBRATION) {
  const tuned = resolveCalibration(calibration);
  if (score < tuned.basicMax) return "Basic";
  if (score >= tuned.hardMin) return "Hard";
  return "Medium";
}

// ── Main export ──────────────────────────────────────────────────

/**
 * Calculate a 0-100 difficulty score for a Matle puzzle.
 *
 * @param {{Board: string, HiddenSquares: string[]}} puzzle
 * @returns {object | {error: string}}
 */
export function extractDifficultyFeatures(puzzle) {
  try {
    const { Board: boardStr, HiddenSquares: hidden } = puzzle;

    if (!boardStr || !Array.isArray(hidden) || hidden.length !== 5) {
      return {
        error: "Invalid puzzle: need Board and exactly 5 HiddenSquares",
      };
    }

    const boardMap = parseBoardMap(boardStr);

    // ── Detect checkmate via chess.js ────────────────────────────
    const matedColor = inferCheckmatedSide(boardStr);
    if (!matedColor) {
      return { error: "Position is not checkmate for either side" };
    }

    // ── Locate mated king ────────────────────────────────────────
    let kingSq = null;
    for (const sq of ALL_SQUARES) {
      const p = boardMap[sq];
      if (p && p.type === "k" && p.color === matedColor) {
        kingSq = sq;
        break;
      }
    }
    if (!kingSq) return { error: "Mated king not found on board" };

    // ── Feature extraction ───────────────────────────────────────
    const attackerColor = matedColor === "w" ? "b" : "w";
    const hiddenSet = new Set(hidden);
    const hiddenPieceCounts = { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 };
    const easyGuessSquares = new Set();
    let startingHome = 0;
    let castledKings = 0;
    let pawnsNearHome = 0;
    let defenderBlockers = 0;
    let guessableDefenderBlockers = 0;
    let hiddenEmpties = 0;
    let hiddenCheckers = 0;
    let kingZoneHiddenSquares = 0;
    let kingZoneHiddenEmpties = 0;
    let peripheralHiddenSquares = 0;
    let distSum = 0;

    for (const sq of hidden) {
      const pc = boardMap[sq];
      const kingDistance = chebyshev(sq, kingSq);
      distSum += kingDistance;

      if (kingDistance <= 1) {
        kingZoneHiddenSquares++;
      } else {
        peripheralHiddenSquares++;
      }

      if (!pc) {
        hiddenEmpties++;
        if (kingDistance <= 1) {
          kingZoneHiddenEmpties++;
        }
        continue;
      }

      hiddenPieceCounts[pc.type] = (hiddenPieceCounts[pc.type] || 0) + 1;

      // Piece on its starting square?
      const home = STARTING[sq];
      if (home && home.type === pc.type && home.color === pc.color) {
        startingHome++;
        easyGuessSquares.add(sq);
      }

      // King on castled square (g1/g8/c1/c8) – trivially guessable
      if (pc.type === "k" && CASTLED_KING.has(sq)) {
        castledKings++;
        easyGuessSquares.add(sq);
      }

      // Pawn within 1 rank of its home rank – very common, easy to guess
      if (pc.type === "p") {
        const [, rank] = fr(sq);
        if (Math.abs(rank - pawnHomeRank(pc.color)) <= 1) {
          pawnsNearHome++;
          easyGuessSquares.add(sq);
        }
      }

      // Same-colour (defender) piece adjacent to mated king?
      if (pc.color === matedColor && chebyshev(sq, kingSq) === 1) {
        defenderBlockers++;
        const home = STARTING[sq];
        if (home && home.type === pc.type && home.color === pc.color) {
          guessableDefenderBlockers++;
        }
      }

      // Opponent piece that checks the mated king?
      if (pc.color === attackerColor && attacks(pc, sq, kingSq, boardMap))
        hiddenCheckers++;
    }

    let totalPieces = 0;
    for (const sq of ALL_SQUARES) {
      if (boardMap[sq]) totalPieces++;
    }

    const kingHome = matedColor === "w" ? "e1" : "e8";
    const kingDist = chebyshev(kingSq, kingHome);
    const avgHiddenDist = distSum / hidden.length;
    const kingZoneHiddenPieces = kingZoneHiddenSquares - kingZoneHiddenEmpties;
    const matedKingHidden = hiddenSet.has(kingSq) ? 1 : 0;
    const roamingDefenderBlockers =
      defenderBlockers - guessableDefenderBlockers;

    // ── Both kings hidden ────────────────────────────────────────
    let wKingSq = null,
      bKingSq = null;
    for (const sq of ALL_SQUARES) {
      const p = boardMap[sq];
      if (p && p.type === "k") {
        if (p.color === "w") wKingSq = sq;
        else bKingSq = sq;
      }
    }
    const bothKingsHidden =
      wKingSq && bKingSq && hiddenSet.has(wKingSq) && hiddenSet.has(bKingSq)
        ? 1
        : 0;

    // ── Promoted pieces hidden ───────────────────────────────────
    const STARTING_COUNTS = { q: 1, r: 2, b: 2, n: 2, p: 8, k: 1 };
    const pieceCounts = { w: {}, b: {} };
    for (const sq of ALL_SQUARES) {
      const p = boardMap[sq];
      if (p) {
        pieceCounts[p.color][p.type] = (pieceCounts[p.color][p.type] || 0) + 1;
      }
    }
    let promotedHidden = 0;
    for (const color of ["w", "b"]) {
      for (const type of ["q", "r", "b", "n"]) {
        const excess = (pieceCounts[color][type] || 0) - STARTING_COUNTS[type];
        if (excess > 0) {
          let hiddenOfType = 0;
          for (const sq of hidden) {
            const p = boardMap[sq];
            if (p && p.type === type && p.color === color) hiddenOfType++;
          }
          promotedHidden += Math.min(excess, hiddenOfType);
        }
      }
    }

    // ── Mate-net attackers ───────────────────────────────────────
    // Count attacker pieces that control the king zone (king sq + adj)
    const kingZone = [kingSq];
    const [kf, kr] = fr(kingSq);
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const nf = kf + df,
          nr = kr + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
          kingZone.push(toSq(nf, nr));
        }
      }
    }
    let mateNetAttackers = 0;
    for (const sq of ALL_SQUARES) {
      const p = boardMap[sq];
      if (!p || p.color !== attackerColor) continue;
      for (const target of kingZone) {
        if (attacks(p, sq, target, boardMap)) {
          mateNetAttackers++;
          break;
        }
      }
    }

    const hiddenKingCagePressure =
      matedKingHidden &&
      !bothKingsHidden &&
      mateNetAttackers <= 2 &&
      easyGuessSquares.size <= 1
        ? Math.max(0, kingZoneHiddenSquares - 2) *
          Math.max(0, kingZoneHiddenPieces - 1)
        : 0;
    const ambiguousPawnPromotion =
      Array.isArray(puzzle.achievements) &&
      puzzle.achievements.includes("pawn") &&
      matedKingHidden &&
      !bothKingsHidden &&
      easyGuessSquares.size === 0 &&
      defenderBlockers === 0 &&
      (hiddenPieceCounts.q ?? 0) >= 1
        ? 1
        : 0;
    const sparsePeripheralReveal =
      matedKingHidden &&
      totalPieces <= 16 &&
      avgHiddenDist >= 2 &&
      kingZoneHiddenSquares <= 2
        ? peripheralHiddenSquares
        : 0;
    const ambiguousRoamingBlockers =
      hiddenKingCagePressure >= 4 ? roamingDefenderBlockers : 0;
    const crowdedAnomalyLoad =
      (ambiguousRoamingBlockers + ambiguousPawnPromotion) *
      Math.max(0, totalPieces - 16);

    return {
      totalPieces,
      avgHiddenDist,
      mateNetAttackers,
      sparseAttackProduct: ((32 - totalPieces) * mateNetAttackers) / 10,
      excessMateNetAttackers: Math.max(0, mateNetAttackers - 2),
      hiddenEmpties,
      kingZoneHiddenSquares,
      kingZoneHiddenEmpties,
      kingZoneHiddenPieces,
      matedKingHidden,
      hiddenKingCagePressure,
      ambiguousPawnPromotion,
      sparsePeripheralReveal,
      crowdedAnomalyLoad,
      bothKingsHidden,
      promotedHidden,
      easyGuesses: easyGuessSquares.size,
      startingHome,
      castledKings,
      pawnsNearHome,
      hiddenCheckers,
      defenderBlockers,
      guessableDefenderBlockers,
      roamingDefenderBlockers,
      ambiguousRoamingBlockers,
      kingDist,
      hiddenPieceCounts,
      achievements: Array.isArray(puzzle.achievements)
        ? [...new Set(puzzle.achievements)]
        : [],
    };
  } catch (err) {
    return { error: `Unexpected: ${err.message}` };
  }
}

export function scoreDifficultyFeatures(
  features,
  calibration = DEFAULT_CALIBRATION,
) {
  const tuned = resolveCalibration(calibration);
  const compoundDiscount =
    features.easyGuesses >= 2
      ? (features.easyGuesses - 1) * tuned.easyGuessDiscount
      : 0;

  const hiddenPieceContrib = Object.entries(
    features.hiddenPieceCounts ?? {},
  ).reduce(
    (sum, [type, count]) =>
      sum + count * (tuned.hiddenPieceWeights?.[type] ?? 0),
    0,
  );
  const achievementContrib = (features.achievements ?? []).reduce(
    (sum, achievement) => sum + (tuned.achievementWeights?.[achievement] ?? 0),
    0,
  );
  const additiveContrib =
    features.hiddenCheckers * tuned.hiddenCheckerWeight +
    features.defenderBlockers * tuned.defenderBlockerWeight +
    features.ambiguousRoamingBlockers * tuned.ambiguousRoamingBlockerWeight +
    features.kingDist * tuned.kingDistWeight +
    features.startingHome * tuned.startingHomeWeight +
    features.castledKings * tuned.castledKingWeight +
    features.pawnsNearHome * tuned.pawnNearHomeWeight +
    features.sparseAttackProduct * tuned.sparseAttackerWeight +
    features.kingZoneHiddenSquares * tuned.kingZoneHiddenWeight +
    features.kingZoneHiddenPieces * tuned.kingZonePieceWeight +
    features.kingZoneHiddenEmpties * tuned.kingZoneEmptyWeight +
    features.hiddenKingCagePressure * tuned.hiddenKingCageWeight +
    features.ambiguousPawnPromotion * tuned.ambiguousPawnPromotionWeight +
    features.sparsePeripheralReveal * tuned.sparsePeripheralRevealWeight +
    features.crowdedAnomalyLoad * tuned.crowdedAnomalyWeight +
    features.excessMateNetAttackers * tuned.excessAttackerWeight +
    hiddenPieceContrib +
    achievementContrib;

  // ── Score ────────────────────────────────────────────────────
  // Compound ease: a single "easy guess" doesn't help much (4 unknowns
  // remain), but 2+ easy guesses compound — each narrows the field.

  // Both kings hidden is offset when empties reduce unknowns.
  const bothKingsContrib = features.bothKingsHidden
    ? Math.max(
        0,
        tuned.bothKingsBase -
          features.hiddenEmpties * tuned.bothKingsEmptyPenalty,
      )
    : 0;

  const raw =
    (32 - features.totalPieces) * tuned.pieceWeight +
    (2 - features.avgHiddenDist) * tuned.hiddenDistWeight +
    features.mateNetAttackers * tuned.attackerWeight +
    features.hiddenEmpties * tuned.emptyWeight +
    bothKingsContrib +
    features.promotedHidden * tuned.promotedWeight -
    compoundDiscount +
    tuned.baseOffset +
    additiveContrib;

  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const tier = tierFromScore(score, tuned);

  return {
    score,
    tier,
    details: {
      totalPieces: features.totalPieces,
      avgHiddenDist: Math.round(features.avgHiddenDist * 100) / 100,
      mateNetAttackers: features.mateNetAttackers,
      sparseAttackProduct: Math.round(features.sparseAttackProduct * 100) / 100,
      excessMateNetAttackers: features.excessMateNetAttackers,
      hiddenEmpties: features.hiddenEmpties,
      kingZoneHiddenSquares: features.kingZoneHiddenSquares,
      kingZoneHiddenPieces: features.kingZoneHiddenPieces,
      kingZoneHiddenEmpties: features.kingZoneHiddenEmpties,
      matedKingHidden: features.matedKingHidden,
      hiddenKingCagePressure:
        Math.round(features.hiddenKingCagePressure * 100) / 100,
      ambiguousPawnPromotion: features.ambiguousPawnPromotion,
      sparsePeripheralReveal: features.sparsePeripheralReveal,
      crowdedAnomalyLoad: features.crowdedAnomalyLoad,
      bothKingsHidden: features.bothKingsHidden,
      promotedHidden: features.promotedHidden,
      easyGuesses: features.easyGuesses,
      startingHome: features.startingHome,
      castledKings: features.castledKings,
      pawnsNearHome: features.pawnsNearHome,
      hiddenCheckers: features.hiddenCheckers,
      defenderBlockers: features.defenderBlockers,
      guessableDefenderBlockers: features.guessableDefenderBlockers,
      roamingDefenderBlockers: features.roamingDefenderBlockers,
      ambiguousRoamingBlockers: features.ambiguousRoamingBlockers,
      kingDist: features.kingDist,
      hiddenPieceCounts: features.hiddenPieceCounts,
      achievements: features.achievements,
      compoundDiscount,
      bothKingsContrib,
      hiddenPieceContrib,
      achievementContrib,
      additiveContrib: Math.round(additiveContrib * 100) / 100,
      rawScore: Math.round(raw * 100) / 100,
    },
  };
}

/**
 * Calculate a 0-100 difficulty score for a Matle puzzle.
 *
 * @param {{Board: string, HiddenSquares: string[]}} puzzle
 * @param {object} [calibration]
 * @returns {{score: number, tier: string, details: object} | {error: string}}
 */
export function calculateDifficulty(puzzle, calibration = DEFAULT_CALIBRATION) {
  const features = extractDifficultyFeatures(puzzle);
  if (features.error) {
    return features;
  }
  return scoreDifficultyFeatures(features, calibration);
}

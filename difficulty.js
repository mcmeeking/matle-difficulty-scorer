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
function toFen(boardStr, turn) {
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

// ── Main export ──────────────────────────────────────────────────

/**
 * Calculate a 0-100 difficulty score for a Matle puzzle.
 *
 * @param {{Board: string, HiddenSquares: string[]}} puzzle
 * @returns {{score: number, tier: string, details: object} | {error: string}}
 */
export function calculateDifficulty(puzzle) {
  try {
    const { Board: boardStr, HiddenSquares: hidden } = puzzle;

    if (!boardStr || !Array.isArray(hidden) || hidden.length !== 5) {
      return {
        error: "Invalid puzzle: need Board and exactly 5 HiddenSquares",
      };
    }

    const boardMap = parseBoardMap(boardStr);

    // ── Detect checkmate via chess.js ────────────────────────────
    let matedColor = null;
    for (const turn of ["w", "b"]) {
      try {
        const c = new Chess();
        c.load(toFen(boardStr, turn), { skipValidation: true });
        if (c.isCheckmate()) {
          matedColor = turn;
          break;
        }
      } catch {
        /* try the other side */
      }
    }
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
    let startingHome = 0;
    let castledKings = 0;
    let pawnsNearHome = 0;
    let defenderBlockers = 0;
    let hiddenEmpties = 0;
    let hiddenCheckers = 0;
    let distSum = 0;

    for (const sq of hidden) {
      const pc = boardMap[sq];
      distSum += chebyshev(sq, kingSq);

      if (!pc) {
        hiddenEmpties++;
        continue;
      }

      // Piece on its starting square?
      const home = STARTING[sq];
      if (home && home.type === pc.type && home.color === pc.color)
        startingHome++;

      // King on castled square (g1/g8/c1/c8) – trivially guessable
      if (pc.type === "k" && CASTLED_KING.has(sq)) castledKings++;

      // Pawn within 1 rank of its home rank – very common, easy to guess
      if (pc.type === "p") {
        const [, rank] = fr(sq);
        if (Math.abs(rank - pawnHomeRank(pc.color)) <= 1) pawnsNearHome++;
      }

      // Same-colour (defender) piece adjacent to mated king?
      if (pc.color === matedColor && chebyshev(sq, kingSq) === 1)
        defenderBlockers++;

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

    // ── Score ────────────────────────────────────────────────────
    // "Easy guesses" = hidden pieces that are trivially deducible
    const easyGuesses = startingHome + castledKings + pawnsNearHome;
    // Compound discount: when ≥2 squares are freebies, the rest get
    // much easier by elimination.
    const compoundEase = easyGuesses >= 2 ? (easyGuesses - 1) * 4 : 0;

    const raw =
      defenderBlockers * 11 +
      (32 - totalPieces) * 2.1 +
      kingDist * 3.2 +
      hiddenCheckers * 7 +
      hiddenEmpties * 6.5 +
      avgHiddenDist * 1.4 -
      startingHome * 6 -
      castledKings * 12 -
      pawnsNearHome * 7 -
      compoundEase;

    const score = Math.round(Math.max(0, Math.min(100, raw)));
    const tier = score < 45 ? "Basic" : score < 75 ? "Medium" : "Hard";

    return {
      score,
      tier,
      details: {
        startingHome,
        castledKings,
        pawnsNearHome,
        defenderBlockers,
        totalPieces,
        kingDist,
        hiddenEmpties,
        hiddenCheckers,
        avgHiddenDist: Math.round(avgHiddenDist * 100) / 100,
      },
    };
  } catch (err) {
    return { error: `Unexpected: ${err.message}` };
  }
}

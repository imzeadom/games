import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_SIZE,
  canPlacePiece,
  emptyBoard,
  generateTray,
  hasAnyPlacement,
  legalPlacements,
  levelForLines,
  pieceFromShape,
  placeAndClear,
  restorePiece,
  scorePlacement,
} from "../app/block-puzzle/logic.ts";

function piece(shapeId, color = 1) {
  const result = pieceFromShape(shapeId, color, `test-${shapeId}`);
  assert.ok(result, `expected shape ${shapeId}`);
  return result;
}

test("rejects overlapping and out-of-bounds placements without mutating the board", () => {
  const board = emptyBoard();
  board[0] = 2;
  const domino = piece("domino-h");
  const snapshot = [...board];

  assert.equal(canPlacePiece(board, domino, 0, 0), false);
  assert.equal(canPlacePiece(board, domino, 0, BOARD_SIZE - 1), false);
  assert.equal(placeAndClear(board, domino, 0, 0), null);
  assert.deepEqual(board, snapshot);
});

test("clears a completed row after committing the piece", () => {
  const board = emptyBoard();
  for (let column = 0; column < BOARD_SIZE - 1; column += 1) {
    board[column] = 2;
  }
  const snapshot = [...board];

  const result = placeAndClear(board, piece("dot", 5), 0, BOARD_SIZE - 1);
  assert.ok(result);
  assert.deepEqual(result.completedRows, [0]);
  assert.deepEqual(result.completedColumns, []);
  assert.equal(result.clearedCells.length, BOARD_SIZE);
  assert.ok(result.board.slice(0, BOARD_SIZE).every((cell) => cell === 0));
  assert.deepEqual(board, snapshot);
});

test("clears intersecting row and column simultaneously and counts the crossing once", () => {
  const board = emptyBoard();
  const targetRow = 3;
  const targetColumn = 4;
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    if (column !== targetColumn) board[targetRow * BOARD_SIZE + column] = 2;
  }
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (row !== targetRow) board[row * BOARD_SIZE + targetColumn] = 3;
  }

  const result = placeAndClear(board, piece("dot", 4), targetRow, targetColumn);
  assert.ok(result);
  assert.deepEqual(result.completedRows, [targetRow]);
  assert.deepEqual(result.completedColumns, [targetColumn]);
  assert.equal(result.clearedCells.length, BOARD_SIZE * 2 - 1);
  assert.ok(result.board.every((cell) => cell === 0));
});

test("one placement can clear multiple rows", () => {
  const board = emptyBoard();
  for (const row of [2, 3]) {
    for (let column = 0; column < BOARD_SIZE - 1; column += 1) {
      board[row * BOARD_SIZE + column] = 6;
    }
  }
  const snapshot = [...board];

  const result = placeAndClear(board, piece("domino-v", 1), 2, 7);
  assert.ok(result);
  assert.deepEqual(result.completedRows, [2, 3]);
  assert.deepEqual(result.completedColumns, []);
  assert.equal(result.clearedCells.length, BOARD_SIZE * 2);
  assert.deepEqual(board, snapshot);
});

test("move detection evaluates every legal anchor for each remaining piece", () => {
  const board = Array(BOARD_SIZE * BOARD_SIZE).fill(2);
  for (const index of [0, 10, 20, 30]) board[index] = 0;

  const longPieces = [piece("domino-h"), piece("domino-v"), null];
  assert.equal(hasAnyPlacement(board, longPieces), false);
  assert.equal(hasAnyPlacement(board, [piece("dot"), ...longPieces.slice(1)]), true);
  assert.deepEqual(legalPlacements(board, piece("dot")), [
    [0, 0],
    [1, 2],
    [2, 4],
    [3, 6],
  ]);
});

test("rescue generation guarantees two playable pieces on a fragmented board", () => {
  const board = Array(BOARD_SIZE * BOARD_SIZE).fill(2);
  for (const index of [0, 10, 20, 30]) board[index] = 0;
  const tray = generateTray(board, 4, 1, () => 0.999999, 2);
  const playable = tray.filter(
    (candidate) => legalPlacements(board, candidate).length > 0,
  );

  assert.equal(tray.length, 3);
  assert.ok(playable.length >= 2);
});

test("tray generation safely normalizes an invalid level to the opening pool", () => {
  const tray = generateTray(emptyBoard(), 0, Number.NaN, () => 0.25);
  assert.equal(tray.length, 3);
  assert.ok(tray.every((candidate) => candidate.cells.length > 0));
});

test("scores placement, multi-line, combo, and perfect-clear rewards", () => {
  assert.equal(scorePlacement(4, 0, 0, false), 20);
  assert.equal(scorePlacement(3, 2, 3, false), 355);
  assert.equal(scorePlacement(3, 2, 3, true), 855);
  assert.equal(scorePlacement(1, 1, 99, false), 285);
});

test("level progression advances every ten cleared lines", () => {
  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(9), 1);
  assert.equal(levelForLines(10), 2);
  assert.equal(levelForLines(49), 5);
});

test("saved pieces are reconstructed only from known shapes", () => {
  assert.equal(restorePiece({ key: "x", shapeId: "unknown", color: 2 }), null);
  const restored = restorePiece({ key: "x", shapeId: "tee-up", color: 4 });
  assert.ok(restored);
  assert.equal(restored.cells.length, 4);
  assert.equal(restored.color, 4);
});

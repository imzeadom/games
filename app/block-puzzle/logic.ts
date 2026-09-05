export const BOARD_SIZE = 8;
export const RESCUE_TARGET = 12;

export type CellCoordinate = readonly [row: number, column: number];

export type Piece = {
  key: string;
  shapeId: string;
  family: string;
  cells: CellCoordinate[];
  color: number;
};

type ShapeSize = "small" | "medium" | "large";

type ShapeDefinition = {
  id: string;
  family: string;
  label: string;
  size: ShapeSize;
  unlockLevel: number;
  cells: CellCoordinate[];
};

export type PlacementResult = {
  board: number[];
  placedCells: number[];
  clearedCells: number[];
  completedRows: number[];
  completedColumns: number[];
};

const SHAPES: ShapeDefinition[] = [
  {
    id: "dot",
    family: "dot",
    label: "单格",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0]],
  },
  {
    id: "domino-h",
    family: "domino",
    label: "二格横条",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1]],
  },
  {
    id: "domino-v",
    family: "domino",
    label: "二格竖条",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0]],
  },
  {
    id: "line3-h",
    family: "line3",
    label: "三格横条",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [0, 2]],
  },
  {
    id: "line3-v",
    family: "line3",
    label: "三格竖条",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0], [2, 0]],
  },
  {
    id: "corner3-br",
    family: "corner3",
    label: "三格转角",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0], [1, 1]],
  },
  {
    id: "corner3-bl",
    family: "corner3",
    label: "三格转角",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 1], [1, 0], [1, 1]],
  },
  {
    id: "corner3-tr",
    family: "corner3",
    label: "三格转角",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [1, 0]],
  },
  {
    id: "corner3-tl",
    family: "corner3",
    label: "三格转角",
    size: "small",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [1, 1]],
  },
  {
    id: "square2",
    family: "square2",
    label: "四格方块",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
  },
  {
    id: "line4-h",
    family: "line4",
    label: "四格横条",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [0, 2], [0, 3]],
  },
  {
    id: "line4-v",
    family: "line4",
    label: "四格竖条",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0], [2, 0], [3, 0]],
  },
  {
    id: "el4-br",
    family: "el4",
    label: "四格 L 形",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0], [2, 0], [2, 1]],
  },
  {
    id: "el4-bl",
    family: "el4",
    label: "四格 L 形",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 1], [1, 1], [2, 0], [2, 1]],
  },
  {
    id: "el4-rt",
    family: "el4",
    label: "四格 L 形",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [1, 0], [1, 1], [1, 2]],
  },
  {
    id: "el4-rb",
    family: "el4",
    label: "四格 L 形",
    size: "medium",
    unlockLevel: 1,
    cells: [[0, 0], [0, 1], [0, 2], [1, 0]],
  },
  {
    id: "tee-up",
    family: "tee",
    label: "四格 T 形",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 0], [0, 1], [0, 2], [1, 1]],
  },
  {
    id: "tee-down",
    family: "tee",
    label: "四格 T 形",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 1], [1, 0], [1, 1], [1, 2]],
  },
  {
    id: "tee-left",
    family: "tee",
    label: "四格 T 形",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 0], [1, 0], [1, 1], [2, 0]],
  },
  {
    id: "tee-right",
    family: "tee",
    label: "四格 T 形",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 1], [1, 0], [1, 1], [2, 1]],
  },
  {
    id: "zig-h",
    family: "zig",
    label: "四格折线",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 1], [0, 2], [1, 0], [1, 1]],
  },
  {
    id: "zag-h",
    family: "zig",
    label: "四格折线",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 0], [0, 1], [1, 1], [1, 2]],
  },
  {
    id: "zig-v",
    family: "zig",
    label: "四格折线",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 0], [1, 0], [1, 1], [2, 1]],
  },
  {
    id: "zag-v",
    family: "zig",
    label: "四格折线",
    size: "medium",
    unlockLevel: 2,
    cells: [[0, 1], [1, 0], [1, 1], [2, 0]],
  },
  {
    id: "line5-h",
    family: "line5",
    label: "五格横条",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  },
  {
    id: "line5-v",
    family: "line5",
    label: "五格竖条",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  },
  {
    id: "plus5",
    family: "plus5",
    label: "五格十字",
    size: "large",
    unlockLevel: 4,
    cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  },
  {
    id: "el5-br",
    family: "el5",
    label: "五格大 L 形",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  },
  {
    id: "el5-bl",
    family: "el5",
    label: "五格大 L 形",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]],
  },
  {
    id: "el5-tr",
    family: "el5",
    label: "五格大 L 形",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]],
  },
  {
    id: "el5-tl",
    family: "el5",
    label: "五格大 L 形",
    size: "large",
    unlockLevel: 3,
    cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  },
  {
    id: "square3",
    family: "square3",
    label: "九格大方块",
    size: "large",
    unlockLevel: 5,
    cells: [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
  },
];

const SHAPES_BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

export function emptyBoard(): number[] {
  return Array(BOARD_SIZE * BOARD_SIZE).fill(0);
}

export function boardOccupancy(board: number[]): number {
  return board.filter(Boolean).length / (BOARD_SIZE * BOARD_SIZE);
}

export function pieceBounds(piece: Pick<Piece, "cells">): {
  rows: number;
  columns: number;
} {
  return {
    rows: Math.max(...piece.cells.map(([row]) => row)) + 1,
    columns: Math.max(...piece.cells.map(([, column]) => column)) + 1,
  };
}

export function pieceFromShape(
  shapeId: string,
  color: number,
  key: string,
): Piece | null {
  const shape = SHAPES_BY_ID.get(shapeId);
  if (!shape) return null;
  return {
    key,
    shapeId,
    family: shape.family,
    cells: shape.cells.map(([row, column]) => [row, column] as const),
    color: Math.max(1, Math.min(6, Math.round(color))),
  };
}

export function pieceLabel(piece: Piece): string {
  const shape = SHAPES_BY_ID.get(piece.shapeId);
  const bounds = pieceBounds(piece);
  return `${shape?.label ?? "拼块"}，${piece.cells.length} 格，${bounds.rows} 行 ${bounds.columns} 列`;
}

export function canPlacePiece(
  board: number[],
  piece: Piece,
  startRow: number,
  startColumn: number,
): boolean {
  if (board.length !== BOARD_SIZE * BOARD_SIZE) return false;
  return piece.cells.every(([rowOffset, columnOffset]) => {
    const row = startRow + rowOffset;
    const column = startColumn + columnOffset;
    return (
      row >= 0 &&
      row < BOARD_SIZE &&
      column >= 0 &&
      column < BOARD_SIZE &&
      board[row * BOARD_SIZE + column] === 0
    );
  });
}

export function legalPlacements(
  board: number[],
  piece: Piece,
): CellCoordinate[] {
  const placements: CellCoordinate[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (canPlacePiece(board, piece, row, column)) {
        placements.push([row, column]);
      }
    }
  }
  return placements;
}

export function hasAnyPlacement(
  board: number[],
  pieces: Array<Piece | null>,
): boolean {
  return pieces.some(
    (piece) => piece !== null && legalPlacements(board, piece).length > 0,
  );
}

export function placeAndClear(
  board: number[],
  piece: Piece,
  startRow: number,
  startColumn: number,
): PlacementResult | null {
  if (!canPlacePiece(board, piece, startRow, startColumn)) return null;

  const placedBoard = [...board];
  const placedCells = piece.cells.map(([rowOffset, columnOffset]) => {
    const index =
      (startRow + rowOffset) * BOARD_SIZE + startColumn + columnOffset;
    placedBoard[index] = piece.color;
    return index;
  });

  const completedRows = Array.from({ length: BOARD_SIZE }, (_, row) => row)
    .filter((row) =>
      Array.from(
        { length: BOARD_SIZE },
        (_, column) => placedBoard[row * BOARD_SIZE + column],
      ).every(Boolean),
    );
  const completedColumns = Array.from(
    { length: BOARD_SIZE },
    (_, column) => column,
  ).filter((column) =>
    Array.from(
      { length: BOARD_SIZE },
      (_, row) => placedBoard[row * BOARD_SIZE + column],
    ).every(Boolean),
  );

  const cleared = new Set<number>();
  for (const row of completedRows) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      cleared.add(row * BOARD_SIZE + column);
    }
  }
  for (const column of completedColumns) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      cleared.add(row * BOARD_SIZE + column);
    }
  }

  const nextBoard = [...placedBoard];
  for (const index of cleared) nextBoard[index] = 0;

  return {
    board: nextBoard,
    placedCells,
    clearedCells: [...cleared],
    completedRows,
    completedColumns,
  };
}

function boundedRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999, Math.max(0, value));
}

function randomItem<T>(items: T[], random: () => number): T {
  return items[Math.floor(boundedRandom(random) * items.length)];
}

function weightsFor(occupancy: number): Record<ShapeSize, number> {
  if (occupancy < 0.45) return { small: 25, medium: 50, large: 25 };
  if (occupancy < 0.7) return { small: 35, medium: 50, large: 15 };
  return { small: 55, medium: 40, large: 5 };
}

function chooseSize(
  available: ShapeSize[],
  occupancy: number,
  random: () => number,
): ShapeSize {
  const weights = weightsFor(occupancy);
  const total = available.reduce((sum, size) => sum + weights[size], 0);
  let roll = boundedRandom(random) * total;
  for (const size of available) {
    roll -= weights[size];
    if (roll <= 0) return size;
  }
  return available[available.length - 1];
}

function chooseShape(
  eligible: ShapeDefinition[],
  occupancy: number,
  usedFamilies: Set<string>,
  random: () => number,
  forceSmall = false,
): ShapeDefinition {
  const unused = eligible.filter((shape) => !usedFamilies.has(shape.family));
  const source = unused.length ? unused : eligible;
  const sizedSource = forceSmall
    ? source.filter((shape) => shape.size === "small")
    : source;
  const availableSizes = [...new Set(sizedSource.map((shape) => shape.size))];
  const size = forceSmall
    ? "small"
    : chooseSize(availableSizes, occupancy, random);
  const families = [
    ...new Set(
      sizedSource.filter((shape) => shape.size === size).map((shape) => shape.family),
    ),
  ];
  const family = randomItem(families, random);
  return randomItem(
    sizedSource.filter((shape) => shape.family === family),
    random,
  );
}

export function generateTray(
  board: number[],
  batch: number,
  level: number,
  random: () => number = Math.random,
  minimumPlayable = 1,
): Piece[] {
  const occupancy = boardOccupancy(board);
  const normalizedLevel = Number.isFinite(level)
    ? Math.max(1, Math.floor(level))
    : 1;
  const eligible = SHAPES.filter(
    (shape) => shape.unlockLevel <= normalizedLevel,
  );
  const usedFamilies = new Set<string>();
  const pieces = Array.from({ length: 3 }, (_, index) => {
    const forceSmall = occupancy > 0.7 && index === 0;
    const shape = chooseShape(
      eligible,
      occupancy,
      usedFamilies,
      random,
      forceSmall,
    );
    usedFamilies.add(shape.family);
    return pieceFromShape(
      shape.id,
      1 + Math.floor(boundedRandom(random) * 6),
      `batch-${batch}-piece-${index}-${Math.floor(boundedRandom(random) * 1e6)}`,
    ) as Piece;
  });

  const playableCount = () =>
    pieces.filter((piece) => legalPlacements(board, piece).length > 0).length;
  const target = Math.max(0, Math.min(3, minimumPlayable));

  if (playableCount() < target) {
    const fitting = eligible.filter((shape) => {
      const probe = pieceFromShape(shape.id, 1, "probe");
      return probe ? legalPlacements(board, probe).length > 0 : false;
    });

    for (let index = 0; index < pieces.length && playableCount() < target; index += 1) {
      if (legalPlacements(board, pieces[index]).length > 0) continue;
      const unusedFitting = fitting.filter(
        (shape) => !pieces.some((piece) => piece.family === shape.family),
      );
      const shape = randomItem(unusedFitting.length ? unusedFitting : fitting, random);
      if (!shape) break;
      pieces[index] = pieceFromShape(
        shape.id,
        1 + Math.floor(boundedRandom(random) * 6),
        `batch-${batch}-rescue-${index}-${Math.floor(boundedRandom(random) * 1e6)}`,
      ) as Piece;
    }
  }

  return pieces;
}

export function scorePlacement(
  placedCellCount: number,
  lineCount: number,
  combo: number,
  perfectClear: boolean,
): number {
  const placementPoints = placedCellCount * 5;
  if (lineCount === 0) return placementPoints;
  const linePoints = 80 * lineCount + 40 * lineCount * (lineCount - 1);
  const comboPoints = 25 * Math.min(Math.max(combo - 1, 0), 8) * lineCount;
  return placementPoints + linePoints + comboPoints + (perfectClear ? 500 : 0);
}

export function levelForLines(lines: number): number {
  return Math.max(1, Math.floor(Math.max(0, lines) / 10) + 1);
}

export function restorePiece(value: unknown): Piece | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { key?: unknown; shapeId?: unknown; color?: unknown };
  if (
    typeof candidate.key !== "string" ||
    typeof candidate.shapeId !== "string" ||
    typeof candidate.color !== "number"
  ) {
    return null;
  }
  return pieceFromShape(candidate.shapeId, candidate.color, candidate.key);
}

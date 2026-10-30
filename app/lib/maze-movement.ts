export type MazeDirection = "up" | "right" | "down" | "left";

const DELTAS: Record<MazeDirection, { row: number; column: number; wall: number }> = {
  up: { row: -1, column: 0, wall: 1 },
  right: { row: 0, column: 1, wall: 2 },
  down: { row: 1, column: 0, wall: 4 },
  left: { row: 0, column: -1, wall: 8 },
};

/** Returns each cell entered by a move, stopping at walls, edges, or the exit. */
export function moveMazePlayer(
  cells: number[],
  size: number,
  from: number,
  direction: MazeDirection,
  distance = 1,
): number[] {
  if (!Number.isInteger(size) || size < 1 || from < 0 || from >= cells.length) return [];
  const delta = DELTAS[direction];
  const entered: number[] = [];
  let current = from;

  for (let step = 0; step < Math.max(0, Math.floor(distance)); step += 1) {
    const row = Math.floor(current / size);
    const column = current % size;
    const nextRow = row + delta.row;
    const nextColumn = column + delta.column;
    if (nextRow < 0 || nextColumn < 0 || nextRow >= size || nextColumn >= size) break;
    if (cells[current] & delta.wall) break;
    current = nextRow * size + nextColumn;
    entered.push(current);
    if (current === cells.length - 1) break;
  }

  return entered;
}

export const MAZE_DIRECTIONS = [
  { row: -1, column: 0, wall: 1 },
  { row: 0, column: 1, wall: 2 },
  { row: 1, column: 0, wall: 4 },
  { row: 0, column: -1, wall: 8 },
] as const;

export function findMazeRoute(cells: number[], size: number, from: number, to: number) {
  const parents = new Map<number, number>();
  const queue = [from];
  const seen = new Set(queue);
  for (let cursor = 0; cursor < queue.length && !seen.has(to); cursor += 1) {
    const cell = queue[cursor];
    const row = Math.floor(cell / size);
    const column = cell % size;
    for (const direction of MAZE_DIRECTIONS) {
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      if (
        cells[cell] & direction.wall || nextRow < 0 || nextColumn < 0 ||
        nextRow >= size || nextColumn >= size
      ) continue;
      const next = nextRow * size + nextColumn;
      if (seen.has(next)) continue;
      seen.add(next);
      parents.set(next, cell);
      queue.push(next);
    }
  }
  if (!seen.has(to)) return [];
  const route = [to];
  while (route[0] !== from) route.unshift(parents.get(route[0])!);
  return route;
}

export function placeMazeYarn(
  cells: number[],
  size: number,
  random: () => number = Math.random,
) {
  const route = findMazeRoute(cells, size, 0, cells.length - 1);
  const onRoute = new Set(route);
  const goal = cells.length - 1;
  const reachableBeforeGoal = new Set([0]);
  const queue = [0];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    const row = Math.floor(cell / size);
    const column = cell % size;
    for (const direction of MAZE_DIRECTIONS) {
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      if (
        cells[cell] & direction.wall || nextRow < 0 || nextColumn < 0 ||
        nextRow >= size || nextColumn >= size
      ) continue;
      const next = nextRow * size + nextColumn;
      if (next === goal || reachableBeforeGoal.has(next)) continue;
      reachableBeforeGoal.add(next);
      queue.push(next);
    }
  }
  const valid = [...reachableBeforeGoal].filter((cell) => cell !== 0);
  const branches = valid.filter((cell) => !onRoute.has(cell));
  const shuffle = (items: number[]) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  };
  const mainPathYarn = shuffle(route.filter((cell) => cell !== 0 && cell !== cells.length - 1)).slice(0, 1);
  const branchYarn = shuffle(branches).slice(0, 2);
  const placed = [...mainPathYarn, ...branchYarn];
  if (placed.length < 3) {
    const remainder = shuffle(valid.filter((cell) => !placed.includes(cell)));
    placed.push(...remainder.slice(0, 3 - placed.length));
  }
  return placed;
}

export function mazeStars(yarnCount: number) {
  return yarnCount === 3 ? 3 : yarnCount >= 2 ? 2 : 1;
}

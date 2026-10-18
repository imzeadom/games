import assert from "node:assert/strict";
import test from "node:test";
import { findMazeRoute, mazeStars, placeMazeYarn } from "../app/lib/maze-rewards.ts";

function connectedMaze() {
  const size = 5;
  return { cells: Array(size * size).fill(0), size };
}

test("yarn rewards include one main-route pickup and two reachable branch pickups", () => {
  const { cells, size } = connectedMaze();
  const route = findMazeRoute(cells, size, 0, cells.length - 1);
  const pickups = placeMazeYarn(cells, size, () => 0);
  assert.equal(pickups.length, 3);
  assert.equal(new Set(pickups).size, 3);
  assert.ok(pickups.every((cell) => cell !== 0 && cell !== cells.length - 1));
  assert.equal(pickups.filter((cell) => route.includes(cell)).length, 1);
  assert.equal(pickups.filter((cell) => !route.includes(cell)).length, 2);
  for (const pickup of pickups) assert.ok(findMazeRoute(cells, size, 0, pickup).length > 0);
});

test("route contains only legal adjacent moves and star scoring distinguishes all three yarn", () => {
  const { cells, size } = connectedMaze();
  const route = findMazeRoute(cells, size, 0, cells.length - 1);
  assert.equal(route[0], 0);
  assert.equal(route.at(-1), cells.length - 1);
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const next = route[index];
    assert.equal(Math.abs(Math.floor(previous / size) - Math.floor(next / size)) + Math.abs(previous % size - next % size), 1);
  }
  assert.deepEqual([0, 1, 2, 3].map(mazeStars), [1, 1, 2, 3]);
});

test("pickups never land in a limb that is only reachable through the exit", () => {
  const size = 5;
  const cells = Array(size * size).fill(15);
  const link = (first, second) => {
    const delta = second - first;
    const wall = delta === -size ? 1 : delta === 1 ? 2 : delta === size ? 4 : 8;
    const opposite = wall === 1 ? 4 : wall === 2 ? 8 : wall === 4 ? 1 : 2;
    cells[first] &= ~wall;
    cells[second] &= ~opposite;
  };
  [[0, 5], [5, 10], [10, 15], [15, 20], [20, 21], [21, 22], [22, 23], [23, 24], [5, 6], [6, 7], [21, 16], [16, 11], [24, 19], [19, 14], [14, 13]].forEach(([a, b]) => link(a, b));
  const pickups = placeMazeYarn(cells, size, () => 0);
  assert.equal(pickups.length, 3);
  for (const pickup of pickups) {
    const path = findMazeRoute(cells, size, 0, pickup);
    assert.ok(path.length > 0);
    assert.ok(!path.includes(24));
    assert.ok(![19, 14, 13].includes(pickup));
  }
});

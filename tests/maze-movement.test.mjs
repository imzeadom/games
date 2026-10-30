import assert from "node:assert/strict";
import test from "node:test";
import { moveMazePlayer } from "../app/lib/maze-movement.ts";

test("rabbit hop follows both open cells and returns each visited cell for pickups", () => {
  const cells = Array(9).fill(15);
  cells[3] = 13;
  cells[4] = 13;
  const entered = moveMazePlayer(cells, 3, 3, "right", 2);
  assert.deepEqual(entered, [4, 5]);
  assert.ok(entered.includes(4), "the intermediate cell remains available to collect a dew drop");
});

test("hop stops before a wall on its first or second step", () => {
  const firstWall = Array(9).fill(15);
  assert.deepEqual(moveMazePlayer(firstWall, 3, 3, "right", 2), []);

  const secondWall = Array(9).fill(15);
  secondWall[3] = 13;
  assert.deepEqual(moveMazePlayer(secondWall, 3, 3, "right", 2), [4]);
});

test("hop stops immediately on reaching the maze exit", () => {
  const cells = Array(9).fill(15);
  cells[7] = 13;
  cells[8] = 0;
  assert.deepEqual(moveMazePlayer(cells, 3, 7, "right", 2), [8]);
});

test("movement respects board edges and ignores nonpositive distance", () => {
  const cells = Array(9).fill(0);
  assert.deepEqual(moveMazePlayer(cells, 3, 2, "right", 2), []);
  assert.deepEqual(moveMazePlayer(cells, 3, 0, "down", 0), []);
});

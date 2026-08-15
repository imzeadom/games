import assert from "node:assert/strict";
import { test } from "node:test";
import * as generator from "../app/crossword/generator.ts";

function traitsFor(puzzle) {
  return puzzle.words.map((word) =>
    generator.directionTraits(word.positions, puzzle.size),
  );
}

function assertSpelledCorrectly(puzzle) {
  for (const placed of puzzle.words) {
    assert.equal(
      placed.positions.map((position) => puzzle.letters[position]).join(""),
      placed.word,
    );
  }
}

test("easy puzzles always use horizontal and vertical words", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("easy");
    const orientations = new Set(
      traitsFor(puzzle).map(({ orientation }) => orientation),
    );

    assert.deepEqual(orientations, new Set(["horizontal", "vertical"]));
    assertSpelledCorrectly(puzzle);
  }
});

test("medium puzzles always use horizontal, vertical, and diagonal words", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("medium");
    const orientations = new Set(
      traitsFor(puzzle).map(({ orientation }) => orientation),
    );

    assert.deepEqual(
      orientations,
      new Set(["horizontal", "vertical", "diagonal"]),
    );
    assertSpelledCorrectly(puzzle);
  }
});

test("hard puzzles always mix orientations and reading orders", () => {
  for (let index = 0; index < 50; index += 1) {
    const puzzle = generator.makePuzzle("hard");
    const traits = traitsFor(puzzle);

    assert.deepEqual(
      new Set(traits.map(({ orientation }) => orientation)),
      new Set(["horizontal", "vertical", "diagonal"]),
    );
    assert.deepEqual(
      new Set(traits.map(({ order }) => order)),
      new Set(["forward", "reverse"]),
    );
    assertSpelledCorrectly(puzzle);
  }
});

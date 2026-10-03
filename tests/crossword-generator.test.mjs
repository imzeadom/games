import assert from "node:assert/strict";
import { test } from "node:test";
import * as generator from "../app/crossword/generator.ts";
import { VOCABULARY } from "../app/crossword/vocabulary.ts";

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

const LEGACY_COUNTS = { easy: 5, medium: 6, hard: 7 };
const ALLOWED_DIRECTIONS = {
  easy: new Set(["0,1", "1,0"]),
  medium: new Set(["0,1", "1,0", "1,1", "1,-1"]),
  hard: new Set([
    "0,1",
    "1,0",
    "1,1",
    "1,-1",
    "0,-1",
    "-1,0",
    "-1,-1",
    "-1,1",
  ]),
};

function directionFor(positions, size) {
  const first = positions[0];
  const second = positions[1];
  return `${Math.sign(Math.floor(second / size) - Math.floor(first / size))},${Math.sign((second % size) - (first % size))}`;
}

function assertStraightPath(positions, size) {
  assert.ok(positions.length >= 2);
  const step = directionFor(positions, size);
  const [rowStep, columnStep] = step.split(",").map(Number);
  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1];
    const current = positions[index];
    assert.equal(
      Math.floor(current / size) - Math.floor(previous / size),
      rowStep,
    );
    assert.equal(current % size - (previous % size), columnStep);
  }
  return step;
}

function assertCrossingRules(puzzle) {
  const cells = new Map();
  for (const placed of puzzle.words) {
    for (const position of placed.positions) {
      const users = cells.get(position) ?? [];
      users.push(placed.word);
      cells.set(position, users);
    }
  }

  const crossingCells = [...cells.values()].filter((users) => users.length > 1);
  assert.ok(crossingCells.length >= Math.ceil(puzzle.words.length / 3));
  for (const users of cells.values()) assert.ok(users.length <= 2);

  for (let first = 0; first < puzzle.words.length; first += 1) {
    const firstPositions = new Set(puzzle.words[first].positions);
    for (let second = first + 1; second < puzzle.words.length; second += 1) {
      const overlap = puzzle.words[second].positions.filter((position) =>
        firstPositions.has(position),
      );
      assert.ok(overlap.length <= 1);
    }
  }
}

function assertGeneratedBoard(difficulty, puzzle) {
  const level = generator.LEVELS[difficulty];
  assert.equal(puzzle.words.length, level.count);
  assert.ok(level.count > LEGACY_COUNTS[difficulty]);
  assert.equal(puzzle.letters.length, puzzle.size * puzzle.size);
  for (const letter of puzzle.letters) assert.match(letter, /^[A-Z]$/);

  const words = new Set();
  const directions = new Map();
  for (const placed of puzzle.words) {
    assert.equal(words.has(placed.word), false);
    words.add(placed.word);
    assert.ok(
      VOCABULARY.some(
        (candidate) =>
          candidate.level === difficulty &&
          candidate.word === placed.word &&
          candidate.meaning === placed.meaning &&
          candidate.partOfSpeech === placed.partOfSpeech,
      ),
    );
    assert.equal(placed.positions.length, placed.word.length);
    for (const position of placed.positions) {
      assert.ok(Number.isInteger(position));
      assert.ok(position >= 0 && position < puzzle.size * puzzle.size);
    }
    const direction = assertStraightPath(placed.positions, puzzle.size);
    assert.ok(ALLOWED_DIRECTIONS[difficulty].has(direction));
    directions.set(direction, (directions.get(direction) ?? 0) + 1);
  }

  const counts = [...directions.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.equal(directions.size, ALLOWED_DIRECTIONS[difficulty].size);
  const traits = traitsFor(puzzle);
  const orientations = new Set(traits.map(({ orientation }) => orientation));
  assert.deepEqual(
    orientations,
    new Set(
      difficulty === "easy"
        ? ["horizontal", "vertical"]
        : ["horizontal", "vertical", "diagonal"],
    ),
  );
  if (difficulty === "hard") {
    assert.deepEqual(
      new Set(traits.map(({ order }) => order)),
      new Set(["forward", "reverse"]),
    );
  }
  assertSpelledCorrectly(puzzle);
  assertCrossingRules(puzzle);
}

function withSeed(seed, callback) {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

test("generated boards use balanced, legal, crossing word placements", () => {
  withSeed(0x6d2b79f5, () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (let index = 0; index < 12; index += 1) {
        assertGeneratedBoard(difficulty, generator.makePuzzle(difficulty));
      }
    }
  });
});

test("directionTraits classifies orientation and reading order", () => {
  assert.deepEqual(generator.directionTraits([0, 1, 2], 3), {
    orientation: "horizontal",
    order: "forward",
  });
  assert.deepEqual(generator.directionTraits([6, 3, 0], 3), {
    orientation: "vertical",
    order: "reverse",
  });
  assert.deepEqual(generator.directionTraits([8, 4, 0], 3), {
    orientation: "diagonal",
    order: "reverse",
  });
});

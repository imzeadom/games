import { VOCABULARY, type VocabularyWord } from "./vocabulary";

export type Difficulty = "easy" | "medium" | "hard";
export type Word = Pick<
  VocabularyWord,
  "word" | "meaning" | "partOfSpeech"
>;
export type PlacedWord = Word & { positions: number[] };
export type Puzzle = {
  size: number;
  letters: string[];
  words: PlacedWord[];
};

type Orientation = "horizontal" | "vertical" | "diagonal";
type ReadingOrder = "forward" | "reverse";
type Direction = {
  rowStep: number;
  columnStep: number;
  orientation: Orientation;
  order: ReadingOrder;
};
type DirectionTraits = Pick<Direction, "orientation" | "order">;
type Requirement = Partial<DirectionTraits>;
type Level = {
  label: "简单" | "中等" | "困难";
  description: string;
  size: number;
  count: number;
  directions: Direction[];
};

const RIGHT: Direction = {
  rowStep: 0,
  columnStep: 1,
  orientation: "horizontal",
  order: "forward",
};
const DOWN: Direction = {
  rowStep: 1,
  columnStep: 0,
  orientation: "vertical",
  order: "forward",
};
const DOWN_RIGHT: Direction = {
  rowStep: 1,
  columnStep: 1,
  orientation: "diagonal",
  order: "forward",
};
const DOWN_LEFT: Direction = {
  rowStep: 1,
  columnStep: -1,
  orientation: "diagonal",
  order: "forward",
};
const LEFT: Direction = {
  rowStep: 0,
  columnStep: -1,
  orientation: "horizontal",
  order: "reverse",
};
const UP: Direction = {
  rowStep: -1,
  columnStep: 0,
  orientation: "vertical",
  order: "reverse",
};
const UP_LEFT: Direction = {
  rowStep: -1,
  columnStep: -1,
  orientation: "diagonal",
  order: "reverse",
};
const UP_RIGHT: Direction = {
  rowStep: -1,
  columnStep: 1,
  orientation: "diagonal",
  order: "reverse",
};

export const LEVELS: Record<Difficulty, Level> = {
  easy: {
    label: "简单",
    description: "5 个生活词汇 · 横向与纵向",
    size: 9,
    count: 5,
    directions: [RIGHT, DOWN],
  },
  medium: {
    label: "中等",
    description: "6 个常用词汇 · 加入斜线",
    size: 10,
    count: 6,
    directions: [RIGHT, DOWN, DOWN_RIGHT, DOWN_LEFT],
  },
  hard: {
    label: "困难",
    description: "7 个进阶词汇 · 含倒序",
    size: 12,
    count: 7,
    directions: [
      RIGHT,
      DOWN,
      DOWN_RIGHT,
      DOWN_LEFT,
      LEFT,
      UP,
      UP_LEFT,
      UP_RIGHT,
    ],
  },
};

const REQUIREMENTS: Record<Difficulty, Requirement[]> = {
  easy: [{ orientation: "horizontal" }, { orientation: "vertical" }],
  medium: [
    { orientation: "horizontal" },
    { orientation: "vertical" },
    { orientation: "diagonal" },
  ],
  hard: [
    { orientation: "horizontal", order: "forward" },
    { orientation: "vertical", order: "reverse" },
    { orientation: "diagonal" },
  ],
};

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function sampleVocabulary(difficulty: Difficulty, count: number): Word[] {
  return shuffled(
    VOCABULARY.filter(
      (candidate) =>
        candidate.level === difficulty &&
        candidate.word.length <= LEVELS[difficulty].size,
    ),
  )
    .slice(0, count)
    .map(({ word, meaning, partOfSpeech }) => ({
      word,
      meaning,
      partOfSpeech,
    }));
}

function matchesRequirement(
  direction: Direction,
  requirement?: Requirement,
) {
  return (
    !requirement ||
    ((!requirement.orientation ||
      direction.orientation === requirement.orientation) &&
      (!requirement.order || direction.order === requirement.order))
  );
}

function placementFor(
  item: Word,
  letters: string[],
  level: Level,
  requirement?: Requirement,
) {
  const starts = Array.from(
    { length: level.size * level.size },
    (_, position) => position,
  );
  let attempts = 0;

  for (const direction of shuffled(
    level.directions.filter((candidate) =>
      matchesRequirement(candidate, requirement),
    ),
  )) {
    for (const start of shuffled(starts)) {
      if (attempts >= 240) return null;
      attempts += 1;

      const startRow = Math.floor(start / level.size);
      const startColumn = start % level.size;
      const endRow = startRow + direction.rowStep * (item.word.length - 1);
      const endColumn =
        startColumn + direction.columnStep * (item.word.length - 1);
      if (
        endRow < 0 ||
        endColumn < 0 ||
        endRow >= level.size ||
        endColumn >= level.size
      ) {
        continue;
      }

      const positions = Array.from(
        { length: item.word.length },
        (_, index) =>
          (startRow + direction.rowStep * index) * level.size +
          startColumn +
          direction.columnStep * index,
      );
      if (
        positions.every(
          (position, index) =>
            !letters[position] || letters[position] === item.word[index],
        )
      ) {
        return positions;
      }
    }
  }

  return null;
}

export function directionTraits(
  positions: number[],
  size: number,
): DirectionTraits {
  if (positions.length < 2) {
    throw new Error("A placed word needs at least two positions");
  }

  const start = positions[0];
  const end = positions[positions.length - 1];
  const startRow = Math.floor(start / size);
  const startColumn = start % size;
  const endRow = Math.floor(end / size);
  const endColumn = end % size;
  const rowStep = Math.sign(endRow - startRow);
  const columnStep = Math.sign(endColumn - startColumn);
  const orientation =
    rowStep === 0
      ? "horizontal"
      : columnStep === 0
        ? "vertical"
        : "diagonal";
  const order = rowStep < 0 || (rowStep === 0 && columnStep < 0)
    ? "reverse"
    : "forward";

  return { orientation, order };
}

function satisfiesRequirements(
  difficulty: Difficulty,
  placed: PlacedWord[],
  size: number,
) {
  const traits = placed.map((word) => directionTraits(word.positions, size));
  return REQUIREMENTS[difficulty].every((requirement) =>
    traits.some(
      (candidate) =>
        (!requirement.orientation ||
          candidate.orientation === requirement.orientation) &&
        (!requirement.order || candidate.order === requirement.order),
    ),
  );
}

export function makePuzzle(difficulty: Difficulty): Puzzle {
  const level = LEVELS[difficulty];
  const selectedWords = sampleVocabulary(difficulty, level.count);

  for (let boardAttempt = 0; boardAttempt < 40; boardAttempt += 1) {
    const letters = Array(level.size * level.size).fill("") as string[];
    const placed: PlacedWord[] = [];
    const requirements = shuffled(REQUIREMENTS[difficulty]);
    const words = [...selectedWords].sort(
      (first, second) => second.word.length - first.word.length,
    );

    for (const [index, item] of words.entries()) {
      const positions = placementFor(
        item,
        letters,
        level,
        requirements[index],
      );
      if (!positions) break;

      positions.forEach((position, letterIndex) => {
        letters[position] = item.word[letterIndex];
      });
      placed.push({ ...item, positions });
    }

    if (
      placed.length === selectedWords.length &&
      satisfiesRequirements(difficulty, placed, level.size)
    ) {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return {
        size: level.size,
        letters: letters.map(
          (letter) =>
            letter || alphabet[Math.floor(Math.random() * alphabet.length)],
        ),
        words: shuffled(placed),
      };
    }
  }

  throw new Error("Unable to generate crossword puzzle");
}

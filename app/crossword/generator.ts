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
    description: "10 个生活词汇 · 横向与纵向",
    size: 9,
    count: 10,
    directions: [RIGHT, DOWN],
  },
  medium: {
    label: "中等",
    description: "12 个常用词汇 · 加入斜线",
    size: 10,
    count: 12,
    directions: [RIGHT, DOWN, DOWN_RIGHT, DOWN_LEFT],
  },
  hard: {
    label: "困难",
    description: "10 个进阶词汇 · 含八向倒序",
    size: 12,
    count: 10,
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

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

type Slot = { positions: number[]; direction: Direction; length: number };
type Candidate = { word: Word; slot: Slot };

function candidatesFor(level: Level, length: number): Slot[] {
  const result: Slot[] = [];
  for (const direction of level.directions) {
    for (let row = 0; row < level.size; row += 1) {
      for (let column = 0; column < level.size; column += 1) {
        const endRow = row + direction.rowStep * (length - 1);
        const endColumn = column + direction.columnStep * (length - 1);
        if (endRow < 0 || endColumn < 0 || endRow >= level.size || endColumn >= level.size) continue;
        result.push({
          direction,
          length,
          positions: Array.from({ length }, (_, index) =>
            (row + direction.rowStep * index) * level.size + column + direction.columnStep * index),
        });
      }
    }
  }
  return result;
}

const SLOT_CACHE = new Map<string, Slot[]>();
function cachedCandidates(level: Level, length: number, direction: Direction): Slot[] {
  const directionIndex = level.directions.indexOf(direction);
  const key = `${level.size}:${length}:${directionIndex}`;
  const cached = SLOT_CACHE.get(key);
  if (cached) return cached;
  const result = candidatesFor(level, length).filter((slot) => slot.direction === direction);
  SLOT_CACHE.set(key, result);
  return result;
}

const VOCABULARY_CACHE = new Map<string, Map<number, Word[]>>();
function vocabularyByLength(difficulty: Difficulty, size: number) {
  const key = `${difficulty}:${size}`;
  const cached = VOCABULARY_CACHE.get(key);
  if (cached) return cached;
  const map = new Map<number, Word[]>();
  for (const item of VOCABULARY) {
    if (item.level !== difficulty || item.word.length > size) continue;
    const list = map.get(item.word.length) ?? [];
    list.push({ word: item.word, meaning: item.meaning, partOfSpeech: item.partOfSpeech });
    map.set(item.word.length, list);
  }
  VOCABULARY_CACHE.set(key, map);
  return map;
}

function makeLengthPlan(difficulty: Difficulty, count: number, words: Map<number, Word[]>): number[] {
  const available = [...words.keys()].filter((length) => (words.get(length)?.length ?? 0) > 0);
  if (difficulty === "hard" && available.includes(9)) {
    // Keep scarce buckets within their capacity. Long words are assigned to
    // straight directions by directionSchedule, where they have much more room.
    const plan = Array(count).fill(9);
    if (available.includes(10)) {
      plan[count - 1] = 10;
      plan[count - 2] = 10;
    }
    if (available.includes(11) && Math.random() < 0.2) plan[count - 1] = 11;
    return shuffled(plan);
  }
  const plan: number[] = [];
  const used = new Map<number, number>();
  while (plan.length < count) {
    const remaining = available.filter((length) =>
      (used.get(length) ?? 0) < (words.get(length)?.length ?? 0),
    );
    const pool = remaining.flatMap((length) =>
      Array(Math.max(1, Math.min(8, Math.floor((words.get(length)?.length ?? 0) / 8)))).fill(length),
    );
    const length = pool[Math.floor(Math.random() * pool.length)] ?? remaining[0] ?? available[0];
    plan.push(length);
    used.set(length, (used.get(length) ?? 0) + 1);
  }
  return shuffled(plan);
}

function directionSchedule(level: Level, count: number): Direction[] {
  const schedule: Direction[] = [];
  while (schedule.length + level.directions.length <= count) schedule.push(...shuffled(level.directions));
  schedule.push(...shuffled(level.directions).slice(0, count - schedule.length));
  return schedule;
}

function buildSlots(level: Level, lengths: number[], difficulty: Difficulty): Slot[] | null {
  const schedule = directionSchedule(level, lengths.length);
  if (difficulty === "hard") {
    // Reserve the two long slots for straight lines; swapping directions keeps
    // the precomputed direction quota unchanged.
    for (let index = 0; index < lengths.length; index += 1) {
      if (lengths[index] < 10 || schedule[index].orientation !== "diagonal") continue;
      const swap = schedule.findIndex((direction, candidateIndex) =>
        candidateIndex !== index && direction.orientation !== "diagonal" && lengths[candidateIndex] < 10,
      );
      if (swap >= 0) [schedule[index], schedule[swap]] = [schedule[swap], schedule[index]];
    }
  }
  const paired = lengths.map((length, index) => ({ length, direction: schedule[index] }));
  // Place the most constrained geometry first. Long hard words are moved to
  // horizontal/vertical slots so diagonal capacity remains available.
  paired.sort((a, b) => cachedCandidates(level, a.length, a.direction).length -
    cachedCandidates(level, b.length, b.direction).length);
  const slots: Slot[] = [];
  const usage = new Uint8Array(level.size * level.size);
  const owners: number[][] = Array.from({ length: level.size * level.size }, () => []);
  const directionCount = new Map<Direction, number>();
  const targetCrossings = Math.ceil(lengths.length / 3);
  let crossingCells = 0;
  let nodes = 0;
  const geometryNodeLimit = 70;
  const geometryCandidateLimit = 8;
  const search = (): boolean => {
    if (++nodes > geometryNodeLimit) return false;
    if (slots.length === lengths.length) {
      const counts = level.directions.map((direction) => slots.filter((slot) => slot.direction === direction).length);
      const balanced = Math.max(...counts) - Math.min(...counts) <= 1;
      const covered = difficulty === "hard" ? counts.every((count) => count > 0) : true;
      return balanced && covered && crossingCells >= targetCrossings;
    }
    const { length, direction: plannedDirection } = paired[slots.length];
    const options: Array<{ slot: Slot; score: number }> = [];
    const candidates = shuffled(cachedCandidates(level, length, plannedDirection));
    const maxPerDirection = Math.ceil(lengths.length / level.directions.length);
    for (const candidate of candidates) {
      if ((directionCount.get(candidate.direction) ?? 0) >= maxPerDirection) continue;
      let crossings = 0;
      let valid = true;
      const touched: number[] = [];
      for (const position of candidate.positions) {
        if (usage[position] >= 2) { valid = false; break; }
        for (const owner of owners[position]) {
          const existing = slots[owner];
          const parallel = existing.direction.rowStep * candidate.direction.columnStep ===
            existing.direction.columnStep * candidate.direction.rowStep;
          if (parallel || touched.includes(owner)) { valid = false; break; }
          touched.push(owner);
          crossings += 1;
        }
        if (!valid) break;
        if (crossings > 3) { valid = false; break; }
      }
      if (!valid) continue;
      const score = (crossingCells < targetCrossings ? crossings * 100 : -crossings * 8) -
        crossings * crossings + Math.random() * 4;
      options.push({ slot: candidate, score });
    }
    options.sort((a, b) => b.score - a.score);
    for (const option of options.slice(0, geometryCandidateLimit)) {
      const candidate = option.slot;
      const oldCrossingCells = crossingCells;
      slots.push(candidate);
      directionCount.set(candidate.direction, (directionCount.get(candidate.direction) ?? 0) + 1);
      for (const position of candidate.positions) {
        if (usage[position] === 1) crossingCells += 1;
        usage[position] += 1;
        owners[position].push(slots.length - 1);
      }
      if (search()) return true;
      for (const position of candidate.positions) {
        usage[position] -= 1;
        owners[position].pop();
      }
      crossingCells = oldCrossingCells;
      directionCount.set(candidate.direction, (directionCount.get(candidate.direction) ?? 1) - 1);
      slots.pop();
    }
    return false;
  };
  return search() ? slots : null;
}

function solveWords(slots: Slot[], words: Map<number, Word[]>): Candidate[] | null {
  const domains = slots.map((slot) => shuffled(words.get(slot.length) ?? []));
  const chosen: Array<Word | null> = slots.map(() => null);
  const used = new Set<string>();
  const edges = slots.map(() => [] as Array<{ other: number; at: number; otherAt: number }>);
  for (let index = 0; index < slots.length; index += 1) {
    for (let other = index + 1; other < slots.length; other += 1) {
      const otherPositions = new Map(slots[other].positions.map((position, at) => [position, at]));
      for (let at = 0; at < slots[index].positions.length; at += 1) {
        const otherAt = otherPositions.get(slots[index].positions[at]);
        if (otherAt !== undefined) {
          edges[index].push({ other, at, otherAt });
          edges[other].push({ other: index, at: otherAt, otherAt: at });
        }
      }
    }
  }
  // Arc consistency removes geometrically valid layouts whose crossing
  // letters have no support in the vocabulary before backtracking starts.
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < slots.length; index += 1) {
      for (const { other, at, otherAt } of edges[index]) {
        const supported = new Set(domains[other].map((candidate) => candidate.word[otherAt]));
        const filtered = domains[index].filter((word) => supported.has(word.word[at]));
        if (filtered.length !== domains[index].length) { domains[index] = filtered; changed = true; }
        if (!domains[index].length) return null;
      }
    }
  }
  const fits = (index: number, word: Word) => edges[index].every(({ other, at, otherAt }) =>
    !chosen[other] || chosen[other]!.word[otherAt] === word.word[at]);
  let nodes = 0;
  const wordNodeLimit = 700;
  const search = (remaining: number): boolean => {
    if (++nodes > wordNodeLimit) return false;
    if (!remaining) return true;
    let best = -1;
    let options: Word[] = [];
    for (let index = 0; index < slots.length; index += 1) {
      if (chosen[index]) continue;
      const possible = domains[index].filter((word) => !used.has(word.word) && fits(index, word));
      if (best < 0 || possible.length < options.length) { best = index; options = possible; }
      if (!options.length) return false;
    }
    for (const word of options) {
      chosen[best] = word; used.add(word.word);
      if (search(remaining - 1)) return true;
      chosen[best] = null; used.delete(word.word);
    }
    return false;
  };
  if (!search(slots.length)) return null;
  return slots.map((slot, index) => ({ word: chosen[index]!, slot }));
}

function satisfiesRequirements(difficulty: Difficulty, placed: PlacedWord[], size: number) {
  const traits = placed.map((word) => directionTraits(word.positions, size));
  return REQUIREMENTS[difficulty].every((requirement) => traits.some((candidate) =>
    (!requirement.orientation || candidate.orientation === requirement.orientation) &&
    (!requirement.order || candidate.order === requirement.order)));
}

export function makePuzzle(difficulty: Difficulty): Puzzle {
  const level = LEVELS[difficulty];
  const words = vocabularyByLength(difficulty, level.size);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const lengthPlan = makeLengthPlan(difficulty, level.count, words);
    const slots = buildSlots(level, lengthPlan, difficulty);
    if (!slots) continue;
    const solved = solveWords(slots, words);
    if (!solved) continue;
    const placed = solved.map(({ word, slot }) => ({ ...word, positions: [...slot.positions] }));
    if (!satisfiesRequirements(difficulty, placed, level.size)) continue;
    const letters = Array(level.size * level.size).fill("") as string[];
    for (const item of placed) item.positions.forEach((position, index) => { letters[position] = item.word[index]; });
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return { size: level.size, letters: letters.map((letter) => letter || alphabet[Math.floor(Math.random() * alphabet.length)]), words: shuffled(placed) };
  }
  throw new Error("Unable to generate crossword puzzle");
}

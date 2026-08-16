export type GameId =
  | "sudoku"
  | "merge-1024"
  | "sky-hop"
  | "twilight-canopy"
  | "maze"
  | "crossword"
  | "hanzi-listen";

export type ScoreEntry = {
  id: string;
  gameId: GameId;
  gameName: string;
  difficulty?: "简单" | "中等" | "困难";
  score?: number;
  elapsed?: number;
  moves?: number;
  mistakes?: number;
  detail: string;
  completed: boolean;
  createdAt: string;
};

export const SCORE_HISTORY_KEY = "paper-arcade-score-history-v1";
const LEGACY_MIGRATION_KEY = "paper-arcade-score-history-migrated-v1";
export const MAX_SCORE_HISTORY_ENTRIES = 120;

let cachedRawHistory: string | null | undefined;
let cachedEntries: ScoreEntry[] = [];

function parseEntries(value: string | null): ScoreEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Safari can deny storage access in some private/embedded contexts.
    return null;
  }
}

function entryTime(entry: ScoreEntry): number {
  const timestamp = Date.parse(entry.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeEntries(entries: ScoreEntry[]): ScoreEntry[] {
  const bounded = entries.slice(0, MAX_SCORE_HISTORY_ENTRIES);
  const isNewestFirst = bounded.every(
    (entry, index) =>
      index === 0 || entryTime(bounded[index - 1]) >= entryTime(entry),
  );

  if (entries.length <= MAX_SCORE_HISTORY_ENTRIES && isNewestFirst) {
    return bounded;
  }

  return [...entries]
    .sort((first, second) => entryTime(second) - entryTime(first))
    .slice(0, MAX_SCORE_HISTORY_ENTRIES);
}

function writeEntries(storage: Storage, entries: ScoreEntry[]): void {
  const normalized = normalizeEntries(entries);
  const raw = JSON.stringify(normalized);
  try {
    storage.setItem(SCORE_HISTORY_KEY, raw);
    cachedRawHistory = raw;
    cachedEntries = normalized;
  } catch {
    // A score should never make the game itself fail when storage is full.
  }
}

function readEntries(storage: Storage): ScoreEntry[] {
  let raw: string | null;
  try {
    raw = storage.getItem(SCORE_HISTORY_KEY);
  } catch {
    return [];
  }

  if (raw === cachedRawHistory) return cachedEntries;

  const parsed = parseEntries(raw);
  const normalized = normalizeEntries(parsed);
  cachedRawHistory = raw;
  cachedEntries = normalized;

  // Compact histories written by older versions once, so future reads stay small.
  if (
    normalized.length !== parsed.length ||
    normalized.some((entry, index) => entry !== parsed[index])
  ) {
    writeEntries(storage, normalized);
  }
  return normalized;
}

function migrateLegacyHistory(storage: Storage): void {
  try {
    if (storage.getItem(LEGACY_MIGRATION_KEY)) return;
  } catch {
    return;
  }

  const migrated: ScoreEntry[] = [];
  const now = new Date().toISOString();
  const addLegacy = (entry: Omit<ScoreEntry, "id" | "createdAt">) => {
    migrated.push({
      ...entry,
      id: `legacy-${entry.gameId}`,
      createdAt: now,
    });
  };

  try {
    const merge = JSON.parse(
      storage.getItem("paper-arcade-1024") ?? "{}",
    ) as { best?: number };
    if (Number(merge.best) > 0) {
      addLegacy({
        gameId: "merge-1024",
        gameName: "合成 1024",
        score: Number(merge.best),
        detail: "从原有最佳纪录迁移",
        completed: false,
      });
    }
  } catch {
    // A broken legacy value should not block the rest of the history.
  }

  const skyBest = Number(storage.getItem("paper-arcade-sky-hop-best") ?? 0);
  if (Number.isFinite(skyBest) && skyBest > 0) {
    addLegacy({
      gameId: "sky-hop",
      gameName: "云雀跃",
      score: skyBest,
      detail: "从原有最佳纪录迁移",
      completed: false,
    });
  }

  try {
    const twilight = JSON.parse(
      storage.getItem("paper-arcade-twilight-canopy") ?? "{}",
    ) as { best?: string };
    const best = Number(twilight.best ?? 0);
    if (Number.isFinite(best) && best > 0) {
      addLegacy({
        gameId: "twilight-canopy",
        gameName: "暮色拾星",
        score: Math.min(best, Number.MAX_SAFE_INTEGER),
        detail: "从原有最佳纪录迁移",
        completed: false,
      });
    }
  } catch {
    // Ignore only the invalid legacy record.
  }

  try {
    const sudoku = JSON.parse(
      storage.getItem("paper-sudoku-current-game") ?? "{}",
    ) as {
      completed?: boolean;
      recorded?: boolean;
      difficulty?: "easy" | "medium" | "hard";
      elapsed?: number;
      mistakes?: number;
    };
    if (sudoku.completed && !sudoku.recorded) {
      const difficulty = {
        easy: "简单",
        medium: "中等",
        hard: "困难",
      } as const;
      addLegacy({
        gameId: "sudoku",
        gameName: "纸上数独",
        difficulty: difficulty[sudoku.difficulty ?? "easy"],
        elapsed: sudoku.elapsed ?? 0,
        mistakes: sudoku.mistakes ?? 0,
        detail: `${formatDuration(sudoku.elapsed ?? 0)} 完成 · ${
          sudoku.mistakes ?? 0
        } 次错误`,
        completed: true,
      });
    }
  } catch {
    // Ignore only the invalid legacy record.
  }

  if (migrated.length) {
    writeEntries(storage, [...readEntries(storage), ...migrated]);
  }
  try {
    storage.setItem(LEGACY_MIGRATION_KEY, "1");
  } catch {
    // Storage can become unavailable while an iOS app is backgrounded.
  }
}

export function getScoreHistory(): ScoreEntry[] {
  const storage = getLocalStorage();
  if (!storage) return [];
  migrateLegacyHistory(storage);
  return [...readEntries(storage)];
}

export function recordScore(
  entry: Omit<ScoreEntry, "id" | "createdAt">,
): ScoreEntry {
  const completeEntry: ScoreEntry = {
    ...entry,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const storage = getLocalStorage();
  if (storage) {
    migrateLegacyHistory(storage);
    writeEntries(storage, [completeEntry, ...readEntries(storage)]);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("paper-arcade-score-recorded"));
  }
  return completeEntry;
}

export function clearScoreHistory(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(SCORE_HISTORY_KEY);
  } catch {
    return;
  }
  cachedRawHistory = null;
  cachedEntries = [];
  window.dispatchEvent(new CustomEvent("paper-arcade-score-recorded"));
}

export function formatDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export type GameId =
  | "sudoku"
  | "merge-1024"
  | "sky-hop"
  | "twilight-canopy"
  | "maze"
  | "crossword";

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
const MAX_ENTRIES = 120;

function parseEntries(value: string | null): ScoreEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

export function getScoreHistory(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  if (!window.localStorage.getItem(LEGACY_MIGRATION_KEY)) {
    const migrated: ScoreEntry[] = [];
    const now = new Date().toISOString();
    const addLegacy = (
      entry: Omit<ScoreEntry, "id" | "createdAt">,
    ) => {
      migrated.push({
        ...entry,
        id: `legacy-${entry.gameId}`,
        createdAt: now,
      });
    };

    try {
      const merge = JSON.parse(
        window.localStorage.getItem("paper-arcade-1024") ?? "{}",
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

    const skyBest = Number(
      window.localStorage.getItem("paper-arcade-sky-hop-best") ?? 0,
    );
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
        window.localStorage.getItem("paper-arcade-twilight-canopy") ?? "{}",
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
        window.localStorage.getItem("paper-sudoku-current-game") ?? "{}",
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
      const current = parseEntries(
        window.localStorage.getItem(SCORE_HISTORY_KEY),
      );
      window.localStorage.setItem(
        SCORE_HISTORY_KEY,
        JSON.stringify([...current, ...migrated].slice(0, MAX_ENTRIES)),
      );
    }
    window.localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
  }
  return parseEntries(window.localStorage.getItem(SCORE_HISTORY_KEY)).sort(
    (first, second) =>
      new Date(second.createdAt).getTime() -
      new Date(first.createdAt).getTime(),
  );
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
  const entries = [completeEntry, ...getScoreHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent("paper-arcade-score-recorded"));
  return completeEntry;
}

export function clearScoreHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SCORE_HISTORY_KEY);
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { recordScore } from "../lib/score-history";

type Difficulty = "easy" | "medium" | "hard";
type Notes = Record<number, number[]>;
type SavedGame = {
  difficulty: Difficulty;
  puzzle: number[];
  solution: number[];
  values: number[];
  notes: Notes;
  elapsed: number;
  mistakes: number;
  completed: boolean;
  recorded?: boolean;
  completionDismissed?: boolean;
};

const DIFFICULTIES: Record<
  Difficulty,
  {
    label: "简单" | "中等" | "困难";
    description: string;
    puzzle: string;
  }
> = {
  easy: {
    label: "简单",
    description: "轻松热身",
    puzzle:
      "530670902670195300098300567850761023406803701710924056061500280287419005005286179",
  },
  medium: {
    label: "中等",
    description: "需要推理",
    puzzle:
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  },
  hard: {
    label: "困难",
    description: "耐心挑战",
    puzzle:
      "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
  },
};

const STORAGE_KEY = "paper-sudoku-current-game";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function solvePuzzle(puzzle: number[]): number[] {
  const board = [...puzzle];

  function solve(): boolean {
    let target = -1;
    let candidates: number[] = [];

    for (let cell = 0; cell < 81; cell += 1) {
      if (board[cell] !== 0) continue;

      const row = Math.floor(cell / 9);
      const column = cell % 9;
      const used = new Set<number>();

      for (let index = 0; index < 9; index += 1) {
        used.add(board[row * 9 + index]);
        used.add(board[index * 9 + column]);
      }

      const boxRow = Math.floor(row / 3) * 3;
      const boxColumn = Math.floor(column / 3) * 3;
      for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
          used.add(board[(boxRow + rowOffset) * 9 + boxColumn + columnOffset]);
        }
      }

      const available = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (number) => !used.has(number),
      );

      if (available.length === 0) return false;
      if (target === -1 || available.length < candidates.length) {
        target = cell;
        candidates = available;
      }
    }

    if (target === -1) return true;

    for (const candidate of candidates) {
      board[target] = candidate;
      if (solve()) return true;
    }

    board[target] = 0;
    return false;
  }

  solve();
  return board;
}

function createGame(difficulty: Difficulty): SavedGame {
  const basePuzzle = DIFFICULTIES[difficulty].puzzle
    .split("")
    .map(Number);
  const baseSolution = solvePuzzle(basePuzzle);

  const digitOrder = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digitMap = new Map(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit, index) => [
      digit,
      digitOrder[index],
    ]),
  );
  const bandOrder = shuffle([0, 1, 2]);
  const stackOrder = shuffle([0, 1, 2]);
  const rowOrder = bandOrder.flatMap((band) =>
    shuffle([0, 1, 2]).map((row) => band * 3 + row),
  );
  const columnOrder = stackOrder.flatMap((stack) =>
    shuffle([0, 1, 2]).map((column) => stack * 3 + column),
  );
  const transpose = Math.random() > 0.5;

  function transform(board: number[]): number[] {
    return Array.from({ length: 81 }, (_, index) => {
      const displayRow = Math.floor(index / 9);
      const displayColumn = index % 9;
      const sourceRow = transpose
        ? rowOrder[displayColumn]
        : rowOrder[displayRow];
      const sourceColumn = transpose
        ? columnOrder[displayRow]
        : columnOrder[displayColumn];
      const value = board[sourceRow * 9 + sourceColumn];
      return value === 0 ? 0 : digitMap.get(value) ?? value;
    });
  }

  const puzzle = transform(basePuzzle);
  return {
    difficulty,
    puzzle,
    solution: transform(baseSolution),
    values: [...puzzle],
    notes: {},
    elapsed: 0,
    mistakes: 0,
    completed: false,
  };
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function isPeer(first: number, second: number): boolean {
  const firstRow = Math.floor(first / 9);
  const firstColumn = first % 9;
  const secondRow = Math.floor(second / 9);
  const secondColumn = second % 9;
  return (
    firstRow === secondRow ||
    firstColumn === secondColumn ||
    (Math.floor(firstRow / 3) === Math.floor(secondRow / 3) &&
      Math.floor(firstColumn / 3) === Math.floor(secondColumn / 3))
  );
}

export default function Home() {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCompletion, setShowCompletion] = useState(true);
  const difficultyMenuRef = useRef<HTMLDivElement>(null);
  const completionRecordedRef = useRef(false);

  useEffect(() => {
    const initializeGame = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setGame(JSON.parse(saved) as SavedGame);
          return;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setGame(createGame("easy"));
    }, 0);

    return () => window.clearTimeout(initializeGame);
  }, []);

  useEffect(() => {
    if (!game) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  useEffect(() => {
    if (!game?.completed || game.recorded || completionRecordedRef.current) {
      return;
    }
    completionRecordedRef.current = true;
    setShowCompletion(true);
    recordScore({
      gameId: "sudoku",
      gameName: "纸上数独",
      difficulty: DIFFICULTIES[game.difficulty].label,
      elapsed: game.elapsed,
      mistakes: game.mistakes,
      detail: `${formatTime(game.elapsed)} 完成 · ${game.mistakes} 次错误`,
      completed: true,
    });
    setGame((current) =>
      current?.completed ? { ...current, recorded: true } : current,
    );
  }, [game]);

  const isGameRunning = Boolean(game && !game.completed);

  useEffect(() => {
    if (!isGameRunning) return;
    const timer = window.setInterval(() => {
      setGame((current) =>
        current && !current.completed
          ? { ...current, elapsed: current.elapsed + 1 }
          : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isGameRunning]);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (
        difficultyMenuRef.current &&
        !difficultyMenuRef.current.contains(event.target as Node)
      ) {
        setShowDifficulty(false);
      }
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const selectedNumber =
    game && selectedCell !== null ? game.values[selectedCell] : 0;

  const numberCounts = useMemo(() => {
    const counts = Array(10).fill(0) as number[];
    game?.values.forEach((value) => {
      if (value) counts[value] += 1;
    });
    return counts;
  }, [game]);

  const chooseDifficulty = (difficulty: Difficulty) => {
    completionRecordedRef.current = false;
    setShowCompletion(true);
    setGame(createGame(difficulty));
    setSelectedCell(null);
    setNoteMode(false);
    setShowDifficulty(false);
  };

  const dismissCompletion = () => {
    setShowCompletion(false);
    if (!game.completed) return;
    const dismissedGame = { ...game, completionDismissed: true };
    setGame(dismissedGame);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedGame));
  };

  const enterNumber = useCallback(
    (number: number) => {
      if (!game || selectedCell === null || game.completed) return;
      if (game.puzzle[selectedCell] !== 0) return;

      setGame((current) => {
        if (!current) return current;

        if (noteMode) {
          if (current.values[selectedCell] !== 0) return current;
          const currentNotes = current.notes[selectedCell] ?? [];
          const nextNotes = currentNotes.includes(number)
            ? currentNotes.filter((value) => value !== number)
            : [...currentNotes, number].sort();
          return {
            ...current,
            notes: { ...current.notes, [selectedCell]: nextNotes },
          };
        }

        const values = [...current.values];
        const wasCorrect = values[selectedCell] === current.solution[selectedCell];
        values[selectedCell] = number;
        const isCorrect = number === current.solution[selectedCell];
        const notes = { ...current.notes };
        delete notes[selectedCell];

        if (isCorrect) {
          for (let cell = 0; cell < 81; cell += 1) {
            if (isPeer(selectedCell, cell) && notes[cell]?.includes(number)) {
              notes[cell] = notes[cell].filter((value) => value !== number);
            }
          }
        }

        const completed = values.every(
          (value, index) => value === current.solution[index],
        );
        return {
          ...current,
          values,
          notes,
          mistakes:
            !isCorrect && !wasCorrect
              ? current.mistakes + 1
              : current.mistakes,
          completed,
        };
      });
    },
    [game, noteMode, selectedCell],
  );

  const eraseCell = useCallback(() => {
    if (!game || selectedCell === null || game.puzzle[selectedCell] !== 0) {
      return;
    }
    setGame((current) => {
      if (!current) return current;
      const values = [...current.values];
      const notes = { ...current.notes };
      values[selectedCell] = 0;
      delete notes[selectedCell];
      return { ...current, values, notes };
    });
  }, [game, selectedCell]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (showRules || !game) return;

      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        enterNumber(Number(event.key));
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        eraseCell();
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setNoteMode((current) => !current);
        return;
      }
      if (selectedCell === null || !event.key.startsWith("Arrow")) return;

      const row = Math.floor(selectedCell / 9);
      const column = selectedCell % 9;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const [rowChange, columnChange] = directions[event.key] ?? [0, 0];
      event.preventDefault();
      const nextRow = (row + rowChange + 9) % 9;
      const nextColumn = (column + columnChange + 9) % 9;
      setSelectedCell(nextRow * 9 + nextColumn);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enterNumber, eraseCell, game, selectedCell, showRules]);

  if (!game) {
    return (
      <main className="loading-screen" aria-live="polite">
        正在铺开棋盘…
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="返回纸上游戏厅">
          <span className="brand-mark" aria-hidden="true">
            九
          </span>
          <span>
            <strong>纸上数独</strong>
            <small>返回游戏厅</small>
          </span>
        </Link>
        <button className="rules-button" onClick={() => setShowRules(true)}>
          <span aria-hidden="true">?</span>
          游戏说明
        </button>
      </header>

      <section className="game-layout">
        <div className="game-copy">
          <p className="eyebrow">每日一局 · 保持专注</p>
          <h1>
            静下来，
            <br />
            找到唯一的答案。
          </h1>
          <p className="intro">
            选择难度，填满九宫格。每行、每列和每个宫内，数字 1–9
            都不能重复。
          </p>

          <div className="difficulty-picker" ref={difficultyMenuRef}>
            <span className="picker-label">当前难度</span>
            <button
              className="difficulty-button"
              aria-expanded={showDifficulty}
              onClick={() => setShowDifficulty((current) => !current)}
            >
              <span>
                <strong>{DIFFICULTIES[game.difficulty].label}</strong>
                <small>{DIFFICULTIES[game.difficulty].description}</small>
              </span>
              <span className="chevron" aria-hidden="true">
                {showDifficulty ? "⌃" : "⌄"}
              </span>
            </button>
            {showDifficulty && (
              <div className="difficulty-menu">
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map(
                  (difficulty) => (
                    <button
                      key={difficulty}
                      className={
                        difficulty === game.difficulty ? "is-current" : ""
                      }
                      onClick={() => chooseDifficulty(difficulty)}
                    >
                      <span>{DIFFICULTIES[difficulty].label}</span>
                      <small>{DIFFICULTIES[difficulty].description}</small>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="desktop-tip">
            <span aria-hidden="true">N</span>
            键盘提示：按 N 切换草稿，方向键移动
          </div>
        </div>

        <div className="game-panel">
          <div className="game-status" aria-label="本局状态">
            <div>
              <span>用时</span>
              <strong>{formatTime(game.elapsed)}</strong>
            </div>
            <div className="status-divider" />
            <div>
              <span>错误</span>
              <strong>{game.mistakes}</strong>
            </div>
            <button
              className="new-game-button"
              onClick={() => chooseDifficulty(game.difficulty)}
            >
              ↻ 新一局
            </button>
          </div>

          <div className="board-wrap">
            <div className="sudoku-board" role="grid" aria-label="数独棋盘">
              {game.values.map((value, cell) => {
                const row = Math.floor(cell / 9);
                const column = cell % 9;
                const isSelected = selectedCell === cell;
                const isRelated =
                  selectedCell !== null &&
                  (Math.floor(selectedCell / 9) === row ||
                    selectedCell % 9 === column);
                const isSame =
                  selectedNumber !== 0 && value === selectedNumber;
                const isGiven = game.puzzle[cell] !== 0;
                const isWrong =
                  !isGiven && value !== 0 && value !== game.solution[cell];
                const classes = [
                  "sudoku-cell",
                  isRelated && "is-related",
                  isSame && "is-same",
                  isSelected && "is-selected",
                  isGiven && "is-given",
                  isWrong && "is-wrong",
                  column % 3 === 2 && column !== 8 && "box-right",
                  row % 3 === 2 && row !== 8 && "box-bottom",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={cell}
                    className={classes}
                    role="gridcell"
                    aria-label={`第 ${row + 1} 行，第 ${column + 1} 列${
                      value ? `，数字 ${value}` : "，空格"
                    }`}
                    aria-selected={isSelected}
                    onClick={() => setSelectedCell(cell)}
                  >
                    {value !== 0 ? (
                      <span className="cell-value">{value}</span>
                    ) : (
                      <span className="notes-grid" aria-label="草稿数字">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((note) => (
                          <span key={note}>
                            {game.notes[cell]?.includes(note) ? note : ""}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="number-pad" aria-label="数字键盘">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
              <button
                key={number}
                disabled={numberCounts[number] === 9}
                onClick={() => enterNumber(number)}
              >
                {number}
                <small>{9 - numberCounts[number]}</small>
              </button>
            ))}
          </div>

          <div className="tool-row">
            <button
              className={noteMode ? "tool-button is-active" : "tool-button"}
              aria-pressed={noteMode}
              onClick={() => setNoteMode((current) => !current)}
            >
              <span className="pencil-icon" aria-hidden="true">
                ✎
              </span>
              草稿
              <small>{noteMode ? "开启" : "关闭"}</small>
            </button>
            <button className="tool-button" onClick={eraseCell}>
              <span aria-hidden="true">⌫</span>
              擦除
            </button>
          </div>
        </div>
      </section>

      <footer>
        <span>纸上数独</span>
        <span>随时开始，离线也能玩</span>
      </footer>

      {showRules && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowRules(false);
          }}
        >
          <section
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
          >
            <button
              className="modal-close"
              aria-label="关闭说明"
              onClick={() => setShowRules(false)}
            >
              ×
            </button>
            <p className="eyebrow">怎么玩</p>
            <h2 id="rules-title">填满每一个空格</h2>
            <ol>
              <li>
                <span>01</span>
                每行都要包含数字 1–9，且不能重复。
              </li>
              <li>
                <span>02</span>
                每列以及每个 3×3 宫也遵循同样规则。
              </li>
              <li>
                <span>03</span>
                不确定时打开“草稿”，记录候选数字；再次点击可删除单个草稿。
              </li>
            </ol>
            <button
              className="primary-button"
              onClick={() => setShowRules(false)}
            >
              明白了，继续游戏
            </button>
          </section>
        </div>
      )}

      {game.completed && !game.completionDismissed && showCompletion && (
        <div className="modal-backdrop">
          <section
            className="win-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="win-title"
          >
            <button
              className="modal-close"
              aria-label="关闭完成提示"
              onClick={dismissCompletion}
            >
              ×
            </button>
            <p className="eyebrow">完成挑战</p>
            <h2 id="win-title">漂亮的一局！</h2>
            <p>
              你用 {formatTime(game.elapsed)} 完成了
              {DIFFICULTIES[game.difficulty].label}数独，共记录{" "}
              {game.mistakes} 次错误。
            </p>
            <button
              className="primary-button"
              onClick={() => chooseDifficulty(game.difficulty)}
            >
              再来一局
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

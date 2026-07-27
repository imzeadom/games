"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";

type Direction = "left" | "right" | "up" | "down";
type MergeState = {
  board: number[];
  score: number;
  best: number;
  keepPlaying: boolean;
};

const STORAGE_KEY = "paper-arcade-1024";
const SIZE = 4;

function emptyBoard(): number[] {
  return Array(SIZE * SIZE).fill(0);
}

function addTile(board: number[]): number[] {
  const emptyCells = board
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  if (emptyCells.length === 0) return board;

  const next = [...board];
  const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  next[target] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function newGame(best = 0): MergeState {
  return {
    board: addTile(addTile(emptyBoard())),
    score: 0,
    best,
    keepPlaying: false,
  };
}

function lineIndices(direction: Direction, line: number): number[] {
  const forward = [0, 1, 2, 3];
  const backward = [...forward].reverse();

  if (direction === "left") return forward.map((column) => line * SIZE + column);
  if (direction === "right")
    return backward.map((column) => line * SIZE + column);
  if (direction === "up") return forward.map((row) => row * SIZE + line);
  return backward.map((row) => row * SIZE + line);
}

function mergeLine(values: number[]): { values: number[]; gained: number } {
  const compact = values.filter(Boolean);
  const merged: number[] = [];
  let gained = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const combined = compact[index] * 2;
      merged.push(combined);
      gained += combined;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }

  while (merged.length < SIZE) merged.push(0);
  return { values: merged, gained };
}

function moveBoard(
  board: number[],
  direction: Direction,
): { board: number[]; gained: number; moved: boolean } {
  const next = emptyBoard();
  let gained = 0;

  for (let line = 0; line < SIZE; line += 1) {
    const indices = lineIndices(direction, line);
    const result = mergeLine(indices.map((index) => board[index]));
    gained += result.gained;
    indices.forEach((index, valueIndex) => {
      next[index] = result.values[valueIndex];
    });
  }

  return {
    board: next,
    gained,
    moved: next.some((value, index) => value !== board[index]),
  };
}

function hasMoves(board: number[]): boolean {
  if (board.includes(0)) return true;
  return (["left", "right", "up", "down"] as Direction[]).some(
    (direction) => moveBoard(board, direction).moved,
  );
}

function tileStyle(value: number): CSSProperties {
  const palette: Record<number, [string, string]> = {
    2: ["#eee6d7", "#25362f"],
    4: ["#e4d6bd", "#25362f"],
    8: ["#d6a778", "#fffaf0"],
    16: ["#c8795e", "#fffaf0"],
    32: ["#b65d48", "#fffaf0"],
    64: ["#8e4038", "#fffaf0"],
    128: ["#6f8071", "#fffaf0"],
    256: ["#49675d", "#fffaf0"],
    512: ["#2f5148", "#fffaf0"],
    1024: ["#173e36", "#f4c76b"],
  };
  const [background, color] = palette[value] ?? ["#122d28", "#f4c76b"];
  return { "--tile-background": background, "--tile-color": color } as CSSProperties;
}

export default function Merge1024() {
  const [game, setGame] = useState<MergeState | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const touchStart = useRef<[number, number] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setGame(JSON.parse(saved) as MergeState);
          return;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setGame(newGame());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (game) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  const move = useCallback((direction: Direction) => {
    setGame((current) => {
      if (!current) return current;
      const result = moveBoard(current.board, direction);
      if (!result.moved) return current;

      const board = addTile(result.board);
      const score = current.score + result.gained;
      const best = Math.max(current.best, score);

      if (!current.keepPlaying && board.includes(1024)) setShowWin(true);
      if (!hasMoves(board)) setShowGameOver(true);

      return { ...current, board, score, best };
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const keys: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      if (keys[event.key]) {
        event.preventDefault();
        move(keys[event.key]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const reset = () => {
    setGame((current) => newGame(current?.best ?? 0));
    setShowWin(false);
    setShowGameOver(false);
  };

  const completeSwipe = (x: number, y: number) => {
    if (!touchStart.current) return;
    const [startX, startY] = touchStart.current;
    const deltaX = x - startX;
    const deltaY = y - startY;
    touchStart.current = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? "right" : "left");
    } else {
      move(deltaY > 0 ? "down" : "up");
    }
  };

  if (!game) {
    return <main className="loading-screen">正在摆好数字方块…</main>;
  }

  return (
    <main className="merge-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <span>合成 · 观察 · 再合成</span>
      </header>

      <section className="merge-layout">
        <div className="merge-copy">
          <p className="eyebrow">数字合成游戏</p>
          <h1>1024</h1>
          <p>
            用方向键或手指滑动。相同数字相遇时会合并，看看你能否抵达
            1024。
          </p>
          <div className="merge-scoreboard">
            <div>
              <span>本局分数</span>
              <strong>{game.score}</strong>
            </div>
            <div>
              <span>最佳纪录</span>
              <strong>{game.best}</strong>
            </div>
          </div>
          <button className="primary-button compact-button" onClick={reset}>
            重新开局
          </button>
        </div>

        <div className="merge-game">
          <div
            className="merge-board"
            role="application"
            aria-label="1024 游戏棋盘。使用方向键或滑动操作。"
            onPointerDown={(event) => {
              touchStart.current = [event.clientX, event.clientY];
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => completeSwipe(event.clientX, event.clientY)}
          >
            {game.board.map((value, index) => (
              <div
                className={value ? "merge-tile has-value" : "merge-tile"}
                key={index}
                style={value ? tileStyle(value) : undefined}
              >
                {value || ""}
              </div>
            ))}
          </div>
          <p className="merge-hint">
            <span aria-hidden="true">↔</span>
            滑动棋盘，或使用键盘方向键
          </p>
        </div>
      </section>

      {(showWin || showGameOver) && (
        <div className="modal-backdrop">
          <section className="win-modal" role="dialog" aria-modal="true">
            <div className="win-mark" aria-hidden="true">
              {showWin ? "1024" : "×"}
            </div>
            <p className="eyebrow">{showWin ? "目标达成" : "本局结束"}</p>
            <h2>{showWin ? "合成成功！" : "棋盘没有空间了"}</h2>
            <p>
              {showWin
                ? "你已经抵达 1024，可以继续挑战更大的数字。"
                : `本局得到 ${game.score} 分，再试一次吧。`}
            </p>
            {showWin && (
              <button
                className="secondary-button"
                onClick={() => {
                  setGame((current) =>
                    current ? { ...current, keepPlaying: true } : current,
                  );
                  setShowWin(false);
                }}
              >
                继续挑战
              </button>
            )}
            <button className="primary-button" onClick={reset}>
              新游戏
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

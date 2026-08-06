"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { recordScore } from "../lib/score-history";
import { PwaMenuActions } from "../pwa-register";

type Direction = "left" | "right" | "up" | "down";
type MergeState = {
  board: number[];
  score: number;
  best: number;
  keepPlaying: boolean;
};
type TileMovement = {
  from: number;
  to: number;
  value: number;
};
type MoveResult = {
  board: number[];
  gained: number;
  moved: boolean;
  movements: TileMovement[];
  mergedTargets: number[];
};
type TileEffects = {
  newIndex: number | null;
  mergedTargets: number[];
};

const STORAGE_KEY = "paper-arcade-1024";
const SIZE = 4;

function emptyBoard(): number[] {
  return Array(SIZE * SIZE).fill(0);
}

function addTile(board: number[]): number[] {
  return addTileWithIndex(board).board;
}

function addTileWithIndex(board: number[]): {
  board: number[];
  index: number | null;
} {
  const emptyCells = board
    .map((value, index) => (value === 0 ? index : -1))
    .filter((index) => index >= 0);
  if (emptyCells.length === 0) return { board, index: null };

  const next = [...board];
  const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  next[target] = Math.random() < 0.9 ? 2 : 4;
  return { board: next, index: target };
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

function moveBoard(board: number[], direction: Direction): MoveResult {
  const next = emptyBoard();
  const movements: TileMovement[] = [];
  const mergedTargets: number[] = [];
  let gained = 0;

  for (let line = 0; line < SIZE; line += 1) {
    const indices = lineIndices(direction, line);
    const tiles = indices
      .map((index) => ({ index, value: board[index] }))
      .filter((tile) => tile.value !== 0);
    let destination = 0;

    for (let source = 0; source < tiles.length; source += 1) {
      const tile = tiles[source];
      const matchingTile = tiles[source + 1];
      const target = indices[destination];

      movements.push({ from: tile.index, to: target, value: tile.value });

      if (matchingTile?.value === tile.value) {
        movements.push({
          from: matchingTile.index,
          to: target,
          value: matchingTile.value,
        });
        next[target] = tile.value * 2;
        gained += next[target];
        mergedTargets.push(target);
        source += 1;
      } else {
        next[target] = tile.value;
      }
      destination += 1;
    }
  }

  return {
    board: next,
    gained,
    moved: next.some((value, index) => value !== board[index]),
    movements,
    mergedTargets,
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

function cellOffset(position: number): string {
  if (position === 0) return "0px";
  const terms = Array.from(
    { length: position },
    () => "var(--merge-cell) + var(--merge-gap)",
  );
  return `calc(${terms.join(" + ")})`;
}

function movementDistance(distance: number): string {
  if (distance === 0) return "0px";
  const step =
    distance > 0
      ? "+ 100% + var(--merge-gap)"
      : "- 100% - var(--merge-gap)";
  return `calc(0px ${Array.from(
    { length: Math.abs(distance) },
    () => step,
  ).join(" ")})`;
}

export default function Merge1024() {
  const [game, setGame] = useState<MergeState | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [animation, setAnimation] = useState<TileMovement[] | null>(null);
  const [tileEffects, setTileEffects] = useState<TileEffects>({
    newIndex: null,
    mergedTargets: [],
  });
  const touchStart = useRef<[number, number] | null>(null);
  const animationTimer = useRef<number | null>(null);
  const scoreRecorded = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const restoredGame = JSON.parse(saved) as MergeState;
          setGame(restoredGame);
          if (
            !hasMoves(restoredGame.board) &&
            !restoredGame.board.includes(1024)
          ) {
            setShowGameOver(true);
          }
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

  useEffect(
    () => () => {
      if (animationTimer.current) window.clearTimeout(animationTimer.current);
    },
    [],
  );

  const move = useCallback(
    (direction: Direction) => {
      if (!game || animation || animationTimer.current) return;
      const result = moveBoard(game.board, direction);
      if (!result.moved) {
        if (!hasMoves(game.board)) {
          setShowGameOver(true);
          if (!scoreRecorded.current) {
            scoreRecorded.current = true;
            recordScore({
              gameId: "merge-1024",
              gameName: "合成 1024",
              score: game.score,
              detail: "棋盘已满",
              completed: false,
            });
          }
        }
        return;
      }

      setAnimation(result.movements);
      animationTimer.current = window.setTimeout(() => {
        const spawnedTile = addTileWithIndex(result.board);
        const board = spawnedTile.board;
        const score = game.score + result.gained;
        const best = Math.max(game.best, score);

        const reachedGoal = !game.keepPlaying && board.includes(1024);
        const gameOver = !hasMoves(board);
        if (reachedGoal) setShowWin(true);
        if (gameOver) setShowGameOver(true);
        if ((reachedGoal || gameOver) && !scoreRecorded.current) {
          scoreRecorded.current = true;
          recordScore({
            gameId: "merge-1024",
            gameName: "合成 1024",
            score,
            detail: reachedGoal ? "成功合成 1024" : "棋盘已满",
            completed: reachedGoal,
          });
        }

        setGame({ ...game, board, score, best });
        setTileEffects({
          newIndex: spawnedTile.index,
          mergedTargets: result.mergedTargets,
        });
        setAnimation(null);
        animationTimer.current = null;
      }, 210);
    },
    [animation, game],
  );

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
    if (animationTimer.current) window.clearTimeout(animationTimer.current);
    animationTimer.current = null;
    setAnimation(null);
    setTileEffects({ newIndex: null, mergedTargets: [] });
    scoreRecorded.current = false;
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

  const dismissResult = () => {
    if (showWin && game) {
      const continuedGame = { ...game, keepPlaying: true };
      setGame(continuedGame);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(continuedGame));
    }
    setShowWin(false);
    setShowGameOver(false);
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
        <div className="nav-actions">
          <span>合成 · 观察 · 再合成</span>
          <PwaMenuActions />
        </div>
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
            重新开始
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
              <div className="merge-slot" key={index}>
                {!animation && value !== 0 && (
                  <div
                    className={[
                      "merge-tile has-value",
                      tileEffects.newIndex === index ? "new-tile" : "",
                      tileEffects.mergedTargets.includes(index)
                        ? "merged-tile"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={tileStyle(value)}
                  >
                    {value}
                  </div>
                )}
              </div>
            ))}
            {animation && (
              <div className="merge-animation-layer" aria-hidden="true">
                {animation.map((tile, index) => {
                  const fromRow = Math.floor(tile.from / SIZE);
                  const fromColumn = tile.from % SIZE;
                  const toRow = Math.floor(tile.to / SIZE);
                  const toColumn = tile.to % SIZE;
                  const style = {
                    ...tileStyle(tile.value),
                    "--from-x": cellOffset(fromColumn),
                    "--from-y": cellOffset(fromRow),
                    "--move-x": movementDistance(toColumn - fromColumn),
                    "--move-y": movementDistance(toRow - fromRow),
                  } as CSSProperties;

                  return (
                    <div
                      className="merge-tile has-value moving-tile"
                      key={`${tile.from}-${tile.to}-${index}`}
                      style={style}
                    >
                      {tile.value}
                    </div>
                  );
                })}
              </div>
            )}
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
            <button
              className="modal-close"
              aria-label="关闭本局结果"
              onClick={dismissResult}
            >
              ×
            </button>
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
              重新开始
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

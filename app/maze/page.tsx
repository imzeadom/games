"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { formatDuration, recordScore } from "../lib/score-history";
import { findMazeRoute, mazeStars, placeMazeYarn } from "../lib/maze-rewards";
import { PwaMenuActions } from "../pwa-register";

type Difficulty = "easy" | "medium" | "hard";
type Direction = "up" | "right" | "down" | "left";
type MazeState = {
  size: number;
  cells: number[];
  shortestPath: number;
  branchDepth: number;
};
const PRINT_COUNTS = [1, 5, 10, 20] as const;

const DIFFICULTIES: Record<
  Difficulty,
  { label: "简单" | "中等" | "困难"; size: number; description: string }
> = {
  easy: { label: "简单", size: 9, description: "9 × 9 · 轻松认路" },
  medium: { label: "中等", size: 15, description: "15 × 15 · 转角更多" },
  hard: { label: "困难", size: 21, description: "21 × 21 · 耐心挑战" },
};
const DIRECTIONS: {
  name: Direction;
  row: number;
  column: number;
  wall: number;
  opposite: number;
}[] = [
  { name: "up", row: -1, column: 0, wall: 1, opposite: 4 },
  { name: "right", row: 0, column: 1, wall: 2, opposite: 8 },
  { name: "down", row: 1, column: 0, wall: 4, opposite: 1 },
  { name: "left", row: 0, column: -1, wall: 8, opposite: 2 },
];

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function analyzeMaze(cells: number[], size: number) {
  const distances = Array(cells.length).fill(-1) as number[];
  const parents = Array(cells.length).fill(-1) as number[];
  const queue = [0];
  distances[0] = 0;

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const cell = queue[cursor];
    const row = Math.floor(cell / size);
    const column = cell % size;
    DIRECTIONS.forEach((direction) => {
      if (cells[cell] & direction.wall) return;
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= size ||
        nextColumn >= size
      ) {
        return;
      }
      const next = nextRow * size + nextColumn;
      if (distances[next] !== -1) return;
      distances[next] = distances[cell] + 1;
      parents[next] = cell;
      queue.push(next);
    });
  }

  const path: number[] = [];
  let cursor = cells.length - 1;
  while (cursor >= 0) {
    path.push(cursor);
    cursor = parents[cursor];
  }
  path.reverse();

  const pathSet = new Set(path);
  const branchDistances = Array(cells.length).fill(-1) as number[];
  const branchQueue = [...path];
  path.forEach((cell) => {
    branchDistances[cell] = 0;
  });
  for (let queueIndex = 0; queueIndex < branchQueue.length; queueIndex += 1) {
    const cell = branchQueue[queueIndex];
    const row = Math.floor(cell / size);
    const column = cell % size;
    DIRECTIONS.forEach((direction) => {
      if (cells[cell] & direction.wall) return;
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= size ||
        nextColumn >= size
      ) {
        return;
      }
      const next = nextRow * size + nextColumn;
      if (branchDistances[next] !== -1) return;
      branchDistances[next] = branchDistances[cell] + 1;
      branchQueue.push(next);
    });
  }

  const openSideCounts = cells.map((walls) =>
    DIRECTIONS.filter(
      (direction) => !(walls & direction.wall),
    ).length,
  );
  const junctions = openSideCounts.filter((count) => count >= 3).length;
  const pathBranches = path.filter(
    (cell) => openSideCounts[cell] >= 3,
  ).length;

  return {
    distance: distances[cells.length - 1],
    reachable: distances.filter((distance) => distance >= 0).length,
    path,
    branchDepth: Math.max(
      0,
      ...branchDistances.filter(
        (distance, cell) => distance >= 0 && !pathSet.has(cell),
      ),
    ),
    junctions,
    pathBranches,
  };
}

function carveMaze(size: number) {
  const cells = Array(size * size).fill(15) as number[];
  const visited = new Set<number>();
  const active: number[] = [];
  const first = Math.floor(Math.random() * cells.length);
  visited.add(first);
  active.push(first);

  while (active.length) {
    const activeIndex =
      Math.random() < 0.58
        ? active.length - 1
        : Math.floor(Math.random() * active.length);
    const current = active[activeIndex];
    const row = Math.floor(current / size);
    const column = current % size;
    const available = shuffled(DIRECTIONS).filter((direction) => {
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      return (
        nextRow >= 0 &&
        nextColumn >= 0 &&
        nextRow < size &&
        nextColumn < size &&
        !visited.has(nextRow * size + nextColumn)
      );
    });

    if (!available.length) {
      active.splice(activeIndex, 1);
      continue;
    }

    const direction =
      available[Math.floor(Math.random() * available.length)];
    const next =
      (row + direction.row) * size + column + direction.column;
    cells[current] &= ~direction.wall;
    cells[next] &= ~direction.opposite;
    visited.add(next);
    active.push(next);
  }

  return cells;
}

function generateMaze(size: number): MazeState {
  const minimumPath = 2 * (size - 1) + Math.floor(size * 0.25);
  const maximumPath = Math.floor(size * 4.2);
  const targetPath = Math.floor(size * 2.85);
  const targetBranchDepth = Math.max(4, Math.floor(size * 0.42));
  const targetJunctions = Math.max(3, Math.floor(size * 0.55));
  const targetPathBranches = Math.max(3, Math.floor(size * 0.4));
  let best:
    | {
        cells: number[];
        distance: number;
        branchDepth: number;
        score: number;
      }
    | undefined;

  for (let attempt = 0; attempt < 140; attempt += 1) {
    const cells = carveMaze(size);
    const analysis = analyzeMaze(cells, size);
    if (analysis.reachable !== cells.length || analysis.distance < 0) continue;

    const rangePenalty =
      Math.max(0, minimumPath - analysis.distance) * 12 +
      Math.max(0, analysis.distance - maximumPath) * 12;
    const branchPenalty =
      Math.max(0, targetBranchDepth - analysis.branchDepth) * 8;
    const junctionPenalty =
      Math.max(0, targetJunctions - analysis.junctions) * 4;
    const pathBranchPenalty =
      Math.max(0, targetPathBranches - analysis.pathBranches) * 7;
    const score =
      Math.abs(analysis.distance - targetPath) +
      rangePenalty +
      branchPenalty +
      junctionPenalty +
      pathBranchPenalty;

    if (!best || score < best.score) {
      best = {
        cells,
        distance: analysis.distance,
        branchDepth: analysis.branchDepth,
        score,
      };
    }
    if (
      analysis.distance >= minimumPath &&
      analysis.distance <= maximumPath &&
      analysis.branchDepth >= targetBranchDepth &&
      analysis.junctions >= targetJunctions &&
      analysis.pathBranches >= targetPathBranches
    ) {
      break;
    }
  }

  const fallbackCells = best?.cells ?? carveMaze(size);
  const fallbackAnalysis = analyzeMaze(fallbackCells, size);
  return {
    size,
    cells: fallbackCells,
    shortestPath: best?.distance ?? fallbackAnalysis.distance,
    branchDepth: best?.branchDepth ?? fallbackAnalysis.branchDepth,
  };
}

function cellStyle(walls: number): CSSProperties {
  return {
    borderTopColor: walls & 1 ? "var(--maze-wall)" : "transparent",
    borderRightColor: walls & 2 ? "var(--maze-wall)" : "transparent",
    borderBottomColor: walls & 4 ? "var(--maze-wall)" : "transparent",
    borderLeftColor: walls & 8 ? "var(--maze-wall)" : "transparent",
  };
}

function CatHead() {
  return (
    <svg viewBox="0 0 48 42" className="cat-head" aria-hidden="true">
      <path
        d="M7 17 5 3l13 8q6-2 12 0L43 3l-2 15q3 5 2 11-3 11-19 11T5 29q-1-7 2-12Z"
        fill="#f7ead8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <path d="m10 9 7 5m21-5-7 5" stroke="#bc8065" strokeWidth="2" />
      <circle cx="17" cy="23" r="2" />
      <circle cx="31" cy="23" r="2" />
      <path
        d="m22 28 2 2 2-2m-2 2q-2 4-5 1m5-1q2 4 5 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CatMascot() {
  return (
    <div className="cat-mascot" aria-hidden="true">
      <svg viewBox="0 0 180 145">
        <path
          d="M17 133q22-12 47-5l-3-23q-18-9-18-31L35 28q-1-11 9-5l27 22q18-9 39 0l28-22q10-6 9 5l-9 46q0 23-19 32l-2 23q23-8 44 4"
          fill="#f6ead9"
          stroke="#4d4238"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="m49 37 18 15m65-15-18 15" stroke="#c98268" strokeWidth="5" />
        <ellipse cx="71" cy="73" rx="4" ry="6" />
        <ellipse cx="111" cy="73" rx="4" ry="6" />
        <path
          d="m87 84 4 4 4-4m-4 4q-7 10-14 2m14-2q7 10 14 2M39 78 14 72m25 14-26 3m128-11 25-6m-24 14 25 4"
          fill="none"
          stroke="#4d4238"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M125 108q36-13 27 8"
          fill="none"
          stroke="#4d4238"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      <span>喵，帮我找小鱼！</span>
    </div>
  );
}

function FishIcon() {
  return (
    <svg viewBox="0 0 48 32" className="fish-icon" role="img" aria-label="鱼骨终点">
      <circle cx="8" cy="16" r="5" fill="#f1dfbd" stroke="currentColor" strokeWidth="2" />
      <circle cx="7" cy="14" r="0.8" fill="currentColor" />
      <path d="M12 16h27m-4 0 8-9v18l-8-9M18 16l-3-7m9 7-2-8m9 8 1-7m-17 7-3 7m9-7-2 8m9-8 1 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function YarnIcon() {
  return (
    <svg className="yarn-mark" viewBox="0 0 24 24" aria-label="毛线" role="img">
      <circle cx="12" cy="12" r="8" fill="#e6b58e" stroke="#9c634c" strokeWidth="1.5" />
      <path d="M6 9q7 2 12-1M5 13q8 3 14-1M8 18q4-4 9-6M11 4q3 5 1 16" fill="none" stroke="#9c634c" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function MazeGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [maze, setMaze] = useState<MazeState | null>(null);
  const [player, setPlayer] = useState(0);
  const [trail, setTrail] = useState<number[]>([0]);
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [yarnCells, setYarnCells] = useState<number[]>([]);
  const [collected, setCollected] = useState<number[]>([]);
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);
  const printingRef = useRef(false);
  const [printCount, setPrintCount] = useState(10);
  const [printMazes, setPrintMazes] = useState<MazeState[] | null>(null);
  const [printYarns, setPrintYarns] = useState<number[][]>([]);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const pointerStart = useRef<[number, number] | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
  }, []);

  const startGame = useCallback((nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    const nextMaze = generateMaze(DIFFICULTIES[nextDifficulty].size);
    setMaze(nextMaze);
    setYarnCells(placeMazeYarn(nextMaze.cells, nextMaze.size));
    setCollected([]);
    setHintCells([]);
    setHintsLeft(3);
    setNotice("");
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setPlayer(0);
    setTrail([0]);
    setSteps(0);
    setElapsed(0);
    setWon(false);
    setShowWinModal(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => startGame("easy"), 0);
    return () => window.clearTimeout(timer);
  }, [startGame]);

  useEffect(() => {
    if (!maze || won) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !printingRef.current) setElapsed((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [maze, won]);

  useEffect(() => {
    if (!printMazes) return;
    const frame = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(frame);
  }, [printMazes]);

  useEffect(() => {
    const finishPrinting = () => setPrintMazes(null);
    const beforePrint = () => { printingRef.current = true; };
    const afterPrint = () => { printingRef.current = false; finishPrinting(); };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);

  const move = useCallback(
    (directionName: Direction) => {
      if (!maze || won) return;
      const direction = DIRECTIONS.find(
        (candidate) => candidate.name === directionName,
      );
      if (!direction) return;
      const row = Math.floor(player / maze.size);
      const column = player % maze.size;
      const nextRow = row + direction.row;
      const nextColumn = column + direction.column;
      if (
        nextRow < 0 || nextColumn < 0 || nextRow >= maze.size ||
        nextColumn >= maze.size || maze.cells[player] & direction.wall
      ) return;
      const next =
        player + direction.row * maze.size + direction.column;
      const nextSteps = steps + 1;
      setPlayer(next);
      setTrail((current) =>
        current.includes(next) ? current : [...current, next],
      );
      setSteps(nextSteps);

      if (yarnCells.includes(next) && !collected.includes(next)) {
        const nextCollected = [...collected, next];
        setCollected(nextCollected);
        setNotice(`找到一团毛线！已收集 ${nextCollected.length}/3 团`);
        if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
      }

      if (next === maze.cells.length - 1) {
        const yarnCount = collected.length + (yarnCells.includes(next) && !collected.includes(next) ? 1 : 0);
        setWon(true);
        setShowWinModal(true);
        recordScore({
          gameId: "maze",
          gameName: "纸上迷宫",
          difficulty: DIFFICULTIES[difficulty].label,
          elapsed,
          moves: nextSteps,
          detail: `${nextSteps} 步 · ${formatDuration(elapsed)} · 毛线 ${yarnCount}/3 · ${mazeStars(yarnCount)} 星`,
          completed: true,
        });
      }
    },
    [collected, difficulty, elapsed, maze, player, steps, won, yarnCells],
  );

  useEffect(() => {
    const keyDirections: Record<string, Direction> = {
      ArrowUp: "up",
      KeyW: "up",
      ArrowRight: "right",
      KeyD: "right",
      ArrowDown: "down",
      KeyS: "down",
      ArrowLeft: "left",
      KeyA: "left",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyDirections[event.code];
      if (!direction) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [role='dialog'], [role='menu'], [aria-haspopup='menu'], .nav-actions, [contenteditable='true']")) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const useHint = () => {
    if (!maze || won || hintCells.length || !hintsLeft) return;
    const remaining = yarnCells.filter((cell) => !collected.includes(cell));
    const target =
      remaining.sort(
        (first, second) =>
          findMazeRoute(maze.cells, maze.size, player, first).length -
          findMazeRoute(maze.cells, maze.size, player, second).length,
      )[0] ?? maze.cells.length - 1;
    setHintCells(
      findMazeRoute(maze.cells, maze.size, player, target).slice(1, 5),
    );
    setHintsLeft((count) => count - 1);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(remaining.length ? "沿着亮起的格子，去找毛线吧！" : "沿着亮起的格子，去找小鱼吧！");
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      setHintCells([]);
      setNotice("");
    }, 3000);
  };

  const completeSwipe = (x: number, y: number) => {
    if (!pointerStart.current) return;
    const [startX, startY] = pointerStart.current;
    pointerStart.current = null;
    const deltaX = x - startX;
    const deltaY = y - startY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX > 0 ? "right" : "left");
    } else {
      move(deltaY > 0 ? "down" : "up");
    }
  };

  const printBatch = () => {
    setPreparingPrint(true);
    window.setTimeout(() => {
      const generated = Array.from({ length: printCount }, () =>
        generateMaze(DIFFICULTIES[difficulty].size),
      );
      setPrintMazes(generated);
      setPrintYarns(generated.map((item) => placeMazeYarn(item.cells, item.size)));
      setPreparingPrint(false);
    }, 0);
  };

  if (!maze) {
    return <main className="loading-screen">正在折出一座新迷宫…</main>;
  }

  const playerRow = Math.floor(player / maze.size);
  const playerColumn = player % maze.size;
  const playerStyle: CSSProperties = {
    top: `${((playerRow + 0.5) / maze.size) * 100}%`,
    left: `${((playerColumn + 0.5) / maze.size) * 100}%`,
    width: `${(58 / maze.size)}%`,
  };

  return (
    <main className="maze-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <Link href="/history" className="back-link">
            历史成绩
          </Link>
          <PwaMenuActions />
        </div>
      </header>

      <section className="maze-layout">
        <div className="maze-copy">
          <p className="eyebrow">MAZE GAME · 小猫的纸上冒险</p>
          <h1>小猫寻鱼记</h1>
          <p className="intro">
            帮小猫从左边出发，找到右下角的小鱼！路上的 3 团毛线是额外挑战，不收集也能通关。
          </p>
          <CatMascot />
          <p className="maze-star-rule">到达小鱼得 1 星 · 收集 2 团毛线得 2 星 · 集齐 3 团得 3 星</p>
          <div className="maze-levels" aria-label="选择难度">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
              <button
                key={level}
                className={difficulty === level ? "is-active" : ""}
                onClick={() => startGame(level)}
              >
                <strong>{DIFFICULTIES[level].label}</strong>
                <small>{DIFFICULTIES[level].description}</small>
              </button>
            ))}
          </div>
          <section className="batch-print-bar is-compact" aria-label="批量打印迷宫">
            <div>
              <strong>批量练习</strong>
              <span>每页 1 座，使用当前难度</span>
            </div>
            <label>
              页数
              <select
                value={printCount}
                onChange={(event) => setPrintCount(Number(event.target.value))}
              >
                {PRINT_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count} 页 / {count} 座
                  </option>
                ))}
              </select>
            </label>
            <button onClick={printBatch} disabled={preparingPrint}>
              {preparingPrint ? "正在生成…" : `生成并打印 ${printCount} 页`}
            </button>
          </section>
          <p className="desktop-tip">
            <span aria-hidden="true">↑</span>
            方向键 / WASD / 滑动均可移动
          </p>
        </div>

        <div className="maze-game">
          <div className="maze-mobile-title">
            <strong>小猫寻鱼记</strong>
            <span>从左边出发，找到右下角的小鱼</span>
          </div>
          <div className="maze-status" aria-label="本局状态">
            <div>
              <span>用时</span>
              <strong>{formatDuration(elapsed)}</strong>
            </div>
            <div>
              <span>步数</span>
              <strong>{steps}</strong>
            </div>
            <div>
              <span>毛线</span>
              <strong>{collected.length}/3</strong>
            </div>
            <button
              onClick={useHint}
              disabled={won || !hintsLeft || !!hintCells.length}
              aria-label={`使用提示，还剩 ${hintsLeft} 次`}
            >
              提示 {hintsLeft}
            </button>
            <button onClick={() => startGame(difficulty)}>↻ 换一座</button>
          </div>
          <p className="maze-live" aria-live="polite">
            {notice || "用方向键、WASD、滑动或下方按钮移动小猫。"}
          </p>
          <div className="maze-paper-frame">
            <div className="maze-paper-title">MAZE GAME</div>
            <div
            className="maze-board"
            role="application"
            aria-label={`${DIFFICULTIES[difficulty].label}迷宫，玩家在第 ${
              Math.floor(player / maze.size) + 1
            } 行第 ${(player % maze.size) + 1} 列`}
            tabIndex={0}
            style={{ "--maze-size": maze.size } as CSSProperties}
            onPointerDown={(event) => {
              pointerStart.current = [event.clientX, event.clientY];
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => completeSwipe(event.clientX, event.clientY)}
              onPointerCancel={() => {
                pointerStart.current = null;
              }}
            >
            {maze.cells.map((walls, index) => (
              <div
                key={index}
                className={[
                  "maze-cell",
                  index === 0 ? "maze-start" : "",
                  index === maze.cells.length - 1 ? "maze-exit" : "",
                  trail.includes(index) ? "is-trail" : "",
                  hintCells.includes(index) ? "is-hinted" : "",
                  yarnCells.includes(index) && !collected.includes(index)
                    ? "has-yarn"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={cellStyle(
                  index === 0
                    ? walls & ~8
                    : index === maze.cells.length - 1
                      ? walls & ~2
                      : walls,
                )}
                data-cell-index={index}
                data-walls={walls}
                data-player={player === index || undefined}
                data-pickup={
                  yarnCells.includes(index) && !collected.includes(index)
                    ? "yarn"
                    : undefined
                }
              >
                {yarnCells.includes(index) && !collected.includes(index) && (
                  <YarnIcon />
                )}
                {index === maze.cells.length - 1 && <FishIcon />}
                {trail.includes(index) && (
                  <i className="maze-trail-mark" aria-hidden="true" />
                )}
              </div>
            ))}
              <i className="maze-token" style={playerStyle} aria-hidden="true">
                <CatHead />
              </i>
            </div>
            <div className="maze-entry-caption">
              <span>← 小猫出发</span>
              <span>鱼骨终点 →</span>
            </div>
          </div>
          <div className="maze-pad" aria-label="移动方向">
            <button aria-label="向上" onClick={() => move("up")}>
              ↑
            </button>
            <button aria-label="向左" onClick={() => move("left")}>
              ←
            </button>
            <button aria-label="向下" onClick={() => move("down")}>
              ↓
            </button>
            <button aria-label="向右" onClick={() => move("right")}>
              →
            </button>
          </div>
        </div>
      </section>

      {won && showWinModal && (
        <div className="modal-backdrop">
          <section className="win-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="关闭胜利提示"
              onClick={() => setShowWinModal(false)}
            >
              ×
            </button>
            <p className="eyebrow">找到出口</p>
            <h2>小猫找到小鱼啦！</h2>
            <p className="earned-stars" aria-label={`获得${mazeStars(collected.length)}颗星`}>
              <span aria-hidden="true">{"★".repeat(mazeStars(collected.length))}{"☆".repeat(3 - mazeStars(collected.length))}</span>
            </p>
            <p>收集毛线 {collected.length}/3 团 · 走了 {steps} 步 · 用时 {formatDuration(elapsed)}</p>
            <button
              className="primary-button"
              onClick={() => startGame(difficulty)}
            >
              再走一座
            </button>
            <Link className="secondary-link" href="/history">
              查看历史成绩
            </Link>
          </section>
        </div>
      )}

      {printMazes && (
        <section className="print-collection" aria-label="迷宫打印页">
          {printMazes.map((printMaze, mazeIndex) => (
            <article className="print-sheet" key={mazeIndex}>
              <header className="print-sheet-heading">
                <div>
                  <p>PAPER MAZE</p>
                  <h1>小猫寻鱼记</h1>
                </div>
                <span>
                  {DIFFICULTIES[difficulty].label} · {mazeIndex + 1}/
                  {printMazes.length}
                </span>
              </header>
              <p className="print-instructions">
                帮小猫从左边出发找到小鱼！到达得1星，收集2团毛线得2星，集齐3团得3星。
              </p>
              <div className="print-wayfinding">
                <CatMascot />
                <span aria-hidden="true">→</span>
                <FishIcon />
              </div>
              <div
                className="print-maze-board"
                style={{ "--maze-size": printMaze.size } as CSSProperties}
              >
                {printMaze.cells.map((walls, cellIndex) => (
                  <span
                    className={[
                      "print-maze-cell",
                      cellIndex === 0 ? "is-start" : "",
                      cellIndex === printMaze.cells.length - 1
                        ? "is-exit"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={cellIndex}
                    style={cellStyle(cellIndex === 0 ? walls & ~8 : cellIndex === printMaze.cells.length - 1 ? walls & ~2 : walls)}
                  >
                    {cellIndex === 0 ? (
                      <CatHead />
                    ) : cellIndex === printMaze.cells.length - 1 ? (
                      <FishIcon />
                    ) : printYarns[mazeIndex]?.includes(cellIndex) ? (
                      <YarnIcon />
                    ) : (
                      ""
                    )}
                  </span>
                ))}
              </div>
              <footer className="print-maze-footer">
                <span>姓名：________________</span>
                <span>用时：________________</span>
              </footer>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

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

type Difficulty = "easy" | "medium" | "hard";
type Direction = "up" | "right" | "down" | "left";
type MazeState = {
  size: number;
  cells: number[];
  shortestPath: number;
  branchDepth: number;
};

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

export default function MazeGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [maze, setMaze] = useState<MazeState | null>(null);
  const [player, setPlayer] = useState(0);
  const [trail, setTrail] = useState<number[]>([0]);
  const [steps, setSteps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const pointerStart = useRef<[number, number] | null>(null);

  const startGame = useCallback((nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setMaze(generateMaze(DIFFICULTIES[nextDifficulty].size));
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
    const timer = window.setInterval(
      () => setElapsed((current) => current + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [maze, won]);

  const move = useCallback(
    (directionName: Direction) => {
      if (!maze || won) return;
      const direction = DIRECTIONS.find(
        (candidate) => candidate.name === directionName,
      );
      if (!direction || maze.cells[player] & direction.wall) return;
      const next =
        player + direction.row * maze.size + direction.column;
      const nextSteps = steps + 1;
      setPlayer(next);
      setTrail((current) =>
        current.includes(next) ? current : [...current, next],
      );
      setSteps(nextSteps);

      if (next === maze.cells.length - 1) {
        setWon(true);
        setShowWinModal(true);
        recordScore({
          gameId: "maze",
          gameName: "纸上迷宫",
          difficulty: DIFFICULTIES[difficulty].label,
          elapsed,
          moves: nextSteps,
          detail: `${nextSteps} 步走出迷宫 · 最短 ${maze.shortestPath} 步`,
          completed: true,
        });
      }
    },
    [difficulty, elapsed, maze, player, steps, won],
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
      event.preventDefault();
      move(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

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
        <Link href="/history" className="back-link">
          历史成绩
        </Link>
      </header>

      <section className="maze-layout">
        <div className="maze-copy">
          <p className="eyebrow">PAPER MAZE</p>
          <h1>
            绕一点远路，
            <br />
            也会抵达出口。
          </h1>
          <p className="intro">
            从左上角走到右下角。每一座迷宫都随机生成，并保证能够抵达出口。
          </p>
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
          <p className="desktop-tip">
            <span aria-hidden="true">↑</span>
            方向键 / WASD / 滑动均可移动
          </p>
        </div>

        <div className="maze-game">
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
              <span>最短</span>
              <strong>{maze.shortestPath}</strong>
            </div>
            <div>
              <span>支路深度</span>
              <strong>{maze.branchDepth}</strong>
            </div>
            <button onClick={() => startGame(difficulty)}>↻ 换一座</button>
          </div>
          <div
            className="maze-board"
            role="application"
            aria-label={`${DIFFICULTIES[difficulty].label}迷宫，玩家在第 ${
              Math.floor(player / maze.size) + 1
            } 行第 ${(player % maze.size) + 1} 列`}
            style={{ "--maze-size": maze.size } as CSSProperties}
            onPointerDown={(event) => {
              pointerStart.current = [event.clientX, event.clientY];
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => completeSwipe(event.clientX, event.clientY)}
          >
            {maze.cells.map((walls, index) => (
              <div
                key={index}
                className={[
                  "maze-cell",
                  index === 0 ? "maze-start" : "",
                  index === maze.cells.length - 1 ? "maze-exit" : "",
                  trail.includes(index) ? "is-trail" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={cellStyle(walls)}
              >
                {index === maze.cells.length - 1 && (
                  <span aria-hidden="true">◎</span>
                )}
                {trail.includes(index) && (
                  <i className="maze-trail-mark" aria-hidden="true" />
                )}
              </div>
            ))}
            <i
              className="maze-token"
              style={playerStyle}
              aria-hidden="true"
            />
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
            <h2>走出来了！</h2>
            <p>
              用时 {formatDuration(elapsed)}，走了 {steps} 步。最佳路线是{" "}
              {maze.shortestPath} 步。
            </p>
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
    </main>
  );
}

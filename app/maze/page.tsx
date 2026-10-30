"use client";

import Link from "next/link";
import Image from "next/image";
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
import { moveMazePlayer } from "../lib/maze-movement";

type Difficulty = "easy" | "medium" | "hard";
type Direction = "up" | "right" | "down" | "left";
type Story = "cat" | "rabbit";
type MazeState = {
  size: number;
  cells: number[];
  shortestPath: number;
  branchDepth: number;
};
const PRINT_COUNTS = [1, 5, 10, 20] as const;
const STORIES: Record<Story, { title: string; goal: string; pickup: string; buddy: string; action: string; callout: string; accent: string; description: string }> = {
  cat: { title: "小猫寻鱼记", goal: "小鱼", pickup: "毛线", buddy: "小猫", action: "找到小鱼", callout: "喵，帮我找小鱼！", accent: "cat", description: "帮小猫从左边出发，找到右下角的小鱼！路上的 3 团毛线是额外挑战，不收集也能通关。" },
  rabbit: { title: "小兔找胡萝卜", goal: "胡萝卜", pickup: "水滴", buddy: "小兔", action: "找到胡萝卜", callout: "带上水壶，去找胡萝卜！", accent: "rabbit", description: "小兔带着水壶出发啦！找到右下角的胡萝卜，沿路收集 3 滴水，为小菜园浇水。" },
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

function RabbitHead() {
  return <svg viewBox="0 0 48 42" className="rabbit-head" aria-hidden="true"><path d="M12 17 8 2q-1-4 4-2l9 15q3-1 6 0l9-15q5-2 4 2l-4 16q4 5 3 12-3 10-16 10T7 29q-1-7 5-12Z" fill="#fffaf0" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/><path d="m12 7 7 11m17-11-7 11" stroke="#d99180" strokeWidth="2"/><circle cx="17" cy="24" r="2"/><circle cx="31" cy="24" r="2"/><path d="m22 29 2 2 2-2m-2 2q-2 3-5 1m5-1q2 3 5 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
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

function DewIcon() {
  return <svg className="dew-mark" viewBox="0 0 24 24" role="img" aria-label="水滴"><path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z" fill="#9fc8ba" stroke="#55796b" strokeWidth="1.5"/><path d="M9 16q1 3 4 3" fill="none" stroke="#fffdf7" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}

function GoalIcon({ story, small = false }: { story: Story; small?: boolean }) {
  if (story === "rabbit") return <Image className={small ? "carrot-icon is-small" : "carrot-icon"} src="/maze/carrot.webp" alt="胡萝卜" width={small ? 32 : 64} height={small ? 32 : 64} unoptimized />;
  return <FishIcon />;
}

function StoryPicker({ story, onSelect, variant = "desktop" }: { story: Story; onSelect: (story: Story) => void; variant?: "desktop" | "mobile" }) {
  return (
    <div className={`maze-story-picker ${variant === "mobile" ? "maze-story-picker--mobile" : "maze-story-picker--desktop"}`} role="group" aria-label="选择迷宫故事">
      <button type="button" className={story === "cat" ? "is-active" : ""} aria-pressed={story === "cat"} onClick={() => onSelect("cat")}><span aria-hidden="true">🐈</span><strong>小猫找小鱼</strong><small>毛线收集挑战</small></button>
      <button type="button" className={story === "rabbit" ? "is-active" : ""} aria-pressed={story === "rabbit"} onClick={() => onSelect("rabbit")}><Image src="/maze/rabbit.webp" alt="" width={36} height={48} unoptimized /><strong>小兔找胡萝卜</strong><small>浇水长菜园 · 蹦跳技能</small></button>
    </div>
  );
}

export default function MazeGame() {
  const [story, setStory] = useState<Story>("cat");
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
  const [hopsLeft, setHopsLeft] = useState(3);
  const [hopArmed, setHopArmed] = useState(false);
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

  const startGame = useCallback((nextDifficulty: Difficulty, nextStory: Story) => {
    setStory(nextStory);
    setDifficulty(nextDifficulty);
    const nextMaze = generateMaze(DIFFICULTIES[nextDifficulty].size);
    setMaze(nextMaze);
    setYarnCells(placeMazeYarn(nextMaze.cells, nextMaze.size));
    setCollected([]);
    setHintCells([]);
    setHintsLeft(3);
    setHopsLeft(3);
    setHopArmed(false);
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
    const timer = window.setTimeout(() => startGame("easy", "cat"), 0);
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
      const route = moveMazePlayer(maze.cells, maze.size, player, directionName, story === "rabbit" && hopArmed ? 2 : 1);
      if (!route.length) return;
      const next = route.at(-1)!;
      const nextSteps = steps + route.length;
      setPlayer(next);
      setTrail((current) => [...new Set([...current, ...route])]);
      setSteps(nextSteps);
      const found = route.filter((cell) => yarnCells.includes(cell) && !collected.includes(cell));
      const nextCollected = [...collected, ...found];
      if (found.length) {
        setCollected(nextCollected);
        setNotice(story === "rabbit"
          ? `收集到${found.length > 1 ? `${found.length}滴` : "一滴"}水！菜园里已有${nextCollected.length}根胡萝卜长大。`
          : `找到一团毛线！已收集 ${nextCollected.length}/3 团`);
        if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
      }
      if (story === "rabbit" && hopArmed) {
        setHopArmed(false);
        setHopsLeft((count) => Math.max(0, count - 1));
      }

      if (next === maze.cells.length - 1) {
        const pickupCount = nextCollected.length;
        setWon(true);
        setShowWinModal(true);
        setHopArmed(false);
        recordScore({
          gameId: "maze",
          gameName: "纸上迷宫",
          difficulty: DIFFICULTIES[difficulty].label,
          elapsed,
          moves: nextSteps,
          detail: `${story === "rabbit" ? "小兔找胡萝卜" : "小猫寻鱼记"} · ${nextSteps} 步 · ${formatDuration(elapsed)} · ${story === "rabbit" ? "水滴" : "毛线"} ${pickupCount}/3 · ${mazeStars(pickupCount)} 星`,
          completed: true,
        });
      }
    },
    [collected, difficulty, elapsed, hopArmed, maze, player, steps, story, won, yarnCells],
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
    setNotice(remaining.length ? `沿着亮起的格子，去找${story === "rabbit" ? "水滴" : "毛线"}吧！` : `沿着亮起的格子，去找${story === "rabbit" ? "胡萝卜" : "小鱼"}吧！`);
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
    <main className={`maze-shell maze-story-${story}`}>
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
          <p className="eyebrow">MAZE GAME · 纸上冒险</p>
          <h1>{STORIES[story].title}</h1>
          <p className="intro">{STORIES[story].description}</p>
          <div className={`maze-mascot ${story === "rabbit" ? "rabbit-mascot" : "cat-story-mascot"}`} aria-hidden="true">
            {story === "rabbit" ? <Image src="/maze/rabbit.webp" alt="" width={427} height={640} unoptimized priority /> : <CatMascot />}
            {story === "rabbit" && <span>{STORIES.rabbit.callout}</span>}
          </div>
          <p className="maze-star-rule">到达{STORIES[story].goal}得 1 星 · 收集 {story === "rabbit" ? "2 滴水" : "2 团毛线"}得 2 星 · {story === "rabbit" ? "收集 3 滴水" : "集齐 3 团毛线"}得 3 星{story === "rabbit" ? "；水滴是额外挑战，不收集也能通关，小菜园会随收集长大" : ""}</p>
          <StoryPicker story={story} onSelect={(nextStory) => startGame(difficulty, nextStory)} />
          <div className="maze-levels" aria-label="选择难度">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
              <button
                key={level}
                className={difficulty === level ? "is-active" : ""}
                onClick={() => startGame(level, story)}
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
            <strong>{STORIES[story].title}</strong>
            <span>从左边出发，{STORIES[story].action}</span>
          </div>
          <StoryPicker story={story} variant="mobile" onSelect={(nextStory) => startGame(difficulty, nextStory)} />
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
              <span>{STORIES[story].pickup}</span>
              <strong>{collected.length}/3</strong>
            </div>
            <button
              onClick={useHint}
              disabled={won || !hintsLeft || !!hintCells.length}
              aria-label={`使用提示，还剩 ${hintsLeft} 次`}
            >
              {story === "rabbit" ? "兔耳听听" : "提示"} {hintsLeft}
            </button>
            <button onClick={() => startGame(difficulty, story)}>↻ 换一座</button>
            {story === "rabbit" && <button type="button" className={`hop-control ${hopArmed ? "is-armed" : ""}`} aria-pressed={hopArmed} disabled={!hopsLeft || won} onClick={() => { setHopArmed((armed) => !armed); setNotice(hopArmed ? "收好蹦跳，慢慢走也能到！" : "蹦跳准备好：下一次方向操作最多前进两格，遇墙会停下。"); }}>蹦一蹦 {hopsLeft}</button>}
          </div>
          <p className="maze-live" aria-live="polite">
            {notice || `用方向键、WASD、滑动或下方按钮移动${STORIES[story].buddy}。`}
          </p>
          {story === "rabbit" && <div className="rabbit-garden" aria-label={`已收集${collected.length}滴水，菜园里有${collected.length}根胡萝卜长大`}><strong>小小菜园</strong><div>{[0, 1, 2].map((index) => <span key={index} className={index < collected.length ? "is-grown" : ""} aria-hidden="true">{index < collected.length ? <Image src="/maze/carrot.webp" alt="" width={28} height={28} unoptimized /> : "·"}</span>)}</div><small>{collected.length === 3 ? "萝卜丰收啦！" : `浇水进度 ${collected.length}/3`}</small></div>}
          <div className="maze-paper-frame">
            <div className="maze-paper-title">{STORIES[story].title}</div>
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
                    ? story === "rabbit" ? "dew" : "yarn"
                    : undefined
                }
              >
                {yarnCells.includes(index) && !collected.includes(index) && (
                  story === "rabbit" ? <DewIcon /> : <YarnIcon />
                )}
                {index === maze.cells.length - 1 && <GoalIcon story={story} small />}
                {trail.includes(index) && (
                  <i className="maze-trail-mark" aria-hidden="true" />
                )}
              </div>
            ))}
              <i className="maze-token" style={playerStyle} aria-hidden="true">
                {story === "rabbit" ? <RabbitHead /> : <CatHead />}
              </i>
            </div>
          <div className="maze-entry-caption">
            <span>← {STORIES[story].buddy}出发</span>
            <span>{STORIES[story].goal}终点 →</span>
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
            <h2>{story === "rabbit" ? (collected.length === 3 ? "小兔的丰收野餐！" : "小兔找到胡萝卜啦！") : "小猫找到小鱼啦！"}</h2>
            <p className="earned-stars" aria-label={`获得${mazeStars(collected.length)}颗星`}>
              <span aria-hidden="true">{"★".repeat(mazeStars(collected.length))}{"☆".repeat(3 - mazeStars(collected.length))}</span>
            </p>
            <p>收集{STORIES[story].pickup} {collected.length}/3 · 走了 {steps} 步 · 用时 {formatDuration(elapsed)}</p>
            {story === "rabbit" && <div className="win-carrot"><Image src="/maze/carrot.webp" alt="长大的胡萝卜" width={120} height={120} unoptimized /><span>{collected.length === 3 ? "带上胡萝卜，和小兔去野餐吧！" : "菜园里还有萝卜苗等着你来浇水。"}</span></div>}
            <button
              className="primary-button"
              onClick={() => startGame(difficulty, story)}
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
                  <h1>{STORIES[story].title}</h1>
                </div>
                <span>
                  {DIFFICULTIES[difficulty].label} · {mazeIndex + 1}/
                  {printMazes.length}
                </span>
              </header>
              <p className="print-instructions">
                {story === "rabbit" ? "陪小兔从左边出发找到胡萝卜！途中收集水滴浇灌小菜园；到达得1星，收集2滴得2星，集齐3滴得3星。" : "帮小猫从左边出发找到小鱼！到达得1星，收集2团毛线得2星，集齐3团得3星。"}
              </p>
              <div className="print-wayfinding">
                {story === "rabbit" ? <Image src="/maze/rabbit.webp" alt="小兔" width={140} height={210} unoptimized /> : <CatMascot />}
                <span aria-hidden="true">→</span>
                <GoalIcon story={story} />
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
                      story === "rabbit" ? <RabbitHead /> : <CatHead />
                    ) : cellIndex === printMaze.cells.length - 1 ? (
                      <GoalIcon story={story} small />
                    ) : printYarns[mazeIndex]?.includes(cellIndex) ? (
                      story === "rabbit" ? <DewIcon /> : <YarnIcon />
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

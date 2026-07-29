"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDuration, recordScore } from "../lib/score-history";
import { PwaRefreshButton } from "../pwa-register";
import { VOCABULARY, type VocabularyWord } from "./vocabulary";

type Difficulty = "easy" | "medium" | "hard";
type Word = Pick<
  VocabularyWord,
  "word" | "meaning" | "example" | "translation"
>;
type PlacedWord = Word & { positions: number[] };
type Puzzle = { size: number; letters: string[]; words: PlacedWord[] };

const LEVELS: Record<
  Difficulty,
  {
    label: "简单" | "中等" | "困难";
    description: string;
    size: number;
    count: number;
    directions: [number, number][];
  }
> = {
  easy: {
    label: "简单",
    description: "5 个生活词汇 · 横向与纵向",
    size: 9,
    count: 5,
    directions: [
      [0, 1],
      [1, 0],
    ],
  },
  medium: {
    label: "中等",
    description: "6 个常用词汇 · 加入斜线",
    size: 10,
    count: 6,
    directions: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ],
  },
  hard: {
    label: "困难",
    description: "7 个进阶词汇 · 含倒序",
    size: 12,
    count: 7,
    directions: [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, -1],
      [-1, 1],
    ],
  },
};

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function sampleVocabulary(difficulty: Difficulty, count: number): Word[] {
  const families = new Set<string>();
  const selection: Word[] = [];
  for (const item of shuffled(
    VOCABULARY.filter((candidate) => candidate.level === difficulty),
  )) {
    if (families.has(item.family)) continue;
    families.add(item.family);
    selection.push({
      word: item.word,
      meaning: item.meaning,
      example: item.example,
      translation: item.translation,
    });
    if (selection.length === count) break;
  }
  return selection;
}

function makePuzzle(difficulty: Difficulty): Puzzle {
  const level = LEVELS[difficulty];
  const selectedWords = sampleVocabulary(difficulty, level.count);

  for (let boardAttempt = 0; boardAttempt < 40; boardAttempt += 1) {
    const letters = Array(level.size * level.size).fill("") as string[];
    const placed: PlacedWord[] = [];

    for (const item of [...selectedWords].sort(
      (first, second) => second.word.length - first.word.length,
    )) {
      let positions: number[] | null = null;
      for (let attempt = 0; attempt < 240 && !positions; attempt += 1) {
        const [rowStep, columnStep] =
          level.directions[
            Math.floor(Math.random() * level.directions.length)
          ];
        const startRow = Math.floor(Math.random() * level.size);
        const startColumn = Math.floor(Math.random() * level.size);
        const endRow = startRow + rowStep * (item.word.length - 1);
        const endColumn = startColumn + columnStep * (item.word.length - 1);
        if (
          endRow < 0 ||
          endColumn < 0 ||
          endRow >= level.size ||
          endColumn >= level.size
        ) {
          continue;
        }
        const candidates = Array.from(
          { length: item.word.length },
          (_, index) =>
            (startRow + rowStep * index) * level.size +
            startColumn +
            columnStep * index,
        );
        if (
          candidates.every(
            (position, index) =>
              !letters[position] || letters[position] === item.word[index],
          )
        ) {
          positions = candidates;
        }
      }

      if (!positions) break;
      positions.forEach((position, index) => {
        letters[position] = item.word[index];
      });
      placed.push({ ...item, positions });
    }

    if (placed.length === selectedWords.length) {
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

function lineBetween(start: number, end: number, size: number) {
  const startRow = Math.floor(start / size);
  const startColumn = start % size;
  const endRow = Math.floor(end / size);
  const endColumn = end % size;
  const rowDistance = endRow - startRow;
  const columnDistance = endColumn - startColumn;
  const length = Math.max(Math.abs(rowDistance), Math.abs(columnDistance));
  if (
    length === 0 ||
    (rowDistance !== 0 &&
      columnDistance !== 0 &&
      Math.abs(rowDistance) !== Math.abs(columnDistance))
  ) {
    return [];
  }
  const rowStep = Math.sign(rowDistance);
  const columnStep = Math.sign(columnDistance);
  return Array.from(
    { length: length + 1 },
    (_, index) =>
      (startRow + rowStep * index) * size +
      startColumn +
      columnStep * index,
  );
}

export default function CrosswordGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [activeWord, setActiveWord] = useState<Word | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const pointerAnchor = useRef<number | null>(null);

  const startGame = useCallback((nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setPuzzle(makePuzzle(nextDifficulty));
    setFound([]);
    setSelection([]);
    setSelectionStart(null);
    setMistakes(0);
    setElapsed(0);
    setWon(false);
    setShowWinModal(false);
    setActiveWord(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => startGame("easy"), 0);
    return () => window.clearTimeout(timer);
  }, [startGame]);

  useEffect(() => {
    if (!puzzle || won) return;
    const timer = window.setInterval(
      () => setElapsed((current) => current + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [puzzle, won]);

  const completeSelection = useCallback(
    (positions: number[]) => {
      if (!puzzle || positions.length < 2 || won) {
        setSelection([]);
        return;
      }
      const match = puzzle.words.find(
        (item) =>
          !found.includes(item.word) &&
          (item.positions.join(",") === positions.join(",") ||
            [...item.positions].reverse().join(",") === positions.join(",")),
      );
      if (match) {
        const nextFound = [...found, match.word];
        setFound(nextFound);
        setActiveWord(match);
        if (nextFound.length === puzzle.words.length) {
          setWon(true);
          setShowWinModal(true);
          recordScore({
            gameId: "crossword",
            gameName: "单词寻踪",
            difficulty: LEVELS[difficulty].label,
            elapsed,
            mistakes,
            score: Math.max(100, 1000 - elapsed * 2 - mistakes * 40),
            detail: `找到 ${puzzle.words.length} 个单词 · ${mistakes} 次误选`,
            completed: true,
          });
        }
      } else {
        setMistakes((current) => current + 1);
      }
      setSelection([]);
      setSelectionStart(null);
    },
    [difficulty, elapsed, found, mistakes, puzzle, won],
  );

  const positionAtPointer = (clientX: number, clientY: number) => {
    if (!boardRef.current || !puzzle) return null;
    const bounds = boardRef.current.getBoundingClientRect();
    const column = Math.min(
      puzzle.size - 1,
      Math.max(0, Math.floor(((clientX - bounds.left) / bounds.width) * puzzle.size)),
    );
    const row = Math.min(
      puzzle.size - 1,
      Math.max(0, Math.floor(((clientY - bounds.top) / bounds.height) * puzzle.size)),
    );
    return row * puzzle.size + column;
  };

  const clickCell = (position: number) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (selectionStart === null) {
      setSelectionStart(position);
      setSelection([position]);
      return;
    }
    completeSelection(lineBetween(selectionStart, position, puzzle!.size));
  };

  const foundPositions = useMemo(() => {
    if (!puzzle) return new Set<number>();
    return new Set(
      puzzle.words
        .filter((item) => found.includes(item.word))
        .flatMap((item) => item.positions),
    );
  }, [found, puzzle]);

  if (!puzzle) {
    return <main className="loading-screen">正在把单词藏进字母里…</main>;
  }

  return (
    <main className="crossword-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <Link href="/history" className="back-link">
            历史成绩
          </Link>
          <PwaRefreshButton />
        </div>
      </header>

      <section className="crossword-heading">
        <div>
          <p className="eyebrow">CROSSWORD SEARCH</p>
          <h1>在交错的字母里，找到今天的新词。</h1>
        </div>
        <p>
          从 1000 词分级词库中随机出题。拖过一行字母来选词，点击词卡可查看简单英文例句。
        </p>
      </section>

      <div className="crossword-levels" aria-label="选择难度">
        {(Object.keys(LEVELS) as Difficulty[]).map((level) => (
          <button
            key={level}
            className={difficulty === level ? "is-active" : ""}
            onClick={() => startGame(level)}
          >
            <strong>{LEVELS[level].label}</strong>
            <span>{LEVELS[level].description}</span>
          </button>
        ))}
      </div>

      <section className="crossword-layout">
        <div className="crossword-game">
          <div className="crossword-status">
            <span>
              已找到 <strong>{found.length}/{puzzle.words.length}</strong>
            </span>
            <span>
              用时 <strong>{formatDuration(elapsed)}</strong>
            </span>
            <span>
              误选 <strong>{mistakes}</strong>
            </span>
            <button onClick={() => startGame(difficulty)}>↻ 换一局</button>
          </div>
          <div
            ref={boardRef}
            className="crossword-board"
            role="grid"
            aria-label={`${LEVELS[difficulty].label}单词字母网格`}
            style={{ "--crossword-size": puzzle.size } as CSSProperties}
            onPointerDown={(event) => {
              const position = positionAtPointer(event.clientX, event.clientY);
              if (position === null) return;
              dragged.current = false;
              pointerAnchor.current = position;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const anchor = pointerAnchor.current;
              if (anchor === null || !event.currentTarget.hasPointerCapture(event.pointerId)) {
                return;
              }
              const position = positionAtPointer(event.clientX, event.clientY);
              if (position === null) return;
              const next = lineBetween(anchor, position, puzzle.size);
              if (next.length > 1) dragged.current = true;
              if (next.length > 1) {
                setSelectionStart(anchor);
                setSelection(next);
              }
            }}
            onPointerUp={(event) => {
              const anchor = pointerAnchor.current;
              const position = positionAtPointer(
                event.clientX,
                event.clientY,
              );
              if (dragged.current && anchor !== null && position !== null) {
                completeSelection(lineBetween(anchor, position, puzzle.size));
              }
              pointerAnchor.current = null;
            }}
          >
            {puzzle.letters.map((letter, position) => (
              <button
                key={position}
                role="gridcell"
                className={[
                  "crossword-cell",
                  foundPositions.has(position) ? "is-found" : "",
                  selection.includes(position) ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`字母 ${letter}`}
                onClick={() => clickCell(position)}
              >
                {letter}
              </button>
            ))}
          </div>
          <p className="crossword-hint">
            <span aria-hidden="true">↗</span>
            词可能横向、纵向或斜向出现；困难级别还可能倒序。
          </p>
        </div>

        <aside className="word-list" aria-labelledby="word-list-title">
          <div className="word-list-heading">
            <div>
              <span>待寻找</span>
              <strong id="word-list-title">{puzzle.words.length} WORDS</strong>
            </div>
            <small>点击查看例句</small>
          </div>
          <ul>
            {puzzle.words.map((item, index) => {
              const isFound = found.includes(item.word);
              return (
                <li key={item.word}>
                  <button
                    className={isFound ? "is-found" : ""}
                    onClick={() => setActiveWord(item)}
                  >
                    <span>{(index + 1).toString().padStart(2, "0")}</span>
                    <div>
                      <strong>{item.word}</strong>
                      <small>{item.meaning}</small>
                    </div>
                    <b aria-hidden="true">{isFound ? "✓" : "→"}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </section>

      {activeWord && (
        <div
          className="word-example-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setActiveWord(null);
          }}
        >
          <section className="word-example" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="关闭例句"
              onClick={() => setActiveWord(null)}
            >
              ×
            </button>
            <span>{activeWord.meaning}</span>
            <h2>{activeWord.word}</h2>
            <p>“{activeWord.example}”</p>
            <small>{activeWord.translation}</small>
            <button
              className="primary-button"
              onClick={() => setActiveWord(null)}
            >
              {won ? "查看完成结果" : "记住了，继续找"}
            </button>
          </section>
        </div>
      )}

      {won && showWinModal && !activeWord && (
        <div className="modal-backdrop">
          <section className="win-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              aria-label="关闭完成提示"
              onClick={() => setShowWinModal(false)}
            >
              ×
            </button>
            <p className="eyebrow">全部找到</p>
            <h2>今天的词都收下了！</h2>
            <p>
              用时 {formatDuration(elapsed)}，共误选 {mistakes} 次。点击词卡仍可复习例句。
            </p>
            <button
              className="primary-button"
              onClick={() => startGame(difficulty)}
            >
              换一组词
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

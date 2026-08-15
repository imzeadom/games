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
import { PwaMenuActions } from "../pwa-register";
import {
  type Difficulty,
  LEVELS,
  makePuzzle,
  type Puzzle,
} from "./generator";

const PRINT_COUNTS = [1, 5, 10, 20] as const;

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
  const [printCount, setPrintCount] = useState(10);
  const [printPuzzles, setPrintPuzzles] = useState<Puzzle[] | null>(null);
  const [preparingPrint, setPreparingPrint] = useState(false);
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

  useEffect(() => {
    if (!printPuzzles) return;
    const frame = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(frame);
  }, [printPuzzles]);

  useEffect(() => {
    const finishPrinting = () => setPrintPuzzles(null);
    window.addEventListener("afterprint", finishPrinting);
    return () => window.removeEventListener("afterprint", finishPrinting);
  }, []);

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

  const printBatch = () => {
    setPreparingPrint(true);
    window.setTimeout(() => {
      setPrintPuzzles(
        Array.from({ length: printCount }, () => makePuzzle(difficulty)),
      );
      setPreparingPrint(false);
    }, 0);
  };

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
          <PwaMenuActions />
        </div>
      </header>

      <section className="crossword-heading">
        <div>
          <p className="eyebrow">CROSSWORD SEARCH</p>
          <h1>在交错的字母里，找到今天的新词。</h1>
        </div>
        <p>
          从 250 个动词原形和 750 个其他常用词中随机出题，不再重复动词变形。
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

      <section className="batch-print-bar" aria-label="批量打印单词寻踪">
        <div>
          <strong>批量练习</strong>
          <span>每页 1 题，使用当前难度</span>
        </div>
        <label>
          页数
          <select
            value={printCount}
            onChange={(event) => setPrintCount(Number(event.target.value))}
          >
            {PRINT_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} 页 / {count} 题
              </option>
            ))}
          </select>
        </label>
        <button onClick={printBatch} disabled={preparingPrint}>
          {preparingPrint ? "正在生成…" : `生成并打印 ${printCount} 页`}
        </button>
      </section>

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
            <small>英语 · 词性 · 中文</small>
          </div>
          <ul>
            {puzzle.words.map((item, index) => {
              const isFound = found.includes(item.word);
              return (
                <li key={item.word}>
                  <div
                    className={[
                      "word-list-row",
                      isFound ? "is-found" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span>{(index + 1).toString().padStart(2, "0")}</span>
                    <div>
                      <strong>{item.word}</strong>
                      <small>
                        {item.partOfSpeech} · {item.meaning}
                      </small>
                    </div>
                    <b aria-hidden="true">{isFound ? "✓" : "·"}</b>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </section>

      {won && showWinModal && (
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
              用时 {formatDuration(elapsed)}，共误选 {mistakes} 次。
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

      {printPuzzles && (
        <section className="print-collection" aria-label="单词寻踪打印页">
          {printPuzzles.map((printPuzzle, puzzleIndex) => (
            <article className="print-sheet" key={puzzleIndex}>
              <header className="print-sheet-heading">
                <div>
                  <p>WORD SEARCH</p>
                  <h1>单词寻踪</h1>
                </div>
                <span>
                  {LEVELS[difficulty].label} · {puzzleIndex + 1}/
                  {printPuzzles.length}
                </span>
              </header>
              <p className="print-instructions">
                在字母表中找到下方的 {printPuzzle.words.length} 个单词。
              </p>
              <div
                className="print-crossword-board"
                style={
                  { "--crossword-size": printPuzzle.size } as CSSProperties
                }
              >
                {printPuzzle.letters.map((letter, position) => (
                  <span key={position}>{letter}</span>
                ))}
              </div>
              <ol className="print-word-list">
                {printPuzzle.words.map((item) => (
                  <li key={item.word}>
                    <strong>{item.word}</strong>
                    <span>
                      {item.partOfSpeech} · {item.meaning}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

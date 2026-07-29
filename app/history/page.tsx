"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PwaMenuActions } from "../pwa-register";
import {
  clearScoreHistory,
  formatDuration,
  getScoreHistory,
  type GameId,
  type ScoreEntry,
} from "../lib/score-history";

const GAME_OPTIONS: { id: "all" | GameId; label: string }[] = [
  { id: "all", label: "全部游戏" },
  { id: "sudoku", label: "纸上数独" },
  { id: "merge-1024", label: "合成 1024" },
  { id: "sky-hop", label: "云雀跃" },
  { id: "twilight-canopy", label: "暮色拾星" },
  { id: "maze", label: "纸上迷宫" },
  { id: "crossword", label: "单词寻踪" },
];

function resultValue(entry: ScoreEntry) {
  if (entry.score !== undefined) return `${entry.score.toLocaleString()} 分`;
  if (entry.elapsed !== undefined) return formatDuration(entry.elapsed);
  return entry.completed ? "已完成" : "已结束";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ScoreHistory() {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [gameFilter, setGameFilter] = useState<"all" | GameId>("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const refresh = () => setEntries(getScoreHistory());
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener("paper-arcade-score-recorded", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("paper-arcade-score-recorded", refresh);
    };
  }, []);

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (gameFilter === "all" || entry.gameId === gameFilter) &&
          (difficultyFilter === "all" ||
            entry.difficulty === difficultyFilter),
      ),
    [difficultyFilter, entries, gameFilter],
  );
  const gamesPlayed = new Set(entries.map((entry) => entry.gameId)).size;
  const completed = entries.filter((entry) => entry.completed).length;

  return (
    <main className="history-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <span>成绩只保存在当前设备</span>
          <PwaMenuActions />
        </div>
      </header>

      <section className="history-hero">
        <div>
          <p className="eyebrow">MY PLAYBOOK</p>
          <h1>每一小局，都算数。</h1>
          <p>回看最近的挑战，也看看自己在哪些游戏里走得最远。</p>
        </div>
        <div className="history-summary" aria-label="成绩概览">
          <div>
            <strong>{entries.length}</strong>
            <span>总局数</span>
          </div>
          <div>
            <strong>{completed}</strong>
            <span>完成挑战</span>
          </div>
          <div>
            <strong>{gamesPlayed}</strong>
            <span>玩过游戏</span>
          </div>
        </div>
      </section>

      <section className="history-board">
        <div className="history-toolbar">
          <div className="history-filters">
            <label>
              <span>游戏</span>
              <select
                value={gameFilter}
                onChange={(event) =>
                  setGameFilter(event.target.value as "all" | GameId)
                }
              >
                {GAME_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>难度</span>
              <select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
              >
                <option value="all">全部难度</option>
                <option value="简单">简单</option>
                <option value="中等">中等</option>
                <option value="困难">困难</option>
              </select>
            </label>
          </div>
          {entries.length > 0 && (
            <button
              className="history-clear"
              onClick={() => setConfirmClear(true)}
            >
              清空历史
            </button>
          )}
        </div>

        {visibleEntries.length > 0 ? (
          <ol className="history-list">
            {visibleEntries.map((entry) => (
              <li key={entry.id}>
                <span className="history-game-mark" aria-hidden="true">
                  {entry.gameId === "maze"
                    ? "迷"
                    : entry.gameId === "crossword"
                      ? "词"
                      : entry.gameName.slice(0, 1)}
                </span>
                <div className="history-entry-copy">
                  <div>
                    <strong>{entry.gameName}</strong>
                    {entry.difficulty && <span>{entry.difficulty}</span>}
                  </div>
                  <p>{entry.detail}</p>
                </div>
                <div className="history-result">
                  <strong>{resultValue(entry)}</strong>
                  <time dateTime={entry.createdAt}>
                    {formatDate(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="history-empty">
            <span aria-hidden="true">◎</span>
            <h2>{entries.length ? "没有符合筛选的成绩" : "成绩册还是空白的"}</h2>
            <p>
              {entries.length
                ? "换一个游戏或难度看看。"
                : "完成一局迷宫、单词寻踪或其他游戏后，记录会出现在这里。"}
            </p>
            {!entries.length && (
              <Link className="primary-button" href="/maze">
                去走第一座迷宫
              </Link>
            )}
          </div>
        )}
      </section>

      {confirmClear && (
        <div
          className="modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setConfirmClear(false);
          }}
        >
          <section className="win-modal" role="dialog" aria-modal="true">
            <div className="win-mark" aria-hidden="true">
              !
            </div>
            <p className="eyebrow">请确认</p>
            <h2>清空全部历史？</h2>
            <p>此操作只影响成绩记录，不会重置各游戏正在进行的进度。</p>
            <button
              className="primary-button"
              onClick={() => {
                clearScoreHistory();
                setEntries([]);
                setConfirmClear(false);
              }}
            >
              确认清空
            </button>
            <button
              className="secondary-button"
              onClick={() => setConfirmClear(false)}
            >
              取消
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PwaMenuActions } from "../../pwa-register";

type DiceRoll = {
  id: string;
  sides: number;
  values: number[];
  total: number;
  createdAt: string;
};

const STORAGE_KEY = "paper-arcade-dice-history";
const DICE_SIDES = [6, 8, 10, 12, 20];
const D6_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function randomValue(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

export default function DiceTool() {
  const [count, setCount] = useState(2);
  const [sides, setSides] = useState(6);
  const [values, setValues] = useState([1, 6]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<DiceRoll[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(
          window.localStorage.getItem(STORAGE_KEY) ?? "[]",
        );
        if (Array.isArray(saved)) setHistory(saved);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      timers.current.forEach((activeTimer) =>
        window.clearTimeout(activeTimer),
      );
    };
  }, []);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];

    for (let frame = 0; frame < 7; frame += 1) {
      const timer = window.setTimeout(() => {
        setValues(
          Array.from({ length: count }, () => randomValue(sides)),
        );
      }, frame * 55);
      timers.current.push(timer);
    }

    const finishTimer = window.setTimeout(() => {
      const nextValues = Array.from({ length: count }, () =>
        randomValue(sides),
      );
      const entry: DiceRoll = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sides,
        values: nextValues,
        total: nextValues.reduce((sum, value) => sum + value, 0),
        createdAt: new Date().toISOString(),
      };
      const nextHistory = [entry, ...history].slice(0, 5);
      setValues(nextValues);
      setHistory(nextHistory);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
      setRolling(false);
    }, 420);
    timers.current.push(finishTimer);
  };

  const total = values.reduce((sum, value) => sum + value, 0);
  const changeSides = (nextSides: number) => {
    setSides(nextSides);
    setValues((current) =>
      Array.from({ length: count }, (_, index) =>
        Math.min(current[index] ?? randomValue(nextSides), nextSides),
      ),
    );
  };
  const changeCount = (nextCount: number) => {
    setCount(nextCount);
    setValues((current) =>
      Array.from({ length: nextCount }, (_, index) =>
        current[index] ?? randomValue(sides),
      ),
    );
  };

  return (
    <main className="dice-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <span>游戏工具 · 不计入成绩</span>
          <PwaMenuActions />
        </div>
      </header>

      <section className="dice-layout">
        <div className="dice-copy">
          <p className="eyebrow">POCKET DICE</p>
          <h1>
            随手一掷，
            <br />
            让运气做决定。
          </h1>
          <p>
            聚会、桌游或临时做选择时都能用。结果只记录在当前设备，不会上传。
          </p>

          <div className="dice-controls">
            <fieldset>
              <legend>骰子面数</legend>
              <div className="segmented-control">
                {DICE_SIDES.map((option) => (
                  <button
                    key={option}
                    className={sides === option ? "is-active" : ""}
                    onClick={() => changeSides(option)}
                  >
                    D{option}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span>骰子数量</span>
              <div className="dice-stepper">
                <button
                  aria-label="减少一枚骰子"
                  disabled={count === 1}
                  onClick={() => changeCount(count - 1)}
                >
                  −
                </button>
                <strong>{count}</strong>
                <button
                  aria-label="增加一枚骰子"
                  disabled={count === 6}
                  onClick={() => changeCount(count + 1)}
                >
                  +
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="dice-table">
          <div className="dice-total" aria-live="polite">
            <span>本次合计</span>
            <strong>{total}</strong>
          </div>
          <div className="dice-tray" aria-label={`${count} 枚 D${sides} 骰子`}>
            {values.map((value, index) => (
              <div
                className={`die ${sides === 6 ? "is-d6" : ""} ${
                  rolling ? "is-rolling" : ""
                }`}
                key={`${index}-${sides}`}
                aria-label={`第 ${index + 1} 枚骰子，点数 ${value}`}
              >
                {sides === 6 ? (
                  <span className="dice-pips" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, position) => (
                      <i
                        key={position}
                        className={
                          D6_PIPS[value].includes(position)
                            ? "is-visible"
                            : ""
                        }
                      />
                    ))}
                  </span>
                ) : (
                  <span>{value}</span>
                )}
                <small>D{sides}</small>
              </div>
            ))}
          </div>
          <button
            className="dice-roll-button"
            disabled={rolling}
            onClick={roll}
          >
            {rolling ? "骰子滚动中…" : `掷 ${count} 枚 D${sides}`}
          </button>
        </div>
      </section>

      <section className="dice-history" aria-labelledby="dice-history-title">
        <div>
          <p className="eyebrow">RECENT ROLLS</p>
          <h2 id="dice-history-title">最近五次</h2>
        </div>
        {history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <span>D{entry.sides}</span>
                <strong>{entry.values.join(" + ")}</strong>
                <b>= {entry.total}</b>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dice-empty">掷一次骰子后，结果会出现在这里。</p>
        )}
      </section>
    </main>
  );
}

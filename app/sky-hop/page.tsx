"use client";

import Link from "next/link";
import { recordScore } from "../lib/score-history";
import { PwaMenuActions } from "../pwa-register";
import { useCallback, useEffect, useRef, useState } from "react";

type GamePhase = "ready" | "playing" | "over";
type Gate = { x: number; gapY: number; passed: boolean };
type World = {
  birdY: number;
  velocity: number;
  gates: Gate[];
  score: number;
};

const WIDTH = 420;
const HEIGHT = 700;
const BIRD_X = 104;
const BIRD_SIZE = 62;
const GATE_WIDTH = 62;
const GAP_HEIGHT = 174;
const STORAGE_KEY = "paper-arcade-sky-hop-best";

function initialWorld(): World {
  return {
    birdY: HEIGHT * 0.43,
    velocity: 0,
    gates: [
      { x: 520, gapY: 250, passed: false },
      { x: 790, gapY: 400, passed: false },
    ],
    score: 0,
  };
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function drawGate(
  context: CanvasRenderingContext2D,
  gate: Gate,
  gapTop: number,
  gapBottom: number,
) {
  context.save();
  context.fillStyle = "#f7e9c9";
  context.strokeStyle = "#173e47";
  context.lineWidth = 4;

  drawRoundedRect(context, gate.x, -12, GATE_WIDTH, gapTop + 12, 24);
  drawRoundedRect(
    context,
    gate.x,
    gapBottom,
    GATE_WIDTH,
    HEIGHT - gapBottom + 12,
    24,
  );

  context.fillStyle = "#cf6f58";
  context.strokeStyle = "#173e47";
  context.lineWidth = 3;
  drawRoundedRect(context, gate.x - 8, gapTop - 22, GATE_WIDTH + 16, 28, 14);
  drawRoundedRect(context, gate.x - 8, gapBottom - 6, GATE_WIDTH + 16, 28, 14);

  context.globalAlpha = 0.28;
  context.strokeStyle = "#587a75";
  context.lineWidth = 2;
  for (let offset = 16; offset < GATE_WIDTH; offset += 16) {
    context.beginPath();
    context.moveTo(gate.x + offset, 0);
    context.lineTo(gate.x + offset, gapTop - 24);
    context.moveTo(gate.x + offset, gapBottom + 24);
    context.lineTo(gate.x + offset, HEIGHT);
    context.stroke();
  }
  context.restore();
}

export default function SkyHop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(initialWorld());
  const phaseRef = useRef<GamePhase>("ready");
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const birdRef = useRef<HTMLImageElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const [phase, setPhase] = useState<GamePhase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    const savedScoreTimer = window.setTimeout(() => {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
      setBest(Number.isFinite(saved) ? saved : 0);
    }, 0);

    const background = new Image();
    background.src = "/sky-hop-background.png";
    background.onload = () => {
      backgroundRef.current = background;
    };

    const bird = new Image();
    bird.src = "/sky-lark.png";
    bird.onload = () => {
      birdRef.current = bird;
    };

    return () => window.clearTimeout(savedScoreTimer);
  }, []);

  const endGame = useCallback(() => {
    if (phaseRef.current === "over") return;
    phaseRef.current = "over";
    setPhase("over");
    const finalScore = worldRef.current.score;
    setBest((current) => {
      const next = Math.max(current, finalScore);
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
    recordScore({
      gameId: "sky-hop",
      gameName: "云雀跃",
      score: finalScore,
      detail: `飞过 ${finalScore} 道云门`,
      completed: false,
    });
  }, []);

  const resetWorld = useCallback(() => {
    worldRef.current = initialWorld();
    setScore(0);
  }, []);

  const flap = useCallback(() => {
    if (phaseRef.current === "over") {
      resetWorld();
      phaseRef.current = "playing";
      setPhase("playing");
    } else if (phaseRef.current === "ready") {
      phaseRef.current = "playing";
      setPhase("playing");
    }
    worldRef.current.velocity = -330;
  }, [resetWorld]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" || event.key === "ArrowUp") {
        event.preventDefault();
        flap();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    function render(timestamp: number) {
      const delta = Math.min((timestamp - lastFrameRef.current) / 1000, 0.034);
      lastFrameRef.current = timestamp;
      const world = worldRef.current;

      if (phaseRef.current === "playing") {
        world.velocity += 910 * delta;
        world.birdY += world.velocity * delta;

        for (const gate of world.gates) {
          gate.x -= 150 * delta;
          if (!gate.passed && gate.x + GATE_WIDTH < BIRD_X) {
            gate.passed = true;
            world.score += 1;
            setScore(world.score);
          }
        }

        const firstGate = world.gates[0];
        if (firstGate.x < -GATE_WIDTH - 10) {
          world.gates.shift();
          const lastX = world.gates.at(-1)?.x ?? WIDTH;
          world.gates.push({
            x: lastX + 270,
            gapY: 170 + Math.random() * 350,
            passed: false,
          });
        }

        const birdLeft = BIRD_X - BIRD_SIZE * 0.32;
        const birdRight = BIRD_X + BIRD_SIZE * 0.32;
        const birdTop = world.birdY - BIRD_SIZE * 0.3;
        const birdBottom = world.birdY + BIRD_SIZE * 0.3;
        const hitGate = world.gates.some((gate) => {
          const gapTop = gate.gapY - GAP_HEIGHT / 2;
          const gapBottom = gate.gapY + GAP_HEIGHT / 2;
          const overlapsX =
            birdRight > gate.x && birdLeft < gate.x + GATE_WIDTH;
          return overlapsX && (birdTop < gapTop || birdBottom > gapBottom);
        });

        if (hitGate || birdTop < -10 || birdBottom > HEIGHT - 8) endGame();
      } else if (phaseRef.current === "ready") {
        world.birdY = HEIGHT * 0.43 + Math.sin(timestamp / 380) * 8;
      }

      context.clearRect(0, 0, WIDTH, HEIGHT);
      if (backgroundRef.current) {
        context.drawImage(backgroundRef.current, 0, 0, WIDTH, HEIGHT);
      } else {
        context.fillStyle = "#9bd3cf";
        context.fillRect(0, 0, WIDTH, HEIGHT);
      }

      for (const gate of world.gates) {
        drawGate(
          context,
          gate,
          gate.gapY - GAP_HEIGHT / 2,
          gate.gapY + GAP_HEIGHT / 2,
        );
      }

      context.save();
      context.translate(BIRD_X, world.birdY);
      context.rotate(Math.max(-0.28, Math.min(0.55, world.velocity / 700)));
      if (birdRef.current) {
        context.drawImage(
          birdRef.current,
          -BIRD_SIZE / 2,
          -BIRD_SIZE / 2,
          BIRD_SIZE,
          BIRD_SIZE,
        );
      } else {
        context.fillStyle = "#fff2cf";
        context.beginPath();
        context.arc(0, 0, BIRD_SIZE / 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      animationRef.current = window.requestAnimationFrame(render);
    }

    animationRef.current = window.requestAnimationFrame(render);
    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [endGame]);

  return (
    <main className="sky-shell">
      <header className="game-nav sky-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <span>原创角色 · 原创美术</span>
          <PwaMenuActions />
        </div>
      </header>

      <section className="sky-layout">
        <div className="sky-copy">
          <p className="eyebrow">轻点飞行游戏</p>
          <h1>云雀跃</h1>
          <p>
            点击、轻触或按空格键，让云团小鸟穿过一座座纸云门。
            每穿过一道门，就得到一分。
          </p>
          <div className="sky-record">
            <span>最佳飞行</span>
            <strong>{best}</strong>
          </div>
          <div className="copyright-note">
            本作采用原创角色与场景，不使用其他游戏的名称或美术资产。
          </div>
        </div>

        <div className="sky-game-frame">
          <div className="sky-score" aria-live="polite">
            {score}
          </div>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            aria-label="云雀跃游戏区域。点击或按空格键让小鸟向上飞。"
            onPointerDown={flap}
          />
          {phase !== "playing" && (
            <button className="sky-overlay" onClick={flap}>
              {/* Static PNG avoids a runtime image optimizer request on Sites. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sky-lark.png" alt="" width={120} height={120} />
              <strong>{phase === "ready" ? "轻点起飞" : "再飞一次"}</strong>
              <span>
                {phase === "ready"
                  ? "点击屏幕 / 空格键"
                  : `本次飞过 ${score} 道云门`}
              </span>
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

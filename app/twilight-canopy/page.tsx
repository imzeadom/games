"use client";

import Link from "next/link";
import { recordScore } from "../lib/score-history";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Phase = "ready" | "playing" | "paused" | "over";
type ThemeName = "canopy" | "lagoon" | "aurora";
type Companion = "russet" | "silver" | "midnight";
type PlatformBehavior = "static" | "moving" | "blinking" | "fragile" | "bell";
type Platform = {
  id: number;
  x: number;
  baseX: number;
  y: number;
  width: number;
  segments: 1 | 2;
  kind: "lantern" | "leaf" | "bell";
  behavior: PlatformBehavior;
  motionAmplitude: number;
  motionSpeed: number;
  blinkOffset: number;
  hitsRemaining: number;
  challengeLevel: number;
  active: boolean;
  butterfly: boolean;
  visited: boolean;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};
type Toast = { text: string; until: number };
type World = {
  player: { x: number; y: number; vx: number; vy: number };
  platforms: Platform[];
  particles: Particle[];
  cameraY: number;
  maxHeight: number;
  score: bigint;
  combo: number;
  jumps: number;
  glide: number;
  rocket: number;
  rocketUntil: number;
  shield: number;
  dustRun: number;
  rescueBand: number;
  nextPlatformId: number;
  lastTime: number;
  bufferedUntil: number;
  toast: Toast | null;
  milestone: number;
  lastHudSync: number;
  lastTapAt: number;
  elapsed: number;
  difficultyStage: number;
  wind: number;
  windUntil: number;
  nextGustAt: number;
};
type SaveData = {
  best: string;
  dust: number;
  unlockedThemes: ThemeName[];
  unlockedCompanions: Companion[];
  theme: ThemeName;
  companion: Companion;
};

const WIDTH = 480;
const HEIGHT = 840;
const PLAYER_RADIUS = 22;
const BOUNCE_SPEED = 710;
const GRAVITY = 1180;
const HORIZONTAL_SPEED_MULTIPLIER = 1.5;
const STORAGE_KEY = "paper-arcade-twilight-canopy";
const PENTATONIC = [261.63, 293.66, 329.63, 392, 440];
const DIFFICULTY_STAGES = [
  { startsAt: 0, label: "林梢热身" },
  { startsAt: 45, label: "风枝摇曳" },
  { startsAt: 90, label: "碎叶试炼" },
  { startsAt: 150, label: "星隐时刻" },
  { startsAt: 210, label: "疾风高塔" },
  { startsAt: 270, label: "极光冲刺" },
] as const;

const DEFAULT_SAVE: SaveData = {
  best: "0",
  dust: 0,
  unlockedThemes: ["canopy"],
  unlockedCompanions: ["russet"],
  theme: "canopy",
  companion: "russet",
};

const THEME_META: Record<
  ThemeName,
  { label: string; cost: number; swatch: string }
> = {
  canopy: { label: "暮色林冠", cost: 0, swatch: "#e58b70" },
  lagoon: { label: "月潮水境", cost: 80, swatch: "#55b9bb" },
  aurora: { label: "极光边缘", cost: 180, swatch: "#8e91e8" },
};

const COMPANION_META: Record<
  Companion,
  { label: string; cost: number; color: string }
> = {
  russet: { label: "赤栗飞鼠", cost: 0, color: "#a9573d" },
  silver: { label: "银霜飞鼠", cost: 60, color: "#c6ced4" },
  midnight: { label: "星夜飞鼠", cost: 150, color: "#3f436d" },
};

function fib(index: number): bigint {
  if (index <= 2) return BigInt(1);
  let previous = BigInt(1);
  let current = BigInt(1);
  for (let step = 3; step <= Math.min(index, 34); step += 1) {
    [previous, current] = [current, previous + current];
  }
  return current;
}

function formatScore(value: bigint): string {
  const raw = value.toString();
  if (raw.length <= 9) return Number(raw).toLocaleString("zh-CN");
  const leading = `${raw[0]}.${raw.slice(1, 4)}`;
  return `${leading}e${raw.length - 1}`;
}

function makePlatform(
  id: number,
  x: number,
  y: number,
  width: number,
  kind: Platform["kind"],
  butterfly = false,
  segments: Platform["segments"] = 1,
  behavior: PlatformBehavior = "static",
  challengeLevel = 0,
): Platform {
  return {
    id,
    x,
    baseX: x,
    y,
    width,
    segments,
    kind,
    behavior,
    motionAmplitude:
      behavior === "moving" ? 34 + seededNoise(id + 41) * 42 : 0,
    motionSpeed:
      0.65 + seededNoise(id + 47) * 0.65 + challengeLevel * 0.08,
    blinkOffset: seededNoise(id + 53) * 3.4,
    hitsRemaining:
      behavior === "fragile"
        ? challengeLevel >= 4
          ? 1 + (id % 2)
          : 2 + (id % 2)
        : behavior === "bell"
          ? 1
          : 99,
    challengeLevel,
    active: true,
    butterfly,
    visited: false,
  };
}

function initialWorld(): World {
  const platforms = [
    makePlatform(0, 184, 92, 112, "leaf", false, 2),
    makePlatform(1, 62, 235, 86, "lantern"),
    makePlatform(2, 292, 382, 82, "leaf"),
    makePlatform(3, 126, 535, 92, "lantern", true),
    makePlatform(4, 286, 686, 116, "leaf", false, 2),
    makePlatform(5, 82, 836, 84, "lantern"),
    makePlatform(6, 254, 980, 94, "leaf"),
  ];
  return {
    player: { x: WIDTH / 2, y: 113, vx: 0, vy: BOUNCE_SPEED },
    platforms,
    particles: [],
    cameraY: 0,
    maxHeight: 113,
    score: BigInt(0),
    combo: 0,
    jumps: 0,
    glide: 100,
    rocket: 0,
    rocketUntil: 0,
    shield: 0,
    dustRun: 0,
    rescueBand: -1,
    nextPlatformId: 7,
    lastTime: 0,
    bufferedUntil: 0,
    toast: null,
    milestone: 0,
    lastHudSync: 0,
    lastTapAt: 0,
    elapsed: 0,
    difficultyStage: 0,
    wind: 0,
    windUntil: 0,
    nextGustAt: 105,
  };
}

function seededNoise(value: number) {
  const sine = Math.sin(value * 127.1) * 43758.5453;
  return sine - Math.floor(sine);
}

function difficultyStageFor(elapsed: number) {
  let stage = 0;
  for (let index = 1; index < DIFFICULTY_STAGES.length; index += 1) {
    if (elapsed >= DIFFICULTY_STAGES[index].startsAt) stage = index;
  }
  return stage;
}

function formatRunTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function generateAhead(world: World) {
  let highest = world.platforms.at(-1);
  if (!highest) return;

  while (highest.y < world.cameraY + HEIGHT + 520) {
    const altitude = highest.y;
    const stage = world.difficultyStage;
    const cycle = altitude % 1500;
    const release = cycle > 980;
    const tension = cycle > 520 && cycle <= 980;
    const difficulty = Math.min(
      1,
      Math.max(altitude / 9000, (stage / 5) * 0.88),
    );
    const corridorCycle = altitude % 2600;
    const bellCorridor =
      stage >= 2 &&
      altitude > 1800 &&
      corridorCycle >= 1750 &&
      corridorCycle < 2170;
    const gap = bellCorridor
      ? 68 + seededNoise(world.nextPlatformId + 2) * 10
      : release
        ? 118 + stage * 1.5 + seededNoise(world.nextPlatformId) * 26
        : tension
          ? 146 +
            difficulty * 26 +
            stage * 2.4 +
            seededNoise(world.nextPlatformId) * 18
          : 130 +
            difficulty * 17 +
            stage * 1.8 +
            seededNoise(world.nextPlatformId) * 22;
    const doublePlatform =
      !bellCorridor &&
      (world.nextPlatformId % 9 === 0 ||
        seededNoise(world.nextPlatformId + 29) > 0.86);
    const singleWidth = release
      ? 92 + seededNoise(world.nextPlatformId + 3) * 24
      : Math.max(
          68,
          101 -
            difficulty * 18 -
            stage * 2 -
            (tension ? 7 : 0) +
            seededNoise(world.nextPlatformId + 7) * 20,
        );
    const width = bellCorridor
      ? 50 + seededNoise(world.nextPlatformId + 5) * 12
      : doublePlatform
        ? Math.min(146, singleWidth * 1.58)
        : singleWidth;
    const maxShift = bellCorridor
      ? 76
      : release
        ? 155 + stage * 3
        : 190 + stage * 5;
    const shift =
      (seededNoise(world.nextPlatformId + 11) * 2 - 1) * maxShift;
    const x = Math.max(14, Math.min(WIDTH - width - 14, highest.x + shift));
    const butterfly =
      !bellCorridor &&
      ((release && world.nextPlatformId % 3 === 0) ||
        seededNoise(world.nextPlatformId + 17) > 0.91);
    const behaviorRoll = seededNoise(world.nextPlatformId + 61);
    const blinkChance = stage >= 3 ? 0.1 + (stage - 3) * 0.05 : 0;
    const fragileChance = stage >= 2 ? 0.12 + (stage - 2) * 0.04 : 0;
    const movingChance = stage >= 1 ? 0.16 + (stage - 1) * 0.04 : 0;
    const behavior: PlatformBehavior = bellCorridor
      ? "bell"
      : behaviorRoll < blinkChance
        ? "blinking"
        : behaviorRoll < blinkChance + fragileChance
          ? "fragile"
          : behaviorRoll < blinkChance + fragileChance + movingChance
            ? "moving"
            : "static";
    const platform = makePlatform(
      world.nextPlatformId,
      x,
      highest.y + gap,
      width,
      bellCorridor
        ? "bell"
        : world.nextPlatformId % 2 === 0
          ? "leaf"
          : "lantern",
      butterfly,
      doublePlatform ? 2 : 1,
      behavior,
      stage,
    );
    world.platforms.push(platform);
    world.nextPlatformId += 1;
    highest = platform;
  }
  world.platforms = world.platforms.filter(
    (platform) => platform.y > world.cameraY - 240,
  );
}

function addBurst(
  world: World,
  x: number,
  y: number,
  color: string,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4;
    const speed = 55 + Math.random() * 145;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.55 + Math.random() * 0.5,
      color,
      size: 1.5 + Math.random() * 3.5,
    });
  }
}

function platformOpacity(platform: Platform, timestamp: number) {
  if (!platform.active) return 0;
  if (platform.behavior !== "blinking") return 1;
  const cycle = Math.max(2.35, 3.4 - platform.challengeLevel * 0.16);
  const visibleUntil = Math.max(1.15, 1.85 - platform.challengeLevel * 0.08);
  const phase = (timestamp / 1000 + platform.blinkOffset) % cycle;
  if (phase < visibleUntil) return 1;
  if (phase < visibleUntil + 0.3) {
    return 1 - ((phase - visibleUntil) / 0.3) * 0.9;
  }
  if (phase > cycle - 0.3) {
    return 0.1 + ((phase - (cycle - 0.3)) / 0.3) * 0.9;
  }
  return 0.1;
}

function backgroundColors(altitude: number, theme: ThemeName) {
  if (theme === "lagoon") {
    return altitude < 2200
      ? ["#58b6b4", "#173f59", "#092b42"]
      : ["#264e75", "#151f4c", "#09152f"];
  }
  if (theme === "aurora") {
    return ["#737fc4", "#283c73", "#101c43"];
  }
  if (altitude < 1800) return ["#f0aa78", "#a76575", "#324f69"];
  if (altitude < 4200) return ["#596e91", "#25395d", "#101c3b"];
  return ["#29386b", "#111d45", "#071127"];
}

function drawCloudBank(
  context: CanvasRenderingContext2D,
  y: number,
  color: string,
  alpha: number,
  scale: number,
) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  for (let index = -1; index < 7; index += 1) {
    const x = index * 92 + (index % 2) * 18;
    context.beginPath();
    context.ellipse(x, y, 82 * scale, 24 * scale, 0, 0, Math.PI * 2);
    context.ellipse(
      x + 48 * scale,
      y - 15 * scale,
      54 * scale,
      27 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  world: World,
  timestamp: number,
  theme: ThemeName,
) {
  const [top, middle, bottom] = backgroundColors(world.maxHeight, theme);
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.52, middle);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();

  const moonY =
    112 + ((world.cameraY * 0.018) % (HEIGHT + 240));
  const moonGradient = context.createRadialGradient(
    368,
    moonY,
    4,
    368,
    moonY,
    58,
  );
  moonGradient.addColorStop(0, "rgba(255, 249, 216, .94)");
  moonGradient.addColorStop(0.55, "rgba(255, 232, 183, .54)");
  moonGradient.addColorStop(1, "rgba(255, 224, 171, 0)");
  context.fillStyle = moonGradient;
  context.beginPath();
  context.arc(368, moonY, 58, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 248, 220, .78)";
  context.beginPath();
  context.arc(368, moonY, 28, 0, Math.PI * 2);
  context.fill();

  const farCloudOffset = (world.cameraY * 0.1) % 320;
  drawCloudBank(
    context,
    215 + farCloudOffset,
    theme === "lagoon" ? "#8dd7d1" : "#e9c7c2",
    0.12,
    1.05,
  );
  drawCloudBank(
    context,
    565 + farCloudOffset,
    theme === "aurora" ? "#94b7d5" : "#b8c7c6",
    0.1,
    0.82,
  );

  context.lineCap = "round";
  for (let layer = 0; layer < 2; layer += 1) {
    const factor = layer === 0 ? 0.14 : 0.25;
    const offset = (world.cameraY * factor) % 430;
    context.globalAlpha = layer === 0 ? 0.12 : 0.2;
    context.strokeStyle =
      theme === "lagoon"
        ? layer === 0
          ? "#184963"
          : "#102f4c"
        : layer === 0
          ? "#3e5365"
          : "#203b4b";
    context.lineWidth = layer === 0 ? 19 : 28;
    for (let index = 0; index < 5; index += 1) {
      const x = 28 + index * 126 + (layer ? 23 : 0);
      const baseY = HEIGHT + 120 - ((offset + index * 177) % 430);
      context.beginPath();
      context.moveTo(x, baseY + 280);
      context.bezierCurveTo(
        x - 18,
        baseY + 150,
        x + 26,
        baseY + 38,
        x + Math.sin(index) * 24,
        baseY - 150,
      );
      context.stroke();
      context.lineWidth = layer === 0 ? 7 : 10;
      context.beginPath();
      context.moveTo(x, baseY + 42);
      context.quadraticCurveTo(x - 54, baseY - 5, x - 102, baseY + 11);
      context.moveTo(x + 4, baseY - 28);
      context.quadraticCurveTo(x + 52, baseY - 68, x + 96, baseY - 55);
      context.stroke();
      context.lineWidth = layer === 0 ? 19 : 28;
    }
  }

  for (let index = 0; index < 74; index += 1) {
    const x = seededNoise(index + 9) * WIDTH;
    const y =
      (seededNoise(index + 33) * HEIGHT +
        world.cameraY * (0.04 + (index % 4) * 0.012)) %
      HEIGHT;
    const glow =
      0.2 +
      Math.max(0, Math.sin(timestamp / 620 + index * 1.7)) * 0.58;
    context.globalAlpha = glow;
    context.fillStyle = index % 7 === 0 ? "#c6f4e0" : "#fff4cb";
    context.beginPath();
    context.arc(x, HEIGHT - y, index % 9 === 0 ? 2 : 1, 0, Math.PI * 2);
    context.fill();
  }

  for (let index = 0; index < 12; index += 1) {
    const drift =
      (seededNoise(index + 80) * HEIGHT +
        world.cameraY * (0.34 + (index % 3) * 0.035)) %
      (HEIGHT + 80);
    const x =
      seededNoise(index + 94) * WIDTH +
      Math.sin(timestamp / 1300 + index) * 12;
    const y = HEIGHT + 40 - drift;
    context.globalAlpha = 0.18 + (index % 4) * 0.06;
    context.fillStyle =
      index % 3 === 0 ? "#f7b4aa" : index % 3 === 1 ? "#b5e4c9" : "#ffe6ad";
    context.beginPath();
    context.ellipse(x, y, 7, 3.2, 0.8 + index, 0, Math.PI * 2);
    context.fill();
  }

  const auroraStrength = Math.min(0.52, Math.max(0, world.maxHeight - 3200) / 4200);
  if (auroraStrength > 0 || theme === "aurora") {
    context.globalAlpha = theme === "aurora" ? 0.42 : auroraStrength;
    context.lineWidth = 34;
    for (let ribbon = 0; ribbon < 3; ribbon += 1) {
      context.strokeStyle = ["#6be2b5", "#8ea9ff", "#f0a8dc"][ribbon];
      context.beginPath();
      for (let x = -20; x <= WIDTH + 20; x += 12) {
        const y =
          82 +
          ribbon * 28 +
          Math.sin(x / 70 + timestamp / 1700 + ribbon) * 22;
        if (x === -20) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  }

  const nearCloudOffset = (world.cameraY * 0.38) % 410;
  drawCloudBank(
    context,
    HEIGHT - 110 + nearCloudOffset,
    theme === "lagoon" ? "#85d5d0" : "#d5d4c8",
    0.09,
    1.25,
  );

  if (world.windUntil > world.elapsed && world.wind !== 0) {
    context.save();
    context.globalAlpha = 0.16 + world.difficultyStage * 0.025;
    context.strokeStyle = "#e6f5e9";
    context.lineWidth = 2;
    const direction = Math.sign(world.wind);
    for (let index = 0; index < 13; index += 1) {
      const travel = (timestamp * (0.22 + index * 0.006)) % (WIDTH + 180);
      const x = direction > 0 ? travel - 140 : WIDTH + 140 - travel;
      const y = 70 + ((index * 67 + world.cameraY * 0.11) % (HEIGHT - 120));
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(
        x - direction * 34,
        y - 5,
        x - direction * 78,
        y + 2,
      );
      context.stroke();
    }
    context.restore();
  }

  context.globalAlpha = 0.3;
  const canopyColor = theme === "lagoon" ? "#062f40" : "#172f31";
  context.fillStyle = canopyColor;
  for (let index = 0; index < 9; index += 1) {
    const x = index * 72 - 30 - ((world.cameraY * 0.24) % 72);
    const y = HEIGHT - 28 + Math.sin(index * 2.2) * 14;
    context.beginPath();
    context.ellipse(x, y, 82, 38, index % 2 ? 0.25 : -0.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPlatform(
  context: CanvasRenderingContext2D,
  platform: Platform,
  screenY: number,
  timestamp: number,
  theme: ThemeName,
) {
  const pulse = 0.86 + Math.sin(timestamp / 420 + platform.id) * 0.08;
  const opacity = platformOpacity(platform, timestamp);
  const glow =
    theme === "lagoon"
      ? "rgba(119, 236, 221, .42)"
      : "rgba(255, 212, 132, .48)";
  context.save();
  context.globalAlpha = opacity;
  context.shadowBlur = platform.visited ? 7 : 18 * pulse;
  context.shadowColor = glow;

  if (platform.kind === "bell") {
    const centerX = platform.x + platform.width / 2;
    context.shadowBlur = 22 * pulse;
    context.shadowColor = "#ffe49a";
    const bellGradient = context.createLinearGradient(
      centerX,
      screenY - 5,
      centerX,
      screenY + 28,
    );
    bellGradient.addColorStop(0, "#fff2b8");
    bellGradient.addColorStop(0.48, "#f2bd55");
    bellGradient.addColorStop(1, "#ba7049");
    context.fillStyle = bellGradient;
    context.beginPath();
    context.moveTo(platform.x - 4, screenY + 1);
    context.quadraticCurveTo(centerX, screenY - 7, platform.x + platform.width + 4, screenY + 1);
    context.quadraticCurveTo(
      platform.x + platform.width - 1,
      screenY + 17,
      platform.x + platform.width + 7,
      screenY + 22,
    );
    context.quadraticCurveTo(centerX, screenY + 28, platform.x - 7, screenY + 22);
    context.quadraticCurveTo(platform.x + 1, screenY + 17, platform.x - 4, screenY + 1);
    context.fill();
    context.strokeStyle = "rgba(101, 62, 55, .55)";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "#8e5445";
    context.beginPath();
    context.arc(centerX, screenY + 27, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(91, 55, 55, .78)";
    context.beginPath();
    context.arc(centerX - 6, screenY + 12, 1.4, 0, Math.PI * 2);
    context.arc(centerX + 6, screenY + 12, 1.4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  const segmentGap = platform.segments === 2 ? 5 : 0;
  const segmentWidth =
    (platform.width - segmentGap * (platform.segments - 1)) /
    platform.segments;

  for (let segment = 0; segment < platform.segments; segment += 1) {
    const segmentX = platform.x + segment * (segmentWidth + segmentGap);
    if (platform.kind === "lantern") {
      const gradient = context.createLinearGradient(
        segmentX,
        screenY - 4,
        segmentX,
        screenY + 14,
      );
      gradient.addColorStop(0, platform.visited ? "#dcc38f" : "#fff0b7");
      gradient.addColorStop(1, platform.visited ? "#866257" : "#dd7f74");
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(segmentX - 5, screenY);
      context.lineTo(segmentX + segmentWidth + 5, screenY);
      context.lineTo(segmentX + segmentWidth - 4, screenY + 14);
      context.quadraticCurveTo(
        segmentX + segmentWidth / 2,
        screenY + 18,
        segmentX + 4,
        screenY + 14,
      );
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(73, 46, 57, .48)";
      context.lineWidth = 1.4;
      context.stroke();

      if (!platform.visited && segmentWidth > 38) {
        const faceX = segmentX + segmentWidth / 2;
        context.fillStyle = "rgba(77, 50, 65, .78)";
        context.beginPath();
        context.arc(faceX - 5, screenY + 7, 1.35, 0, Math.PI * 2);
        context.arc(faceX + 5, screenY + 7, 1.35, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(77, 50, 65, .65)";
        context.beginPath();
        context.arc(faceX, screenY + 8, 3, 0.15, Math.PI - 0.15);
        context.stroke();
      }
    } else {
      const gradient = context.createLinearGradient(
        segmentX,
        screenY,
        segmentX + segmentWidth,
        screenY + 15,
      );
      gradient.addColorStop(0, platform.visited ? "#54766a" : "#a5d6a4");
      gradient.addColorStop(1, platform.visited ? "#335a58" : "#4d9279");
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(segmentX - 5, screenY + 2);
      context.quadraticCurveTo(
        segmentX + segmentWidth * 0.48,
        screenY - 8,
        segmentX + segmentWidth + 5,
        screenY + 2,
      );
      context.quadraticCurveTo(
        segmentX + segmentWidth * 0.55,
        screenY + 17,
        segmentX - 5,
        screenY + 2,
      );
      context.fill();
      context.strokeStyle = "rgba(24, 67, 61, .5)";
      context.lineWidth = 1.3;
      context.beginPath();
      context.moveTo(segmentX + 5, screenY + 3);
      context.quadraticCurveTo(
        segmentX + segmentWidth / 2,
        screenY + 7,
        segmentX + segmentWidth - 3,
        screenY + 3,
      );
      context.stroke();

      if (!platform.visited && segmentWidth > 40) {
        const faceX = segmentX + segmentWidth * 0.48;
        context.fillStyle = "rgba(29, 77, 65, .72)";
        context.beginPath();
        context.arc(faceX - 5, screenY + 6, 1.2, 0, Math.PI * 2);
        context.arc(faceX + 5, screenY + 6, 1.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (platform.behavior === "moving") {
    context.globalAlpha = opacity * 0.64;
    context.fillStyle = "#eaf2dc";
    context.font = "9px ui-monospace";
    context.textAlign = "center";
    context.fillText("↔", platform.x + platform.width / 2, screenY + 25);
  }

  if (platform.behavior === "fragile") {
    context.globalAlpha = opacity * 0.78;
    context.strokeStyle = "#f4d7ba";
    context.lineWidth = 1.2;
    context.beginPath();
    const crackX = platform.x + platform.width * 0.55;
    context.moveTo(crackX, screenY + 1);
    context.lineTo(crackX - 5, screenY + 7);
    context.lineTo(crackX + 2, screenY + 12);
    context.stroke();
    context.fillStyle = "#ffe3ad";
    for (let hit = 0; hit < platform.hitsRemaining; hit += 1) {
      context.beginPath();
      context.arc(
        platform.x + platform.width - 7 - hit * 7,
        screenY + 20,
        1.8,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  if (platform.butterfly) {
    const butterflyX = platform.x + platform.width * 0.5;
    const butterflyY = screenY - 36 + Math.sin(timestamp / 280 + platform.id) * 5;
    context.shadowBlur = 22;
    context.shadowColor = "#72d8ff";
    context.fillStyle = "#99e8ff";
    context.globalAlpha = 0.88;
    context.beginPath();
    context.ellipse(butterflyX - 7, butterflyY, 8, 4, -0.55, 0, Math.PI * 2);
    context.ellipse(butterflyX + 7, butterflyY, 8, 4, 0.55, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e5f9ff";
    context.fillRect(butterflyX - 1, butterflyY - 5, 2, 10);
  }
  context.restore();
}

function drawSquirrel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  world: World,
  gliding: boolean,
  companion: Companion,
  alpha = 1,
) {
  const color = COMPANION_META[companion].color;
  const tilt = Math.max(-0.32, Math.min(0.32, world.player.vx / 700));
  const membrane =
    companion === "russet"
      ? "#e9aa85"
      : companion === "silver"
        ? "#eee6d9"
        : "#858bc5";
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(tilt);
  context.shadowBlur = 12;
  context.shadowColor = "rgba(19, 20, 45, .35)";
  const rocketActive = world.rocketUntil > world.lastTime;

  if (gliding) {
    context.fillStyle = membrane;
    context.beginPath();
    context.moveTo(-5, -9);
    context.quadraticCurveTo(-38, -7, -42, 13);
    context.quadraticCurveTo(-25, 8, -7, 18);
    context.quadraticCurveTo(0, 22, 7, 18);
    context.quadraticCurveTo(25, 8, 42, 13);
    context.quadraticCurveTo(38, -7, 5, -9);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(95, 65, 78, .32)";
    context.lineWidth = 1.2;
    context.stroke();
  }

  if (rocketActive) {
    context.fillStyle = "#53647b";
    context.beginPath();
    context.roundRect(-17, -1, 8, 19, 4);
    context.roundRect(9, -1, 8, 19, 4);
    context.fill();
    const flameLength =
      17 + Math.sin(world.lastTime / 45) * 5;
    const flameGradient = context.createLinearGradient(
      0,
      15,
      0,
      15 + flameLength,
    );
    flameGradient.addColorStop(0, "#fff4a5");
    flameGradient.addColorStop(0.48, "#ffaf50");
    flameGradient.addColorStop(1, "rgba(239, 94, 83, 0)");
    context.fillStyle = flameGradient;
    for (const flameX of [-13, 13]) {
      context.beginPath();
      context.moveTo(flameX - 4, 14);
      context.quadraticCurveTo(
        flameX,
        17 + flameLength,
        flameX + 4,
        14,
      );
      context.fill();
    }
  }

  context.strokeStyle = color;
  context.lineWidth = 13;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(8, 10);
  context.bezierCurveTo(35, 28, 38, -7, 22, -4);
  context.stroke();
  context.strokeStyle = "rgba(255, 234, 207, .32)";
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(15, 13);
  context.quadraticCurveTo(31, 20, 30, 1);
  context.stroke();

  context.fillStyle = color;
  context.beginPath();
  context.ellipse(0, 3, 13, 18, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fff0d5";
  context.beginPath();
  context.ellipse(0, 6, 7, 11, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = color;
  context.beginPath();
  context.ellipse(-9, 18, 7, 4, -0.15, 0, Math.PI * 2);
  context.ellipse(9, 18, 7, 4, 0.15, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = color;
  context.beginPath();
  context.ellipse(-11, -24, 7, 10, -0.35, 0, Math.PI * 2);
  context.ellipse(11, -24, 7, 10, 0.35, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = membrane;
  context.beginPath();
  context.ellipse(-11, -24, 3.5, 6, -0.35, 0, Math.PI * 2);
  context.ellipse(11, -24, 3.5, 6, 0.35, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = color;
  context.beginPath();
  context.ellipse(0, -17, 18, 16, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fff7e7";
  context.beginPath();
  context.ellipse(-6.5, -19, 5.4, 6.2, 0, 0, Math.PI * 2);
  context.ellipse(6.5, -19, 5.4, 6.2, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#252a3d";
  context.beginPath();
  context.ellipse(-6.2, -18.5, 3.2, 4.1, 0, 0, Math.PI * 2);
  context.ellipse(6.2, -18.5, 3.2, 4.1, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "white";
  context.beginPath();
  context.arc(-7.2, -20, 1.15, 0, Math.PI * 2);
  context.arc(5.2, -20, 1.15, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#6f4250";
  context.beginPath();
  context.ellipse(0, -13, 2.4, 1.8, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#6f4250";
  context.lineWidth = 1.1;
  context.beginPath();
  context.arc(-2.2, -11.5, 2.2, 0.12, 1.3);
  context.arc(2.2, -11.5, 2.2, Math.PI - 1.3, Math.PI - 0.12);
  context.stroke();

  context.fillStyle = "rgba(245, 143, 145, .52)";
  context.beginPath();
  context.ellipse(-12.5, -12.5, 3.8, 2.1, 0, 0, Math.PI * 2);
  context.ellipse(12.5, -12.5, 3.8, 2.1, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = color;
  context.beginPath();
  context.ellipse(-13, 1, 5, 3, -0.7, 0, Math.PI * 2);
  context.ellipse(13, 1, 5, 3, 0.7, 0, Math.PI * 2);
  context.fill();

  if (world.shield >= 100) {
    context.shadowBlur = 20;
    context.shadowColor = "#e8f6ff";
    context.strokeStyle = "rgba(221, 245, 255, .8)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, -5, 38, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

export default function TwilightCanopy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameColumnRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World>(initialWorld());
  const phaseRef = useRef<Phase>("ready");
  const inputRef = useRef({
    left: false,
    right: false,
    glide: false,
    pointerX: WIDTH / 2,
    tilt: 0,
  });
  const audioRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const saveRef = useRef<SaveData>(DEFAULT_SAVE);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState("0");
  const [combo, setCombo] = useState(0);
  const [height, setHeight] = useState(0);
  const [runTime, setRunTime] = useState("00:00");
  const [difficultyStage, setDifficultyStage] = useState(0);
  const [glide, setGlide] = useState(100);
  const [rocket, setRocket] = useState(0);
  const [shield, setShield] = useState(0);
  const [dustRun, setDustRun] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [showCollection, setShowCollection] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const syncHud = useCallback(() => {
    const world = worldRef.current;
    setScore(formatScore(world.score));
    setCombo(world.combo);
    setHeight(Math.floor(world.maxHeight / 10));
    setRunTime(formatRunTime(world.elapsed));
    setDifficultyStage(world.difficultyStage);
    setGlide(Math.round(world.glide));
    setRocket(Math.round(world.rocket));
    setShield(Math.round(world.shield));
    setDustRun(world.dustRun);
    setToast(
      world.toast && world.toast.until > performance.now()
        ? world.toast.text
        : null,
    );
  }, []);

  const persistSave = useCallback((next: SaveData) => {
    saveRef.current = next;
    setSave(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    const initializeSave = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as Partial<SaveData>;
        const next = {
          ...DEFAULT_SAVE,
          ...parsed,
          unlockedThemes: parsed.unlockedThemes ?? ["canopy"],
          unlockedCompanions: parsed.unlockedCompanions ?? ["russet"],
        };
        saveRef.current = next;
        setSave(next);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(initializeSave);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const hideToast = window.setTimeout(() => {
      worldRef.current.toast = null;
      setToast(null);
    }, 1550);
    return () => window.clearTimeout(hideToast);
  }, [toast]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const input = inputRef.current;
    if (!motionEnabled) {
      input.tilt = 0;
      return;
    }

    const onOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0;
      const deadZone = 1.2;
      input.tilt =
        Math.abs(gamma) <= deadZone
          ? 0
          : Math.max(-1, Math.min(1, gamma / 12));
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      input.tilt = 0;
    };
  }, [motionEnabled]);

  const toggleFullscreen = useCallback(async () => {
    const target = gameColumnRef.current;
    if (!target) return;
    try {
      if (isPseudoFullscreen) {
        setIsPseudoFullscreen(false);
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else {
        setIsPseudoFullscreen(true);
      }
    } catch {
      setIsPseudoFullscreen(true);
    }
  }, [isPseudoFullscreen]);

  const toggleMotion = useCallback(async () => {
    if (motionEnabled) {
      setMotionEnabled(false);
      return;
    }

    try {
      const orientationApi = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      const permission = orientationApi.requestPermission
        ? await orientationApi.requestPermission()
        : "granted";
      if (permission !== "granted") {
        worldRef.current.toast = {
          text: "未获得动作与方向权限",
          until: performance.now() + 1500,
        };
        syncHud();
        return;
      }
      setMotionEnabled(true);
      worldRef.current.toast = {
        text: "重力操控已开启 · 轻轻左右倾斜手机",
        until: performance.now() + 1800,
      };
      syncHud();
    } catch {
      worldRef.current.toast = {
        text: "此设备暂不支持重力操控",
        until: performance.now() + 1500,
      };
      syncHud();
    }
  }, [motionEnabled, syncHud]);

  const chime = useCallback((comboCount: number, special = false) => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    const audio = audioRef.current;
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    const notes = special
      ? [PENTATONIC[0], PENTATONIC[2], PENTATONIC[4]]
      : [PENTATONIC[comboCount % PENTATONIC.length]];

    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = special ? "sine" : "triangle";
      oscillator.frequency.value =
        frequency * (1 + Math.floor(comboCount / 5) * 0.5);
      gain.gain.setValueAtTime(0.0001, now + index * 0.045);
      gain.gain.exponentialRampToValueAtTime(
        special ? 0.1 : 0.055,
        now + 0.012 + index * 0.045,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.48 + index * 0.045,
      );
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now + index * 0.045);
      oscillator.stop(now + 0.52 + index * 0.045);
    });
  }, []);

  const activateRocket = useCallback(() => {
    const world = worldRef.current;
    if (phaseRef.current !== "playing" || world.rocket < 20) return;
    const charge = world.rocket;
    world.rocket = 0;
    world.rocketUntil = performance.now() + 720 + charge * 5;
    world.player.vy = Math.max(world.player.vy, 820 + charge * 1.7);
    world.glide = Math.min(100, world.glide + 20);
    world.toast = {
      text: `星火喷射 · ${Math.round(charge)}%`,
      until: performance.now() + 1300,
    };
    addBurst(world, world.player.x, world.player.y - 8, "#ffd574", 32);
    chime(world.combo, true);
    syncHud();
  }, [chime, syncHud]);

  const endGame = useCallback(() => {
    if (phaseRef.current === "over") return;
    const world = worldRef.current;
    phaseRef.current = "over";
    setPhase("over");
    inputRef.current.glide = false;
    inputRef.current.left = false;
    inputRef.current.right = false;
    syncHud();
    const safeScore =
      world.score > BigInt(Number.MAX_SAFE_INTEGER)
        ? Number.MAX_SAFE_INTEGER
        : Number(world.score);
    recordScore({
      gameId: "twilight-canopy",
      gameName: "暮色拾星",
      score: safeScore,
      elapsed: Math.floor(world.elapsed),
      detail: `星分 ${formatScore(world.score)} · 高度 ${Math.floor(
        world.maxHeight / 10,
      )} m`,
      completed: false,
    });
  }, [syncHud]);

  const start = useCallback(() => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    phaseRef.current = "playing";
    setPhase("playing");
  }, []);

  const resetJourney = useCallback(() => {
    const previous = worldRef.current;
    const currentBest = BigInt(saveRef.current.best || "0");
    const nextBest = previous.score > currentBest ? previous.score : currentBest;
    persistSave({ ...saveRef.current, best: nextBest.toString() });
    worldRef.current = initialWorld();
    phaseRef.current = "playing";
    setPhase("playing");
    syncHud();
  }, [persistSave, syncHud]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "ready" || phaseRef.current === "over") return;
    const next = phaseRef.current === "paused" ? "playing" : "paused";
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        inputRef.current.left = true;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        inputRef.current.right = true;
      }
      if (event.code === "Space") {
        inputRef.current.glide = true;
        worldRef.current.bufferedUntil = performance.now() + 140;
        if (phaseRef.current === "ready") start();
      }
      if (event.code === "KeyP" || event.code === "Escape") togglePause();
      if (event.code === "KeyR") resetJourney();
    }
    function keyUp(event: KeyboardEvent) {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        inputRef.current.left = false;
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        inputRef.current.right = false;
      }
      if (event.code === "Space") inputRef.current.glide = false;
    }
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [resetJourney, start, togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const update = (timestamp: number) => {
      const world = worldRef.current;
      const delta = Math.min(
        world.lastTime ? (timestamp - world.lastTime) / 1000 : 0,
        0.032,
      );
      world.lastTime = timestamp;
      const input = inputRef.current;
      const playing = phaseRef.current === "playing";

      for (const platform of world.platforms) {
        if (platform.behavior !== "moving" || !platform.active) continue;
        const movingX =
          platform.baseX +
          Math.sin(timestamp / 1000 * platform.motionSpeed + platform.id) *
            platform.motionAmplitude;
        platform.x = Math.max(
          8,
          Math.min(WIDTH - platform.width - 8, movingX),
        );
      }

      if (playing && delta > 0) {
        const player = world.player;
        world.elapsed += delta;
        const nextDifficultyStage = difficultyStageFor(world.elapsed);
        if (nextDifficultyStage !== world.difficultyStage) {
          world.difficultyStage = nextDifficultyStage;
          const stageName = DIFFICULTY_STAGES[nextDifficultyStage].label;
          world.toast = {
            text: `难度提升 · ${stageName}`,
            until: timestamp + 1700,
          };
          addBurst(
            world,
            WIDTH / 2,
            world.cameraY + HEIGHT - 100,
            "#dce9ff",
            30,
          );
          chime(world.combo, true);
          syncHud();
        }

        if (
          world.difficultyStage >= 2 &&
          world.elapsed >= world.nextGustAt
        ) {
          const gustSeed = Math.floor(world.elapsed) + world.jumps * 7;
          const direction = seededNoise(gustSeed) > 0.5 ? 1 : -1;
          world.wind =
            direction * (120 + world.difficultyStage * 34);
          world.windUntil =
            world.elapsed + Math.max(1.35, 2.45 - world.difficultyStage * 0.16);
          world.nextGustAt =
            world.elapsed + Math.max(7, 14 - world.difficultyStage * 1.15);
          world.toast = {
            text: direction > 0 ? "疾风从左侧吹来" : "疾风从右侧吹来",
            until: timestamp + 1050,
          };
          syncHud();
        }
        if (world.windUntil <= world.elapsed) world.wind = 0;

        const previousY = player.y;
        const descending = player.vy < 0;
        const gliding = descending && input.glide && world.glide > 0;
        const rocketActive = world.rocketUntil > timestamp;
        const keyboardDirection =
          (input.left ? -1 : 0) + (input.right ? 1 : 0);
        const direction =
          keyboardDirection ||
          (input.glide
            ? Math.sign(input.pointerX - player.x)
            : input.tilt);
        const acceleration =
          (gliding ? 1250 : 900) * HORIZONTAL_SPEED_MULTIPLIER;
        player.vx += direction * acceleration * delta;
        if (direction === 0) player.vx *= Math.pow(0.055, delta);
        const maxSpeed =
          (gliding ? 350 : 275) * HORIZONTAL_SPEED_MULTIPLIER;
        player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
        if (world.wind !== 0 && world.windUntil > world.elapsed) {
          player.vx += world.wind * delta;
        }

        const gravity = rocketActive
          ? GRAVITY * 0.12
          : gliding
            ? GRAVITY * 0.3
            : GRAVITY;
        player.vy -= gravity * delta;
        if (rocketActive) {
          player.vy = Math.min(980, player.vy + 250 * delta);
          if (Math.random() < 0.48) {
            world.particles.push({
              x: player.x + (Math.random() - 0.5) * 13,
              y: player.y - 24,
              vx: (Math.random() - 0.5) * 38,
              vy: -110 - Math.random() * 90,
              life: 0.35 + Math.random() * 0.25,
              color: Math.random() > 0.5 ? "#ffd36f" : "#f38b64",
              size: 2 + Math.random() * 3,
            });
          }
        }
        if (gliding) {
          player.vy = Math.max(player.vy, -130);
          world.glide = Math.max(0, world.glide - 42 * delta);
        }
        player.x += player.vx * delta;
        player.y += player.vy * delta;

        if (player.x < -PLAYER_RADIUS) player.x = WIDTH + PLAYER_RADIUS;
        if (player.x > WIDTH + PLAYER_RADIUS) player.x = -PLAYER_RADIUS;

        if (player.vy < 0) {
          let closest: Platform | null = null;
          let closestGap = Infinity;
          for (const platform of world.platforms) {
            if (
              !platform.active ||
              platformOpacity(platform, timestamp) < 0.55
            ) {
              continue;
            }
            const expandedLeft = platform.x - platform.width * 0.18;
            const expandedRight =
              platform.x + platform.width + platform.width * 0.18;
            const horizontalGap =
              player.x < expandedLeft
                ? expandedLeft - player.x
                : player.x > expandedRight
                  ? player.x - expandedRight
                  : 0;
            const nearY = player.y < platform.y + 58 && player.y > platform.y - 22;
            if (nearY && horizontalGap < closestGap && horizontalGap < 34) {
              closest = platform;
              closestGap = horizontalGap;
            }
          }

          if (closest) {
            const center = closest.x + closest.width / 2;
            player.vx += Math.sign(center - player.x) * 430 * delta;
            const withinExpanded =
              player.x + PLAYER_RADIUS * 0.58 >=
                closest.x - closest.width * 0.18 &&
              player.x - PLAYER_RADIUS * 0.58 <=
                closest.x + closest.width * 1.18;
            const crossed =
              previousY >= closest.y - 2 && player.y <= closest.y + 8;
            const coyoteCatch =
              player.y > closest.y - 15 &&
              player.y < closest.y + 22 &&
              closestGap < 24;

            if (withinExpanded && (crossed || coyoteCatch)) {
              player.y = closest.y + 1;
              player.vy = BOUNCE_SPEED + Math.min(55, world.combo * 1.4);
              if (timestamp < world.bufferedUntil) {
                player.vy += 45;
                world.bufferedUntil = 0;
              }
              world.glide = Math.min(100, world.glide + 18);
              let brokeFragile = false;
              if (closest.behavior === "fragile") {
                closest.hitsRemaining -= 1;
                if (closest.hitsRemaining <= 0) {
                  closest.active = false;
                  brokeFragile = true;
                }
              }
              const firstVisit = !closest.visited;
              if (firstVisit) {
                closest.visited = true;
                world.jumps += 1;
                world.combo += 1;
                const multiplier = fib(world.combo);
                world.score +=
                  BigInt(10 + world.jumps * 10) * multiplier;
                world.dustRun += 1;

                if (closest.behavior === "bell") {
                  closest.active = false;
                  world.rocket = Math.min(100, world.rocket + 18);
                  world.dustRun += 2;
                  addBurst(world, player.x, player.y, "#ffe08a", 22);
                  world.toast = {
                    text: `铃廊充能 · 火箭 ${Math.round(world.rocket)}%`,
                    until: timestamp + 1100,
                  };
                  chime(world.combo, true);
                } else {
                  const perfect =
                    Math.abs(player.x - (closest.x + closest.width / 2)) <
                    closest.width * 0.18;
                  if (perfect) {
                    world.shield = Math.min(100, world.shield + 28);
                    addBurst(world, player.x, player.y, "#fff0b5", 16);
                    world.toast = {
                      text: "完美落点 · 护盾充能",
                      until: timestamp + 920,
                    };
                  } else {
                    addBurst(world, player.x, player.y, "#b7e7c8", 9);
                  }

                  if (closest.butterfly) {
                    closest.butterfly = false;
                    world.score =
                      world.score === BigInt(0)
                        ? BigInt(100)
                        : world.score * BigInt(2);
                    world.dustRun += 8;
                    addBurst(world, player.x, player.y + 34, "#8be7ff", 28);
                    world.toast = {
                      text: "灵蝶相伴 · 总分 ×2",
                      until: timestamp + 1300,
                    };
                    chime(world.combo, true);
                  } else {
                    chime(world.combo);
                  }
                }

                const nextMilestone = world.score.toString().length;
                if (nextMilestone > world.milestone && nextMilestone >= 5) {
                  world.milestone = nextMilestone;
                  addBurst(world, WIDTH / 2, world.cameraY + HEIGHT - 80, "#ffe7a1", 42);
                  world.toast = {
                    text: `星芒突破 · ${nextMilestone} 位数`,
                    until: timestamp + 1500,
                  };
                }
                syncHud();
              }
              if (brokeFragile) {
                addBurst(world, player.x, player.y, "#f2c6a0", 20);
                world.toast = {
                  text: "星叶碎成了微尘",
                  until: timestamp + 950,
                };
                syncHud();
              }
            }
          }
        }

        world.maxHeight = Math.max(world.maxHeight, player.y);
        const targetCamera = Math.max(
          world.cameraY,
          player.y - HEIGHT * 0.46,
        );
        world.cameraY += (targetCamera - world.cameraY) * Math.min(1, delta * 4.8);
        generateAhead(world);

        const rescueSpan =
          world.difficultyStage >= 5
            ? Number.POSITIVE_INFINITY
            : world.difficultyStage >= 4
              ? 1900
              : world.difficultyStage >= 3
                ? 1400
                : 1000;
        const currentBand = Number.isFinite(rescueSpan)
          ? Math.floor(world.cameraY / rescueSpan)
          : -99;
        if (player.y < world.cameraY - 82) {
          const nearest = world.platforms
            .filter((platform) => platform.y > world.cameraY + 100)
            .sort((first, second) => first.y - second.y)[0];
          const protectedCombo = world.shield >= 100;
          if (protectedCombo) world.shield = 0;
          else world.combo = 0;

          if (world.rescueBand !== currentBand) {
            world.rescueBand = currentBand;
            player.x = nearest ? nearest.x + nearest.width / 2 : WIDTH / 2;
            player.y = world.cameraY + 18;
            player.vy = 760;
            player.vx *= 0.35;
            world.glide = 100;
            world.toast = {
              text: protectedCombo
                ? "护盾守住连击 · 气流托举"
                : "暖风接住了你 · 再试一次",
              until: timestamp + 1650,
            };
            addBurst(world, player.x, player.y, "#d7f2de", 34);
          } else {
            player.vx = 0;
            player.vy = 0;
            endGame();
          }
          syncHud();
        }

        for (const particle of world.particles) {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          particle.vy -= 120 * delta;
          particle.life -= delta;
        }
        world.particles = world.particles.filter((particle) => particle.life > 0);

        if (timestamp - world.lastHudSync > 80) {
          world.lastHudSync = timestamp;
          syncHud();
        }

        const currentBest = BigInt(saveRef.current.best || "0");
        if (world.score > currentBest || world.dustRun > dustRun) {
          const next = {
            ...saveRef.current,
            best:
              world.score > currentBest
                ? world.score.toString()
                : saveRef.current.best,
            dust: saveRef.current.dust + Math.max(0, world.dustRun - dustRun),
          };
          saveRef.current = next;
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          if (world.dustRun !== dustRun) {
            setSave(next);
          }
        }
      }

      drawBackground(context, world, timestamp, saveRef.current.theme);
      for (const platform of world.platforms) {
        const screenY = HEIGHT - (platform.y - world.cameraY);
        if (screenY > -70 && screenY < HEIGHT + 60) {
          drawPlatform(
            context,
            platform,
            screenY,
            timestamp,
            saveRef.current.theme,
          );
        }
      }

      for (const particle of world.particles) {
        const screenY = HEIGHT - (particle.y - world.cameraY);
        context.save();
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.shadowBlur = 8;
        context.shadowColor = particle.color;
        context.beginPath();
        context.arc(particle.x, screenY, particle.size, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      const playerScreenY = HEIGHT - (world.player.y - world.cameraY);
      const isGliding =
        inputRef.current.glide && world.player.vy < 0 && world.glide > 0;
      if (world.player.x < 34) {
        drawSquirrel(
          context,
          world.player.x + WIDTH,
          playerScreenY,
          world,
          isGliding,
          saveRef.current.companion,
          0.28,
        );
      } else if (world.player.x > WIDTH - 34) {
        drawSquirrel(
          context,
          world.player.x - WIDTH,
          playerScreenY,
          world,
          isGliding,
          saveRef.current.companion,
          0.28,
        );
      }
      drawSquirrel(
        context,
        world.player.x,
        playerScreenY,
        world,
        isGliding,
        saveRef.current.companion,
      );

      frameRef.current = window.requestAnimationFrame(update);
    };

    frameRef.current = window.requestAnimationFrame(update);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [chime, dustRun, endGame, syncHud]);

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const now = performance.now();
    const world = worldRef.current;
    if (now - world.lastTapAt < 300) {
      activateRocket();
      world.lastTapAt = 0;
    } else {
      world.lastTapAt = now;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    inputRef.current.pointerX =
      ((event.clientX - rect.left) / rect.width) * WIDTH;
    inputRef.current.glide = true;
    world.bufferedUntil = now + 140;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (phaseRef.current === "ready") start();
  };

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!inputRef.current.glide) return;
    const rect = event.currentTarget.getBoundingClientRect();
    inputRef.current.pointerX =
      ((event.clientX - rect.left) / rect.width) * WIDTH;
  };

  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    inputRef.current.glide = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const unlockTheme = (theme: ThemeName) => {
    const metadata = THEME_META[theme];
    if (save.unlockedThemes.includes(theme)) {
      persistSave({ ...save, theme });
      return;
    }
    if (save.dust < metadata.cost) return;
    persistSave({
      ...save,
      dust: save.dust - metadata.cost,
      theme,
      unlockedThemes: [...save.unlockedThemes, theme],
    });
  };

  const unlockCompanion = (companion: Companion) => {
    const metadata = COMPANION_META[companion];
    if (save.unlockedCompanions.includes(companion)) {
      persistSave({ ...save, companion });
      return;
    }
    if (save.dust < metadata.cost) return;
    persistSave({
      ...save,
      dust: save.dust - metadata.cost,
      companion,
      unlockedCompanions: [...save.unlockedCompanions, companion],
    });
  };

  return (
    <main className="twilight-shell">
      <header className="game-nav twilight-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="twilight-nav-actions">
          <button onClick={() => setShowCollection(true)}>
            ✦ 星尘藏品 <strong>{save.dust}</strong>
          </button>
          <button
            onClick={togglePause}
            disabled={phase === "ready" || phase === "over"}
          >
            {phase === "paused" ? "继续" : "暂停"}
          </button>
        </div>
      </header>

      <section className="twilight-layout">
        <div className="twilight-copy">
          <p className="twilight-kicker">TWILIGHT CANOPY · 暮色林冠</p>
          <h1>暮色拾星</h1>
          <p className="twilight-intro">
            踏亮林冠间的纸灯笼，让每一次落点都成为旋律。
            失手不是终点——张开翼膜，风会给你第二次机会。
          </p>

          <dl className="twilight-stats">
            <div>
              <dt>最高星分</dt>
              <dd>{formatScore(BigInt(save.best || "0"))}</dd>
            </div>
            <div>
              <dt>本程星尘</dt>
              <dd>+{dustRun}</dd>
            </div>
          </dl>

          <div className="twilight-guide">
            <span>
              <kbd>←</kbd><kbd>→</kbd> 左右移动
            </span>
            <span>
              <kbd>Space</kbd> 下落时长按滑翔
            </span>
            <span>铃廊充能后：双击画面启动火箭</span>
            <span>触屏：按住并左右拖动</span>
            <span>手机：可开启全屏与重力感应</span>
          </div>
        </div>

        <div
          className={`twilight-game-column ${
            isPseudoFullscreen ? "is-pseudo-fullscreen" : ""
          }`}
          ref={gameColumnRef}
        >
          <div className="twilight-hud">
            <div className="twilight-score">
              <span>星分</span>
              <strong>{score}</strong>
            </div>
            <div>
              <span>高度</span>
              <strong>{height} m</strong>
            </div>
            <div>
              <span>旋律</span>
              <strong>×{combo}</strong>
            </div>
          </div>

          <div className="twilight-frame">
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              aria-label="暮色拾星游戏区域。使用左右方向键移动，下落时按住空格滑翔；触屏可按住并左右拖动。"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
            />

            <div className="twilight-stage-chip" aria-live="polite">
              <span>{DIFFICULTY_STAGES[difficultyStage].label}</span>
              <strong>{runTime}</strong>
            </div>

            <div className="twilight-meters" aria-label="能力状态">
              <div>
                <span>翼风</span>
                <i><b style={{ width: `${glide}%` }} /></i>
              </div>
              <div>
                <span>星盾</span>
                <i className="shield-meter">
                  <b style={{ width: `${shield}%` }} />
                </i>
              </div>
              <div>
                <span>火箭</span>
                <i className="rocket-meter">
                  <b style={{ width: `${rocket}%` }} />
                </i>
              </div>
            </div>

            {toast && <div className="twilight-toast">{toast}</div>}

            {phase !== "playing" && (
              <div className="twilight-overlay">
                <span className="overlay-star" aria-hidden="true">✦</span>
                <p>
                  {phase === "ready"
                    ? "风正经过林梢"
                    : phase === "over"
                      ? "星光落回了树冠"
                      : "暮色在这里等你"}
                </p>
                <button
                  onClick={
                    phase === "ready"
                      ? start
                      : phase === "over"
                        ? resetJourney
                        : togglePause
                  }
                >
                  {phase === "ready"
                    ? "踏上第一片叶子"
                    : phase === "over"
                      ? "重新踏上旅程"
                      : "继续拾星"}
                </button>
                {phase === "ready" && (
                  <small>自动弹跳 · 只需掌握方向与滑翔</small>
                )}
                {phase === "over" && (
                  <small>
                    本程 {runTime} · 星分 {score} · 高度 {height} m
                  </small>
                )}
              </div>
            )}
          </div>

          <div className="twilight-mobile-controls" aria-label="触屏方向按钮">
            <button
              onPointerDown={() => {
                inputRef.current.left = true;
              }}
              onPointerUp={() => {
                inputRef.current.left = false;
              }}
              onPointerCancel={() => {
                inputRef.current.left = false;
              }}
            >
              ← 向左
            </button>
            <button
              className="glide-button"
              onPointerDown={() => {
                inputRef.current.glide = true;
              }}
              onPointerUp={() => {
                inputRef.current.glide = false;
              }}
              onPointerCancel={() => {
                inputRef.current.glide = false;
              }}
            >
              长按滑翔
            </button>
            <button
              onPointerDown={() => {
                inputRef.current.right = true;
              }}
              onPointerUp={() => {
                inputRef.current.right = false;
              }}
              onPointerCancel={() => {
                inputRef.current.right = false;
              }}
            >
              向右 →
            </button>
          </div>

          <div className="twilight-mobile-features">
            <button onClick={toggleFullscreen}>
              {isFullscreen || isPseudoFullscreen ? "退出全屏" : "⛶ 全屏游玩"}
            </button>
            <button
              onClick={toggleMotion}
              aria-pressed={motionEnabled}
              className={motionEnabled ? "is-active" : ""}
            >
              {motionEnabled ? "◉ 重力操控中" : "◌ 开启重力操控"}
            </button>
          </div>
        </div>
      </section>

      {showCollection && (
        <div className="twilight-modal-backdrop" role="presentation">
          <section
            className="twilight-collection"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-title"
          >
            <button
              className="twilight-modal-close"
              onClick={() => setShowCollection(false)}
              aria-label="关闭星尘藏品"
            >
              ×
            </button>
            <p className="twilight-kicker">每一次旅程都有收获</p>
            <h2 id="collection-title">星尘藏品</h2>
            <p className="collection-balance">
              可用星尘 <strong>✦ {save.dust}</strong>
            </p>

            <h3>林冠色彩</h3>
            <div className="collection-grid">
              {(Object.keys(THEME_META) as ThemeName[]).map((theme) => {
                const metadata = THEME_META[theme];
                const unlocked = save.unlockedThemes.includes(theme);
                return (
                  <button
                    key={theme}
                    className={save.theme === theme ? "is-selected" : ""}
                    onClick={() => unlockTheme(theme)}
                    disabled={!unlocked && save.dust < metadata.cost}
                  >
                    <i style={{ background: metadata.swatch }} />
                    <span>{metadata.label}</span>
                    <small>
                      {save.theme === theme
                        ? "使用中"
                        : unlocked
                          ? "选择"
                          : `✦ ${metadata.cost}`}
                    </small>
                  </button>
                );
              })}
            </div>

            <h3>同行伙伴</h3>
            <div className="collection-grid">
              {(Object.keys(COMPANION_META) as Companion[]).map((companion) => {
                const metadata = COMPANION_META[companion];
                const unlocked = save.unlockedCompanions.includes(companion);
                return (
                  <button
                    key={companion}
                    className={
                      save.companion === companion ? "is-selected" : ""
                    }
                    onClick={() => unlockCompanion(companion)}
                    disabled={!unlocked && save.dust < metadata.cost}
                  >
                    <i style={{ background: metadata.color }} />
                    <span>{metadata.label}</span>
                    <small>
                      {save.companion === companion
                        ? "同行中"
                        : unlocked
                          ? "选择"
                          : `✦ ${metadata.cost}`}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="collection-note">
              星尘会在拾取时自动存入当前设备，坠落也不会失去。
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

import type { EnemyKind, Settings, WeaponId } from "./types";

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;
export const WORLD_WIDTH = 4080;
export const GROUND_Y = 238;
export const SETTINGS_KEY = "iron-recoil-settings-v1";

export const PLAYER = {
  maxHp: 5,
  acceleration: 900,
  airAcceleration: 620,
  deceleration: 1200,
  maxSpeed: 138,
  jumpSpeed: 305,
  gravity: 820,
  coyoteMs: 105,
  jumpBufferMs: 120,
  invulnerabilityMs: 1_000,
  bodyWidth: 14,
  bodyHeight: 27,
} as const;

export const WEAPONS: Record<
  WeaponId,
  {
    label: string;
    cooldownMs: number;
    damage: number;
    speed: number;
    pellets: number;
    spread: number;
  }
> = {
  pulse: {
    label: "PULSE RIFLE",
    cooldownMs: 210,
    damage: 1,
    speed: 470,
    pellets: 1,
    spread: 0,
  },
  scatter: {
    label: "ARC SCATTER",
    cooldownMs: 470,
    damage: 1,
    speed: 410,
    pellets: 5,
    spread: 0.24,
  },
  heavy: {
    label: "RIVET STORM",
    cooldownMs: 92,
    damage: 1,
    speed: 520,
    pellets: 1,
    spread: 0.035,
  },
};

export const ENEMIES: Record<
  EnemyKind,
  {
    hp: number;
    detection: number;
    attackRange: number;
    cooldownMs: number;
    speed: number;
    damage: number;
  }
> = {
  patrol: {
    hp: 3,
    detection: 190,
    attackRange: 155,
    cooldownMs: 1_250,
    speed: 34,
    damage: 1,
  },
  crawler: {
    hp: 2,
    detection: 220,
    attackRange: 34,
    cooldownMs: 1_100,
    speed: 54,
    damage: 1,
  },
  turret: {
    hp: 5,
    detection: 250,
    attackRange: 240,
    cooldownMs: 1_650,
    speed: 0,
    damage: 2,
  },
  drone: {
    hp: 3,
    detection: 210,
    attackRange: 170,
    cooldownMs: 1_400,
    speed: 42,
    damage: 1,
  },
};

export const BOSS = {
  maxHp: 72,
  phase2At: 0.66,
  phase3At: 0.33,
  arenaStart: 3440,
  x: 3850,
  attackCooldownMs: 1_350,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  volume: 0.55,
  screenShake: true,
  reducedMotion: false,
  debug: false,
};

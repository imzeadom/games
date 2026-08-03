export type GamePhase = "title" | "playing" | "paused" | "failed" | "victory";

export type WeaponId = "pulse" | "scatter" | "heavy";
export type EnemyKind = "patrol" | "crawler" | "turret" | "drone";
export type EnemyState =
  "idle" | "patrol" | "alert" | "attack" | "hurt" | "dead";

export type Settings = {
  muted: boolean;
  volume: number;
  screenShake: boolean;
  reducedMotion: boolean;
  debug: boolean;
};

export type WeaponState = {
  current: WeaponId;
  scatterAmmo: number;
  heavyAmmo: number;
};

export type Combatant = {
  hp: number;
  maxHp: number;
  invulnerableUntil: number;
};

export type GameSnapshot = {
  phase: GamePhase;
  hp: number;
  maxHp: number;
  weapon: WeaponId;
  ammo: number | null;
  grenades: number;
  rescued: number;
  rescueTotal: number;
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  area: number;
  playerX: number;
  playerY: number;
  activeEnemies: number;
  playerBullets: number;
  enemyBullets: number;
  effects: number;
  fps: number;
  status: string;
};

export type IronRecoilTestApi = {
  getState: () => GameSnapshot;
  start: () => void;
  restart: () => void;
  setPlayerHealth: (hp: number) => void;
  goToArea: (area: number | "boss") => void;
  damageBoss: (amount: number) => void;
  rescueAll: () => void;
  entityCounts: () => {
    enemies: number;
    playerBullets: number;
    enemyBullets: number;
    effects: number;
  };
};

declare global {
  interface Window {
    __IRON_RECOIL_TEST_API__?: IronRecoilTestApi;
  }
}

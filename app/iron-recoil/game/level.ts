import type { EnemyKind, WeaponId } from "./types";

export type EnemySpawn = {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  patrolRadius: number;
  area: number;
};

export type PlatformData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PickupData = {
  id: string;
  kind: "weapon" | "health";
  x: number;
  y: number;
  weapon?: Exclude<WeaponId, "pulse">;
  amount: number;
};

export const LEVEL = {
  areas: [
    { index: 1, start: 0, end: 1120, label: "DRY DOCK" },
    { index: 2, start: 1120, end: 2240, label: "FOUNDRY LINE" },
    { index: 3, start: 2240, end: 3440, label: "ORE TRANSIT" },
    { index: 4, start: 3440, end: 4080, label: "DRILL YARD" },
  ],
  platforms: [
    { x: 420, y: 196, width: 160, height: 10 },
    { x: 810, y: 173, width: 120, height: 10 },
    { x: 1320, y: 194, width: 180, height: 10 },
    { x: 1710, y: 161, width: 130, height: 10 },
    { x: 2050, y: 202, width: 150, height: 10 },
    { x: 2460, y: 183, width: 180, height: 10 },
    { x: 2870, y: 154, width: 130, height: 10 },
    { x: 3160, y: 196, width: 160, height: 10 },
  ] satisfies PlatformData[],
  enemies: [
    { id: "p1", kind: "patrol", x: 570, y: 218, patrolRadius: 80, area: 1 },
    { id: "c1", kind: "crawler", x: 870, y: 221, patrolRadius: 0, area: 1 },
    { id: "t1", kind: "turret", x: 1010, y: 213, patrolRadius: 0, area: 1 },
    { id: "d1", kind: "drone", x: 1380, y: 116, patrolRadius: 90, area: 2 },
    { id: "p2", kind: "patrol", x: 1520, y: 218, patrolRadius: 95, area: 2 },
    { id: "c2", kind: "crawler", x: 1910, y: 221, patrolRadius: 0, area: 2 },
    { id: "t2", kind: "turret", x: 2130, y: 213, patrolRadius: 0, area: 2 },
    { id: "d2", kind: "drone", x: 2390, y: 102, patrolRadius: 110, area: 3 },
    { id: "p3", kind: "patrol", x: 2600, y: 218, patrolRadius: 100, area: 3 },
    { id: "c3", kind: "crawler", x: 2830, y: 221, patrolRadius: 0, area: 3 },
    { id: "t3", kind: "turret", x: 3080, y: 213, patrolRadius: 0, area: 3 },
    { id: "d3", kind: "drone", x: 3270, y: 112, patrolRadius: 75, area: 3 },
  ] satisfies EnemySpawn[],
  workers: [
    { id: "worker-a", x: 730, y: 217 },
    { id: "worker-b", x: 1780, y: 140 },
    { id: "worker-c", x: 2970, y: 133 },
  ],
  pickups: [
    {
      id: "scatter-pickup",
      kind: "weapon",
      x: 1060,
      y: 215,
      weapon: "scatter",
      amount: 24,
    },
    {
      id: "health-pickup",
      kind: "health",
      x: 2020,
      y: 215,
      amount: 2,
    },
    {
      id: "heavy-pickup",
      kind: "weapon",
      x: 2700,
      y: 215,
      weapon: "heavy",
      amount: 90,
    },
  ] satisfies PickupData[],
  crates: [
    { x: 930, y: 221, kind: "crate" },
    { x: 1870, y: 221, kind: "barrel" },
    { x: 2740, y: 221, kind: "crate" },
    { x: 3220, y: 221, kind: "barrel" },
  ],
} as const;

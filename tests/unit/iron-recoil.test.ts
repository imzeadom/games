import { describe, expect, it } from "vitest";
import { BOSS, DEFAULT_SETTINGS } from "../../app/iron-recoil/game/config";
import {
  addRescue,
  ammoFor,
  applyDamage,
  bossPhase,
  consumeShot,
  createWeaponState,
  equipWeapon,
  parseSettings,
  radialDamage,
} from "../../app/iron-recoil/game/model";

describe("Iron Recoil combat model", () => {
  it("applies damage once during the invulnerability window", () => {
    const target = { hp: 5, maxHp: 5, invulnerableUntil: 0 };
    expect(applyDamage(target, 2, 100, 1_000)).toBe(true);
    expect(target.hp).toBe(3);
    expect(applyDamage(target, 2, 500, 1_000)).toBe(false);
    expect(target.hp).toBe(3);
    expect(applyDamage(target, 2, 1_101, 1_000)).toBe(true);
    expect(target.hp).toBe(1);
  });

  it("clamps lethal damage at zero", () => {
    const target = { hp: 2, maxHp: 5, invulnerableUntil: 0 };
    applyDamage(target, 99, 1, 100);
    expect(target.hp).toBe(0);
  });

  it("consumes limited ammo and falls back to the pulse rifle", () => {
    let weapon = equipWeapon(createWeaponState(), "scatter", 2);
    expect(ammoFor(weapon)).toBe(2);
    weapon = consumeShot(weapon);
    expect(weapon.current).toBe("scatter");
    expect(ammoFor(weapon)).toBe(1);
    weapon = consumeShot(weapon);
    expect(weapon.current).toBe("pulse");
    expect(ammoFor(weapon)).toBeNull();
  });

  it("keeps pulse rifle ammunition infinite", () => {
    const weapon = createWeaponState();
    expect(consumeShot(weapon)).toEqual(weapon);
    expect(ammoFor(weapon)).toBeNull();
  });

  it("calculates radial damage with distance falloff", () => {
    expect(radialDamage(0, 100, 6)).toBe(6);
    expect(radialDamage(50, 100, 6)).toBe(3);
    expect(radialDamage(99, 100, 6)).toBe(1);
    expect(radialDamage(100, 100, 6)).toBe(0);
    expect(radialDamage(10, 0, 6)).toBe(0);
  });
});

describe("Iron Recoil mission state", () => {
  it("never counts the same rescued worker twice", () => {
    const first = addRescue(new Set<string>(), "worker-a");
    const duplicate = addRescue(first.ids, "worker-a");
    expect(first.changed).toBe(true);
    expect(duplicate.changed).toBe(false);
    expect(duplicate.ids.size).toBe(1);
  });

  it("maps boss health thresholds to three phases", () => {
    expect(bossPhase(BOSS.maxHp)).toBe(1);
    expect(bossPhase(Math.ceil(BOSS.maxHp * BOSS.phase2At))).toBe(1);
    expect(bossPhase(Math.floor(BOSS.maxHp * BOSS.phase2At))).toBe(2);
    expect(bossPhase(Math.floor(BOSS.maxHp * BOSS.phase3At))).toBe(3);
    expect(bossPhase(0)).toBe(3);
  });

  it("restores settings safely and clamps the stored volume", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{bad json")).toEqual(DEFAULT_SETTINGS);
    expect(
      parseSettings(
        JSON.stringify({
          muted: true,
          volume: 8,
          screenShake: false,
          reducedMotion: true,
          debug: true,
        }),
      ),
    ).toEqual({
      muted: true,
      volume: 1,
      screenShake: false,
      reducedMotion: true,
      debug: true,
    });
  });
});

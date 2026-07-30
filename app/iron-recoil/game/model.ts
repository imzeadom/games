import { BOSS, DEFAULT_SETTINGS, SETTINGS_KEY, WEAPONS } from "./config";
import type { Combatant, Settings, WeaponId, WeaponState } from "./types";

export function applyDamage(
  target: Combatant,
  damage: number,
  now: number,
  invulnerabilityMs: number,
): boolean {
  if (damage <= 0 || target.hp <= 0 || now < target.invulnerableUntil) {
    return false;
  }
  target.hp = Math.max(0, target.hp - damage);
  target.invulnerableUntil = now + invulnerabilityMs;
  return true;
}

export function createWeaponState(): WeaponState {
  return { current: "pulse", scatterAmmo: 0, heavyAmmo: 0 };
}

export function ammoFor(state: WeaponState): number | null {
  if (state.current === "pulse") return null;
  return state.current === "scatter" ? state.scatterAmmo : state.heavyAmmo;
}

export function equipWeapon(
  state: WeaponState,
  weapon: Exclude<WeaponId, "pulse">,
  ammo: number,
): WeaponState {
  return {
    ...state,
    current: weapon,
    scatterAmmo:
      weapon === "scatter" ? state.scatterAmmo + ammo : state.scatterAmmo,
    heavyAmmo: weapon === "heavy" ? state.heavyAmmo + ammo : state.heavyAmmo,
  };
}

export function consumeShot(state: WeaponState): WeaponState {
  const weapon = WEAPONS[state.current];
  if (state.current === "pulse") return state;

  const cost = weapon.pellets > 1 ? 1 : 1;
  const remaining =
    state.current === "scatter"
      ? Math.max(0, state.scatterAmmo - cost)
      : Math.max(0, state.heavyAmmo - cost);

  return {
    ...state,
    current: remaining === 0 ? "pulse" : state.current,
    scatterAmmo: state.current === "scatter" ? remaining : state.scatterAmmo,
    heavyAmmo: state.current === "heavy" ? remaining : state.heavyAmmo,
  };
}

export function radialDamage(
  distance: number,
  radius: number,
  maximumDamage: number,
): number {
  if (radius <= 0 || distance >= radius) return 0;
  const falloff = 1 - distance / radius;
  return Math.max(1, Math.ceil(maximumDamage * falloff));
}

export function addRescue(rescuedIds: ReadonlySet<string>, id: string) {
  if (rescuedIds.has(id)) {
    return { changed: false, ids: new Set(rescuedIds) };
  }
  const ids = new Set(rescuedIds);
  ids.add(id);
  return { changed: true, ids };
}

export function bossPhase(hp: number, maxHp: number = BOSS.maxHp): 1 | 2 | 3 {
  const ratio = Math.max(0, hp) / Math.max(1, maxHp);
  if (ratio <= BOSS.phase3At) return 3;
  if (ratio <= BOSS.phase2At) return 2;
  return 1;
}

export function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
    const partial = value as Partial<Settings>;
    return {
      muted:
        typeof partial.muted === "boolean"
          ? partial.muted
          : DEFAULT_SETTINGS.muted,
      volume:
        typeof partial.volume === "number"
          ? Math.min(1, Math.max(0, partial.volume))
          : DEFAULT_SETTINGS.volume,
      screenShake:
        typeof partial.screenShake === "boolean"
          ? partial.screenShake
          : DEFAULT_SETTINGS.screenShake,
      reducedMotion:
        typeof partial.reducedMotion === "boolean"
          ? partial.reducedMotion
          : DEFAULT_SETTINGS.reducedMotion,
      debug:
        typeof partial.debug === "boolean"
          ? partial.debug
          : DEFAULT_SETTINGS.debug,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  return parseSettings(window.localStorage.getItem(SETTINGS_KEY));
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

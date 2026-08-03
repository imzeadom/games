"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PwaMenuActions } from "../pwa-register";
import { WEAPONS } from "./game/config";
import { loadSettings, saveSettings } from "./game/model";
import type { GameSnapshot, Settings } from "./game/types";

const INITIAL_SNAPSHOT: GameSnapshot = {
  phase: "title",
  hp: 5,
  maxHp: 5,
  weapon: "pulse",
  ammo: null,
  grenades: 3,
  rescued: 0,
  rescueTotal: 3,
  bossActive: false,
  bossHp: 72,
  bossMaxHp: 72,
  bossPhase: 1,
  area: 1,
  playerX: 74,
  playerY: 210,
  activeEnemies: 12,
  playerBullets: 0,
  enemyBullets: 0,
  effects: 0,
  fps: 60,
  status: "Awaiting deployment",
};

type Runtime = typeof import("./game/bootstrap");

export default function IronRecoilPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ReturnType<Runtime["createIronRecoil"]> | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    let cancelled = false;
    let removeWindowKeys = () => {};

    void import("./game/bootstrap").then(({ createIronRecoil }) => {
      if (cancelled || !mountRef.current) return;
      const runtime = createIronRecoil(mountRef.current, loaded);
      runtimeRef.current = runtime;
      runtime.game.events.on("iron:snapshot", setSnapshot);
      runtime.game.events.on("iron:notice", (message: string) => {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 1_650);
      });
      runtime.game.events.on("iron:restarted", () => {
        setSnapshot(INITIAL_SNAPSHOT);
        setSettingsOpen(false);
      });
      const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.code !== "Escape" || event.repeat) return;
        event.preventDefault();
        runtime.scene.togglePause();
      };
      window.addEventListener("keydown", onWindowKeyDown);
      removeWindowKeys = () =>
        window.removeEventListener("keydown", onWindowKeyDown);
      setReady(true);
    });

    return () => {
      cancelled = true;
      removeWindowKeys();
      delete window.__IRON_RECOIL_TEST_API__;
      runtimeRef.current?.game.destroy(true);
      runtimeRef.current = null;
    };
  }, []);

  const updateSettings = useCallback((update: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...update };
      saveSettings(next);
      runtimeRef.current?.scene.updateSettings(next);
      return next;
    });
  }, []);

  const start = () => runtimeRef.current?.scene.startMission();
  const restart = () => runtimeRef.current?.scene.restartMission();
  const togglePause = () => runtimeRef.current?.scene.togglePause();
  const weaponLabel = WEAPONS[snapshot.weapon].label;
  const elapsed =
    snapshot.phase === "victory"
      ? "Industrial port secured"
      : "Independent rescue operation";

  return (
    <main className="iron-page">
      <header className="iron-header">
        <Link href="/" className="iron-brand" aria-label="返回纸上游戏厅">
          <span aria-hidden="true">IR</span>
          <div>
            <strong>IRON RECOIL</strong>
            <small>PORT RESCUE // 01</small>
          </div>
        </Link>
        <div className="iron-header-actions">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
          >
            SETTINGS
          </button>
          <PwaMenuActions />
        </div>
      </header>

      <section className="iron-game-shell" aria-label="Iron Recoil 游戏">
        <div
          className="iron-canvas-mount"
          ref={mountRef}
          data-testid="game-canvas"
          aria-label="2D 横版跑枪游戏画面"
        />

        {!ready && (
          <div className="iron-loading" role="status">
            <span />
            LOADING RESCUE CHANNEL…
          </div>
        )}

        {snapshot.phase !== "title" && (
          <div className="iron-hud" data-testid="hud">
            <div className="hud-cluster hud-health" aria-label="玩家生命">
              <small>ARMOR</small>
              <div>
                {Array.from({ length: snapshot.maxHp }, (_, index) => (
                  <i
                    className={index < snapshot.hp ? "active" : ""}
                    key={index}
                  />
                ))}
              </div>
            </div>
            <div className="hud-cluster">
              <small>WEAPON</small>
              <strong data-testid="weapon">
                {weaponLabel}
                <b>{snapshot.ammo === null ? "∞" : snapshot.ammo}</b>
              </strong>
            </div>
            <div className="hud-cluster">
              <small>CHARGES</small>
              <strong>{snapshot.grenades}</strong>
            </div>
            <div className="hud-cluster rescued">
              <small>RESCUED</small>
              <strong data-testid="rescued">
                {snapshot.rescued} / {snapshot.rescueTotal}
              </strong>
            </div>
          </div>
        )}

        {snapshot.bossActive && (
          <div className="boss-hud" data-testid="boss-health">
            <div>
              <small>MOBILE DRILLER // PHASE {snapshot.bossPhase}</small>
              <span>
                {snapshot.bossHp} / {snapshot.bossMaxHp}
              </span>
            </div>
            <i>
              <b
                style={{
                  width: `${(snapshot.bossHp / snapshot.bossMaxHp) * 100}%`,
                }}
              />
            </i>
          </div>
        )}

        {notice && (
          <div className="iron-notice" role="status">
            {notice}
          </div>
        )}

        {settings.debug && snapshot.phase !== "title" && (
          <pre className="iron-debug" data-testid="debug-overlay">
            FPS {snapshot.fps}
            {"\n"}ENEMIES {snapshot.activeEnemies}
            {"\n"}P-BULLETS {snapshot.playerBullets}
            {"\n"}E-BULLETS {snapshot.enemyBullets}
            {"\n"}EFFECTS {snapshot.effects}
            {"\n"}SCENE IronRecoilScene
            {"\n"}PLAYER {snapshot.playerX},{snapshot.playerY}
          </pre>
        )}

        {snapshot.phase === "title" && ready && (
          <section
            className="iron-overlay iron-title"
            data-testid="title-screen"
          >
            <p>AN ORIGINAL SIDE-SCROLLING RESCUE OPERATION</p>
            <h1>
              IRON
              <br />
              <span>RECOIL</span>
            </h1>
            <div className="iron-brief">
              <span>01</span>
              <p>
                The machine legion sealed Ash Harbor. Rescue three workers,
                recover field weapons, and destroy the rogue mobile driller.
              </p>
            </div>
            <button
              className="iron-primary"
              type="button"
              onClick={start}
              data-testid="start-button"
            >
              <span>ENTER / CLICK TO START</span>
              <b>DEPLOY →</b>
            </button>
            <div className="iron-controls">
              <span>
                <b>A D / ← →</b> MOVE
              </span>
              <span>
                <b>SPACE</b> JUMP
              </span>
              <span>
                <b>J</b> FIRE
              </span>
              <span>
                <b>K</b> CHARGE
              </span>
              <span>
                <b>W / S</b> AIM / CROUCH
              </span>
              <span>
                <b>E</b> RESCUE
              </span>
            </div>
          </section>
        )}

        {snapshot.phase === "paused" && (
          <section
            className="iron-overlay iron-dialog"
            data-testid="pause-menu"
          >
            <p>OPERATION HALTED</p>
            <h2>PAUSED</h2>
            <button
              className="iron-primary"
              type="button"
              onClick={togglePause}
            >
              RESUME
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)}>
              SETTINGS
            </button>
            <button type="button" onClick={restart}>
              ABORT & RESTART
            </button>
          </section>
        )}

        {snapshot.phase === "failed" && (
          <section
            className="iron-overlay iron-dialog result-failed"
            data-testid="failure-screen"
          >
            <p>RESCUE SIGNAL LOST</p>
            <h2>MISSION FAILED</h2>
            <span>
              Workers rescued: {snapshot.rescued} / {snapshot.rescueTotal}
            </span>
            <button
              className="iron-primary"
              type="button"
              onClick={restart}
              data-testid="restart-button"
            >
              RESTART OPERATION
            </button>
          </section>
        )}

        {snapshot.phase === "victory" && (
          <section
            className="iron-overlay iron-dialog result-victory"
            data-testid="victory-screen"
          >
            <p>PORT CONTROL RESTORED</p>
            <h2>MISSION COMPLETE</h2>
            <span>{elapsed}</span>
            <dl>
              <div>
                <dt>Workers rescued</dt>
                <dd>
                  {snapshot.rescued} / {snapshot.rescueTotal}
                </dd>
              </div>
              <div>
                <dt>Driller status</dt>
                <dd>DESTROYED</dd>
              </div>
            </dl>
            <button
              className="iron-primary"
              type="button"
              onClick={restart}
              data-testid="victory-restart"
            >
              PLAY AGAIN
            </button>
          </section>
        )}

        {settingsOpen && (
          <section
            className="iron-settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="iron-settings-title"
          >
            <div>
              <p>FIELD CONFIGURATION</p>
              <h2 id="iron-settings-title">SETTINGS</h2>
            </div>
            <label>
              <span>VOLUME</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(event) =>
                  updateSettings({ volume: Number(event.target.value) })
                }
                disabled={settings.muted}
              />
            </label>
            <label className="toggle-row">
              <span>MUTE</span>
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={(event) =>
                  updateSettings({ muted: event.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>SCREEN SHAKE</span>
              <input
                type="checkbox"
                checked={settings.screenShake}
                onChange={(event) =>
                  updateSettings({ screenShake: event.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>REDUCED MOTION</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) =>
                  updateSettings({ reducedMotion: event.target.checked })
                }
              />
            </label>
            <label className="toggle-row">
              <span>DEBUG OVERLAY</span>
              <input
                type="checkbox"
                checked={settings.debug}
                onChange={(event) =>
                  updateSettings({ debug: event.target.checked })
                }
              />
            </label>
            <button
              className="iron-primary"
              type="button"
              onClick={() => setSettingsOpen(false)}
            >
              APPLY & CLOSE
            </button>
          </section>
        )}
      </section>

      <footer className="iron-footer">
        <span>ORIGINAL PROCEDURAL ART & SYNTH AUDIO · NO DATA COLLECTION</span>
        <span>ESC PAUSE · DESKTOP KEYBOARD RECOMMENDED</span>
      </footer>
    </main>
  );
}

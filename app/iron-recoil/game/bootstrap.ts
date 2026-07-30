import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config";
import { IronRecoilScene } from "./scene";
import type { IronRecoilTestApi, Settings } from "./types";

export function createIronRecoil(
  parent: HTMLElement,
  settings: Settings,
): { game: Phaser.Game; scene: IronRecoilScene } {
  const scene = new IronRecoilScene(settings);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#101922",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fixedStep: true,
        fps: 60,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene,
    banner: false,
  });

  if (process.env.NODE_ENV !== "production") {
    const api: IronRecoilTestApi = {
      getState: () => scene.getSnapshot(),
      start: () => scene.startMission(),
      restart: () => scene.restartMission(),
      setPlayerHealth: (hp) => scene.setPlayerHealth(hp),
      goToArea: (area) => scene.goToArea(area),
      damageBoss: (amount) => scene.damageBoss(amount),
      rescueAll: () => scene.rescueAll(),
      entityCounts: () => scene.getEntityCounts(),
    };
    window.__IRON_RECOIL_TEST_API__ = api;
  }

  return { game, scene };
}

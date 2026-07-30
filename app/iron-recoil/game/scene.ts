import Phaser from "phaser";
import { SynthAudio } from "./audio";
import {
  BOSS,
  ENEMIES,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  PLAYER,
  WEAPONS,
  WORLD_WIDTH,
} from "./config";
import { LEVEL } from "./level";
import {
  addRescue,
  ammoFor,
  applyDamage,
  bossPhase,
  consumeShot,
  createWeaponState,
  equipWeapon,
  radialDamage,
} from "./model";
import type {
  Combatant,
  EnemyKind,
  EnemyState,
  GamePhase,
  GameSnapshot,
  Settings,
  WeaponState,
} from "./types";

type ControlKeys = {
  left: Phaser.Input.Keyboard.Key;
  leftAlt: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  rightAlt: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  fire: Phaser.Input.Keyboard.Key;
  grenade: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  confirm: Phaser.Input.Keyboard.Key;
};

type EnemyRuntime = {
  id: string;
  kind: EnemyKind;
  sprite: Phaser.Physics.Arcade.Sprite;
  combat: Combatant;
  state: EnemyState;
  homeX: number;
  patrolRadius: number;
  direction: -1 | 1;
  nextAttackAt: number;
  area: number;
};

type WorkerRuntime = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  rescued: boolean;
};

type PickupRuntime = {
  id: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: "weapon" | "health";
  amount: number;
  weapon?: "scatter" | "heavy";
};

type BreakableRuntime = {
  sprite: Phaser.Physics.Arcade.Sprite;
  kind: "crate" | "barrel";
  hp: number;
};

const EMPTY_SNAPSHOT: GameSnapshot = {
  phase: "title",
  hp: PLAYER.maxHp,
  maxHp: PLAYER.maxHp,
  weapon: "pulse",
  ammo: null,
  grenades: 3,
  rescued: 0,
  rescueTotal: 3,
  bossActive: false,
  bossHp: BOSS.maxHp,
  bossMaxHp: BOSS.maxHp,
  bossPhase: 1,
  area: 1,
  playerX: 0,
  playerY: 0,
  activeEnemies: 0,
  playerBullets: 0,
  enemyBullets: 0,
  effects: 0,
  fps: 0,
  status: "Awaiting deployment",
};

export class IronRecoilScene extends Phaser.Scene {
  private phase: GamePhase = "title";
  private settings: Settings;
  private audio: SynthAudio;
  private player!: Phaser.Physics.Arcade.Sprite;
  private controls!: ControlKeys;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies: EnemyRuntime[] = [];
  private workers: WorkerRuntime[] = [];
  private pickups: PickupRuntime[] = [];
  private breakables: BreakableRuntime[] = [];
  private rescuedIds = new Set<string>();
  private weapon: WeaponState = createWeaponState();
  private playerCombat: Combatant = {
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    invulnerableUntil: 0,
  };
  private grenades = 3;
  private facing: -1 | 1 = 1;
  private lastGroundedAt = 0;
  private jumpBufferedAt = Number.NEGATIVE_INFINITY;
  private nextShotAt = 0;
  private currentArea = 1;
  private boss: Phaser.Physics.Arcade.Sprite | null = null;
  private bossCombat: Combatant = {
    hp: BOSS.maxHp,
    maxHp: BOSS.maxHp,
    invulnerableUntil: 0,
  };
  private bossActive = false;
  private bossDefeated = false;
  private bossNextAttackAt = 0;
  private bossMode = 1;
  private effects = 0;
  private snapshot: GameSnapshot = { ...EMPTY_SNAPSHOT };
  private nextSnapshotAt = 0;
  private elapsedStart = 0;
  private checkpointX = 74;
  private pendingRestart = false;
  private grenadeQueued = false;
  private interactQueued = false;

  constructor(settings: Settings) {
    super("IronRecoilScene");
    this.settings = settings;
    this.audio = new SynthAudio(settings);
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor("#101922");
    this.createTextures();
    this.createBackdrop();
    this.createLevel();
    this.createPlayer();
    this.createPools();
    this.createControls();
    this.createCollisions();
    this.cameras.main.startFollow(this.player, true, 0.085, 0.12);
    this.player.setVisible(false);
    this.physics.pause();
    this.emitSnapshot(true);
    if (this.pendingRestart) {
      this.pendingRestart = false;
      this.game.events.emit("iron:restarted");
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.game.events.removeAllListeners("iron:settings");
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.audio.destroy());
    this.game.events.on("iron:settings", (settings: Settings) => {
      this.settings = settings;
      this.audio.updateSettings(settings);
    });
  }

  private createTextures(): void {
    const make = (
      key: string,
      width: number,
      height: number,
      draw: (graphics: Phaser.GameObjects.Graphics) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const graphics = this.add.graphics();
      draw(graphics);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    };

    make("ir-player", 20, 32, (g) => {
      g.fillStyle(0xf5c84b).fillRect(4, 2, 12, 8);
      g.fillStyle(0x1d3038).fillRect(2, 10, 16, 15);
      g.fillStyle(0xf06b4f).fillRect(0, 13, 7, 4);
      g.fillStyle(0xd7e1c5).fillRect(12, 12, 8, 5);
      g.fillStyle(0x70959a).fillRect(4, 25, 5, 7).fillRect(12, 25, 5, 7);
    });
    make("ir-patrol", 24, 24, (g) => {
      g.fillStyle(0xa7c957).fillRect(3, 5, 18, 13);
      g.fillStyle(0x28323b).fillRect(6, 8, 4, 4).fillRect(14, 8, 4, 4);
      g.fillStyle(0xd45d45).fillRect(8, 2, 8, 4);
      g.fillStyle(0x59646a).fillRect(2, 18, 7, 5).fillRect(15, 18, 7, 5);
    });
    make("ir-crawler", 26, 15, (g) => {
      g.fillStyle(0xe09f3e).fillTriangle(3, 12, 13, 1, 23, 12);
      g.fillStyle(0x28323b).fillCircle(13, 8, 3);
      g.fillStyle(0x6c757d).fillRect(1, 12, 24, 3);
    });
    make("ir-turret", 24, 27, (g) => {
      g.fillStyle(0x6b7b83).fillRect(5, 11, 14, 16);
      g.fillStyle(0xd45d45).fillRect(3, 7, 15, 8);
      g.fillStyle(0xe9c46a).fillRect(16, 9, 8, 3);
    });
    make("ir-drone", 28, 15, (g) => {
      g.fillStyle(0x8ecae6).fillRect(5, 4, 18, 8);
      g.fillStyle(0x22333b).fillRect(0, 1, 10, 3).fillRect(18, 1, 10, 3);
      g.fillStyle(0xf05d5e).fillRect(12, 7, 4, 4);
    });
    make("ir-worker", 17, 28, (g) => {
      g.fillStyle(0xf4a261).fillRect(5, 1, 8, 7);
      g.fillStyle(0x48a9a6).fillRect(2, 8, 14, 13);
      g.fillStyle(0xf5d061).fillRect(3, 21, 4, 7).fillRect(10, 21, 4, 7);
    });
    make("ir-bullet", 8, 3, (g) => g.fillStyle(0xfff08a).fillRect(0, 0, 8, 3));
    make("ir-enemy-bullet", 7, 5, (g) =>
      g.fillStyle(0xff5d5d).fillRect(0, 0, 7, 5),
    );
    make("ir-grenade", 8, 8, (g) => {
      g.fillStyle(0x161f26).fillCircle(4, 4, 4);
      g.fillStyle(0xffb703).fillRect(5, 0, 2, 3);
    });
    make("ir-pickup", 18, 18, (g) => {
      g.fillStyle(0x1f2933).fillRect(1, 1, 16, 16);
      g.lineStyle(2, 0x63e6be).strokeRect(1, 1, 16, 16);
      g.fillStyle(0x63e6be).fillRect(5, 8, 8, 3);
    });
    make("ir-health", 18, 18, (g) => {
      g.fillStyle(0xf3f0e6).fillRect(1, 1, 16, 16);
      g.fillStyle(0xe63946).fillRect(7, 4, 4, 10).fillRect(4, 7, 10, 4);
    });
    make("ir-crate", 23, 23, (g) => {
      g.fillStyle(0x8a5a44).fillRect(0, 0, 23, 23);
      g.lineStyle(2, 0xd9a066).strokeRect(1, 1, 21, 21);
      g.lineBetween(2, 2, 21, 21).lineBetween(21, 2, 2, 21);
    });
    make("ir-barrel", 17, 25, (g) => {
      g.fillStyle(0xc14d3c).fillRect(1, 1, 15, 23);
      g.fillStyle(0xf2c14e).fillRect(1, 9, 15, 5);
      g.lineStyle(2, 0x4c2b24).strokeRect(1, 1, 15, 23);
    });
    make("ir-boss", 108, 70, (g) => {
      g.fillStyle(0x34464f).fillRect(14, 14, 76, 47);
      g.fillStyle(0x667a80).fillCircle(27, 58, 12).fillCircle(77, 58, 12);
      g.fillStyle(0xd8573c).fillRect(25, 7, 38, 15);
      g.fillStyle(0xf2c14e).fillRect(37, 11, 15, 6);
      g.fillStyle(0x899da4).fillTriangle(90, 19, 108, 35, 90, 51);
      g.fillStyle(0x202c33).fillRect(0, 25, 35, 8);
    });
  }

  private createBackdrop(): void {
    const graphics = this.add.graphics().setDepth(-20);
    graphics.fillStyle(0x101922).fillRect(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x192a33);
    for (let x = 0; x < WORLD_WIDTH; x += 190) {
      graphics.fillRect(x, 70 + (x % 3) * 10, 95, 168);
      graphics.fillRect(x + 36, 34, 22, 55);
    }
    graphics.fillStyle(0x25404a);
    for (let x = 80; x < WORLD_WIDTH; x += 340) {
      graphics.fillRect(x, 118, 160, 7);
      graphics.fillRect(x + 16, 92, 8, 146);
      graphics.fillRect(x + 130, 92, 8, 146);
    }
    graphics.lineStyle(2, 0x39545d, 0.7);
    for (let x = 0; x < WORLD_WIDTH; x += 48) {
      graphics.lineBetween(x, 205, x + 20, 180);
      graphics.lineBetween(x + 20, 180, x + 48, 205);
    }
    this.add
      .text(28, 20, "IRON RECOIL // INDUSTRIAL RESCUE RUN", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#67818a",
      })
      .setScrollFactor(0.12)
      .setDepth(-15);
  }

  private createLevel(): void {
    this.platforms = this.physics.add.staticGroup();
    const ground = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + 16,
      WORLD_WIDTH,
      32,
      0x28363d,
    );
    this.physics.add.existing(ground, true);
    this.platforms.add(ground);

    for (const platform of LEVEL.platforms) {
      const rectangle = this.add
        .rectangle(
          platform.x,
          platform.y,
          platform.width,
          platform.height,
          0x52646b,
        )
        .setStrokeStyle(2, 0xa8b6a0);
      this.physics.add.existing(rectangle, true);
      this.platforms.add(rectangle);
    }

    for (const area of LEVEL.areas) {
      this.add
        .text(area.start + 24, 52, `0${area.index} // ${area.label}`, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#7d959b",
        })
        .setDepth(-10);
      if (area.index > 1) {
        this.add.rectangle(area.start, 128, 2, 210, 0x425e66, 0.5);
      }
    }

    for (const worker of LEVEL.workers) {
      const sprite = this.physics.add
        .sprite(worker.x, worker.y, "ir-worker")
        .setImmovable(true);
      sprite.body.setAllowGravity(false);
      this.workers.push({ id: worker.id, sprite, rescued: false });
      this.add
        .text(worker.x - 13, worker.y - 26, "HELP", {
          fontFamily: "monospace",
          fontSize: "7px",
          color: "#ffe7a6",
          backgroundColor: "#3c2f2f",
          padding: { x: 2, y: 1 },
        })
        .setName(`label-${worker.id}`);
    }

    for (const data of LEVEL.pickups) {
      const sprite = this.physics.add
        .sprite(
          data.x,
          data.y,
          data.kind === "health" ? "ir-health" : "ir-pickup",
        )
        .setImmovable(true);
      sprite.body.setAllowGravity(false);
      this.pickups.push({
        id: data.id,
        sprite,
        kind: data.kind,
        amount: data.amount,
        ...(data.weapon ? { weapon: data.weapon } : {}),
      });
    }

    for (const data of LEVEL.crates) {
      const sprite = this.physics.add
        .sprite(
          data.x,
          data.y,
          data.kind === "barrel" ? "ir-barrel" : "ir-crate",
        )
        .setImmovable(true);
      this.breakables.push({ sprite, kind: data.kind, hp: 3 });
    }

    for (const data of LEVEL.enemies) this.spawnEnemy(data);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(74, 210, "ir-player");
    this.player
      .setCollideWorldBounds(true)
      .setMaxVelocity(PLAYER.maxSpeed, 420)
      .setDragX(PLAYER.deceleration);
    const body = this.bodyOf(this.player);
    body.setSize(PLAYER.bodyWidth, PLAYER.bodyHeight);
    body.setOffset(3, 5);
    body.setGravityY(PLAYER.gravity);
  }

  private createPools(): void {
    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 90,
      runChildUpdate: false,
    });
    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 70,
      runChildUpdate: false,
    });
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable");
    this.controls = keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      leftAlt: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      rightAlt: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      fire: Phaser.Input.Keyboard.KeyCodes.J,
      grenade: Phaser.Input.Keyboard.KeyCodes.K,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      confirm: Phaser.Input.Keyboard.KeyCodes.ENTER,
    }) as ControlKeys;
    this.controls.jump.on("down", () => {
      if (this.phase === "playing") this.jumpBufferedAt = this.time.now;
    });
    this.controls.fire.on("down", () => {
      if (this.phase === "playing" && this.time.now >= this.nextShotAt) {
        this.fireWeapon(this.time.now);
      }
    });
    this.controls.grenade.on("down", () => {
      if (this.phase === "playing") this.grenadeQueued = true;
    });
    this.controls.interact.on("down", () => {
      if (this.phase === "playing") this.interactQueued = true;
    });
    this.controls.confirm.on("down", () => {
      if (this.phase === "title") this.startMission();
      else if (this.phase === "failed" || this.phase === "victory") {
        this.restartMission();
      }
    });
  }

  private createCollisions(): void {
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(
      this.player,
      this.breakables.map((item) => item.sprite),
    );
    this.physics.add.collider(
      this.enemies.map((enemy) => enemy.sprite),
      this.platforms,
    );
    this.physics.add.overlap(
      this.player,
      this.enemyBullets,
      (_player, bullet) =>
        this.hitPlayerByBullet(bullet as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(
      this.player,
      this.enemies.map((enemy) => enemy.sprite),
      (_player, enemySprite) =>
        this.hitPlayerByEnemy(enemySprite as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(
      this.playerBullets,
      this.enemies.map((enemy) => enemy.sprite),
      (bullet, enemySprite) =>
        this.hitEnemy(
          bullet as Phaser.GameObjects.GameObject,
          enemySprite as Phaser.GameObjects.GameObject,
        ),
    );
    this.physics.add.overlap(
      this.playerBullets,
      this.breakables.map((item) => item.sprite),
      (bullet, breakable) =>
        this.hitBreakable(
          bullet as Phaser.GameObjects.GameObject,
          breakable as Phaser.GameObjects.GameObject,
        ),
    );
    this.physics.add.overlap(
      this.player,
      this.pickups.map((item) => item.sprite),
      (_player, pickup) =>
        this.collectPickup(pickup as Phaser.GameObjects.GameObject),
    );
  }

  private spawnEnemy(data: (typeof LEVEL.enemies)[number]): EnemyRuntime {
    const config = ENEMIES[data.kind];
    const sprite = this.physics.add.sprite(data.x, data.y, `ir-${data.kind}`);
    sprite.setCollideWorldBounds(true);
    this.bodyOf(sprite).setGravityY(data.kind === "drone" ? 0 : PLAYER.gravity);
    if (data.kind === "turret") sprite.setImmovable(true);
    const runtime: EnemyRuntime = {
      id: data.id,
      kind: data.kind,
      sprite,
      combat: { hp: config.hp, maxHp: config.hp, invulnerableUntil: 0 },
      state: "idle",
      homeX: data.x,
      patrolRadius: data.patrolRadius,
      direction: -1,
      nextAttackAt: 0,
      area: data.area,
    };
    sprite.setData("runtime", runtime);
    this.enemies.push(runtime);
    return runtime;
  }

  startMission(): void {
    if (this.phase === "playing") return;
    void this.audio.unlock();
    this.phase = "playing";
    this.player.setVisible(true);
    this.physics.resume();
    this.elapsedStart = this.time.now;
    this.emitSnapshot(true);
  }

  togglePause(): void {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.physics.pause();
    } else if (this.phase === "paused") {
      this.phase = "playing";
      this.physics.resume();
    } else {
      return;
    }
    this.emitSnapshot(true);
  }

  restartMission(): void {
    this.resetRuntime();
    this.pendingRestart = true;
    this.scene.restart();
  }

  private resetRuntime(): void {
    this.phase = "title";
    this.enemies = [];
    this.workers = [];
    this.pickups = [];
    this.breakables = [];
    this.rescuedIds = new Set<string>();
    this.weapon = createWeaponState();
    this.playerCombat = {
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      invulnerableUntil: 0,
    };
    this.grenades = 3;
    this.facing = 1;
    this.lastGroundedAt = 0;
    this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
    this.nextShotAt = 0;
    this.currentArea = 1;
    this.boss = null;
    this.bossCombat = {
      hp: BOSS.maxHp,
      maxHp: BOSS.maxHp,
      invulnerableUntil: 0,
    };
    this.bossActive = false;
    this.bossDefeated = false;
    this.bossNextAttackAt = 0;
    this.bossMode = 1;
    this.effects = 0;
    this.snapshot = { ...EMPTY_SNAPSHOT };
    this.checkpointX = 74;
    this.grenadeQueued = false;
    this.interactQueued = false;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.audio.updateSettings(settings);
  }

  update(time: number, delta: number): void {
    if (this.phase !== "playing") return;

    this.updatePlayer(time);
    this.updateBullets();
    this.updateEnemies(time, delta);
    this.updateBoss(time);
    this.updateArea();
    this.handleInteractions();
    this.emitSnapshot(time >= this.nextSnapshotAt);
  }

  private updatePlayer(time: number): void {
    const body = this.bodyOf(this.player);
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.lastGroundedAt = time;
    if (Phaser.Input.Keyboard.JustDown(this.controls.jump)) {
      this.jumpBufferedAt = time;
    }

    const left = this.controls.left.isDown || this.controls.leftAlt.isDown;
    const right = this.controls.right.isDown || this.controls.rightAlt.isDown;
    const acceleration = grounded
      ? PLAYER.acceleration
      : PLAYER.airAcceleration;
    if (left === true && right !== true) {
      this.player.setAccelerationX(-acceleration);
      this.facing = -1;
    } else if (right === true && left !== true) {
      this.player.setAccelerationX(acceleration);
      this.facing = 1;
    } else {
      this.player.setAccelerationX(0);
    }
    this.player.setFlipX(this.facing < 0);

    if (
      time - this.jumpBufferedAt <= PLAYER.jumpBufferMs &&
      time - this.lastGroundedAt <= PLAYER.coyoteMs
    ) {
      this.player.setVelocityY(-PLAYER.jumpSpeed);
      this.jumpBufferedAt = Number.NEGATIVE_INFINITY;
      this.lastGroundedAt = Number.NEGATIVE_INFINITY;
    }
    if (!this.controls.jump.isDown && body.velocity.y < -90) {
      this.player.setVelocityY(body.velocity.y * 0.9);
    }

    const crouching = this.controls.down.isDown && grounded;
    this.player.setScale(1, crouching ? 0.72 : 1);
    body.setSize(PLAYER.bodyWidth, crouching ? 20 : PLAYER.bodyHeight);

    if (this.controls.fire.isDown && time >= this.nextShotAt) {
      this.fireWeapon(time);
    }
    if (
      this.grenadeQueued ||
      Phaser.Input.Keyboard.JustDown(this.controls.grenade)
    ) {
      this.grenadeQueued = false;
      this.throwGrenade();
    }

    const velocityLead = Phaser.Math.Clamp(body.velocity.x * 0.24, -30, 30);
    this.cameras.main.setFollowOffset(-velocityLead, 0);
    if (time < this.playerCombat.invulnerableUntil) {
      this.player.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.35 : 1);
    } else {
      this.player.setAlpha(1);
    }
    if (this.player.y > GAME_HEIGHT + 20) this.damagePlayer(PLAYER.maxHp);
  }

  private fireWeapon(time: number): void {
    const current = this.weapon.current;
    const config = WEAPONS[current];
    this.nextShotAt = time + config.cooldownMs;
    const aimUp = this.controls.up.isDown;
    const originX = this.player.x + this.facing * 12;
    const originY = this.player.y + (aimUp ? -13 : -3);

    for (let index = 0; index < config.pellets; index += 1) {
      const bullet = this.playerBullets.get(
        originX,
        originY,
        "ir-bullet",
      ) as Phaser.Physics.Arcade.Sprite | null;
      if (!bullet) break;
      bullet
        .setActive(true)
        .setVisible(true)
        .setTint(current === "heavy" ? 0x8ff7ff : 0xffffff);
      this.bodyOf(bullet).setAllowGravity(false);
      const spread =
        config.pellets === 1
          ? Phaser.Math.FloatBetween(-config.spread, config.spread)
          : (index - (config.pellets - 1) / 2) * config.spread;
      const angle = aimUp ? -Math.PI / 2 + spread : spread;
      bullet.setData("damage", config.damage);
      bullet.setData("bornAt", time);
      bullet.setVelocity(
        Math.cos(angle) * config.speed * (aimUp ? 1 : this.facing),
        Math.sin(angle) * config.speed,
      );
    }
    this.weapon = consumeShot(this.weapon);
    this.audio.play(current === "scatter" ? "scatter" : "shoot");
    this.muzzleFlash(
      originX,
      originY,
      current === "heavy" ? 0x8ff7ff : 0xffe66d,
    );
    this.player.setVelocityX(
      this.bodyOf(this.player).velocity.x - this.facing * 9,
    );
  }

  private throwGrenade(): void {
    if (this.grenades <= 0) return;
    this.grenades -= 1;
    const grenade = this.physics.add.sprite(
      this.player.x + this.facing * 9,
      this.player.y - 8,
      "ir-grenade",
    );
    grenade.setVelocity(this.facing * 180, -230);
    this.bodyOf(grenade).setGravityY(PLAYER.gravity);
    this.physics.add.collider(grenade, this.platforms);
    this.time.delayedCall(750, () => {
      if (!grenade.active || this.phase !== "playing") return;
      this.explode(grenade.x, grenade.y, 76, 6);
      grenade.destroy();
    });
  }

  private updateBullets(): void {
    const deactivateOutside = (child: Phaser.GameObjects.GameObject) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite;
      if (
        bullet.x < this.cameras.main.worldView.x - 50 ||
        bullet.x > this.cameras.main.worldView.right + 50 ||
        bullet.y < -30 ||
        bullet.y > GAME_HEIGHT + 30
      ) {
        this.recycleBullet(bullet);
      }
    };
    for (const child of this.playerBullets.children) deactivateOutside(child);
    for (const child of this.enemyBullets.children) deactivateOutside(child);
  }

  private updateEnemies(time: number, delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.state === "dead") continue;
      const distance = Phaser.Math.Distance.Between(
        enemy.sprite.x,
        enemy.sprite.y,
        this.player.x,
        this.player.y,
      );
      if (distance > GAME_WIDTH + 160) {
        enemy.sprite.setVelocityX(0);
        enemy.state = "idle";
        continue;
      }
      const config = ENEMIES[enemy.kind];
      if (time < enemy.combat.invulnerableUntil) {
        enemy.sprite.setTint(0xffffff);
      } else {
        enemy.sprite.clearTint();
      }
      enemy.state = distance <= config.detection ? "alert" : "patrol";

      if (enemy.kind === "patrol") {
        if (distance <= config.attackRange) {
          enemy.sprite.setVelocityX(0);
          if (time >= enemy.nextAttackAt) this.enemyShoot(enemy, time);
        } else {
          if (
            enemy.sprite.x < enemy.homeX - enemy.patrolRadius ||
            enemy.sprite.x > enemy.homeX + enemy.patrolRadius
          ) {
            enemy.direction = enemy.sprite.x < enemy.homeX ? 1 : -1;
          }
          enemy.sprite.setVelocityX(enemy.direction * config.speed);
          enemy.sprite.setFlipX(enemy.direction < 0);
        }
      } else if (enemy.kind === "crawler") {
        const direction = this.player.x < enemy.sprite.x ? -1 : 1;
        enemy.sprite.setVelocityX(direction * config.speed);
        if (
          distance < 120 &&
          (this.bodyOf(enemy.sprite).blocked.down ||
            this.bodyOf(enemy.sprite).touching.down) &&
          time >= enemy.nextAttackAt
        ) {
          enemy.sprite.setVelocityY(-220);
          enemy.nextAttackAt = time + config.cooldownMs;
          enemy.state = "attack";
        }
      } else if (enemy.kind === "turret") {
        if (distance <= config.attackRange && time >= enemy.nextAttackAt) {
          this.enemyShoot(enemy, time);
        }
      } else {
        const wave = Math.sin((time + enemy.homeX) / 480) * 22;
        const patrolX =
          enemy.homeX +
          Math.sin((time + enemy.homeX) / 1_050) * enemy.patrolRadius;
        enemy.sprite.setVelocity(
          (patrolX - enemy.sprite.x) * 2.1,
          (enemy.sprite.y - (115 + wave)) * -1.8,
        );
        if (distance <= config.attackRange && time >= enemy.nextAttackAt) {
          this.enemyShoot(enemy, time, true);
        }
      }
      if (delta > 40) {
        enemy.sprite.setVelocityX(this.bodyOf(enemy.sprite).velocity.x * 0.8);
      }
    }
  }

  private enemyShoot(
    enemy: EnemyRuntime,
    time: number,
    downward = false,
  ): void {
    enemy.state = "attack";
    enemy.nextAttackAt = time + ENEMIES[enemy.kind].cooldownMs;
    enemy.sprite.setTint(0xffb36b);
    this.time.delayedCall(160, () => {
      if (
        !enemy.sprite.active ||
        enemy.state === "dead" ||
        this.phase !== "playing"
      ) {
        return;
      }
      const bullet = this.enemyBullets.get(
        enemy.sprite.x,
        enemy.sprite.y,
        "ir-enemy-bullet",
      ) as Phaser.Physics.Arcade.Sprite | null;
      if (!bullet) return;
      bullet.setActive(true).setVisible(true);
      this.bodyOf(bullet).setAllowGravity(false);
      bullet.setData("damage", ENEMIES[enemy.kind].damage);
      const angle = Phaser.Math.Angle.Between(
        enemy.sprite.x,
        enemy.sprite.y,
        this.player.x,
        downward ? this.player.y + 15 : this.player.y,
      );
      const speed = enemy.kind === "turret" ? 135 : 175;
      bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      enemy.sprite.clearTint();
      this.audio.play("shoot");
    });
  }

  private updateArea(): void {
    const area =
      LEVEL.areas.find(
        (candidate) =>
          this.player.x >= candidate.start && this.player.x < candidate.end,
      ) ?? LEVEL.areas[LEVEL.areas.length - 1];
    if (area && this.currentArea !== area.index) {
      this.currentArea = area.index;
      this.checkpointX = area.start + 42;
      this.flashNotice(area.label);
    }
    if (
      !this.bossActive &&
      !this.bossDefeated &&
      this.player.x >= BOSS.arenaStart
    ) {
      this.startBoss();
    }
  }

  private startBoss(): void {
    this.bossActive = true;
    this.audio.play("alarm");
    this.flashNotice("WARNING // MOBILE DRILLER");
    this.cameras.main.stopFollow();
    this.cameras.main.setBounds(
      BOSS.arenaStart,
      0,
      WORLD_WIDTH - BOSS.arenaStart,
      GAME_HEIGHT,
    );
    this.cameras.main.pan(
      BOSS.arenaStart + GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      700,
    );
    this.boss = this.physics.add
      .sprite(BOSS.x, 202, "ir-boss")
      .setImmovable(true);
    this.bodyOf(this.boss).setAllowGravity(false);
    this.physics.add.overlap(this.playerBullets, this.boss, (bullet) =>
      this.hitBoss(bullet as Phaser.GameObjects.GameObject),
    );
    this.physics.add.overlap(this.player, this.boss, () =>
      this.damagePlayer(2),
    );
    this.bossNextAttackAt = this.time.now + 900;
  }

  private updateBoss(time: number): void {
    if (!this.bossActive || !this.boss?.active || this.phase !== "playing") {
      return;
    }
    const phase = bossPhase(this.bossCombat.hp, this.bossCombat.maxHp);
    if (phase !== this.bossMode) {
      this.bossMode = phase;
      this.flashNotice(`DRILLER PHASE ${phase}`);
      this.audio.play("alarm");
    }
    if (time < this.bossNextAttackAt) return;
    this.bossNextAttackAt =
      time + BOSS.attackCooldownMs - (this.bossMode - 1) * 180;
    if (this.bossMode === 1) this.bossMachineGun();
    else if (this.bossMode === 2) this.bossShockwave();
    else this.bossHazardDrop();
  }

  private bossMachineGun(): void {
    if (!this.boss) return;
    this.boss.setTint(0xffd166);
    this.time.delayedCall(340, () => {
      this.boss?.clearTint();
      for (let index = 0; index < 5; index += 1) {
        this.time.delayedCall(index * 95, () => {
          if (!this.bossActive || this.phase !== "playing" || !this.boss)
            return;
          this.fireEnemyProjectile(
            this.boss.x - 55,
            this.boss.y - 11,
            -245,
            Phaser.Math.Between(-24, 24),
            1,
          );
        });
      }
    });
  }

  private bossShockwave(): void {
    if (!this.boss) return;
    const warning = this.add
      .rectangle(this.boss.x - 120, GROUND_Y - 4, 210, 5, 0xffd166, 0.7)
      .setDepth(4);
    this.time.delayedCall(520, () => {
      warning.destroy();
      if (!this.bossActive || this.phase !== "playing" || !this.boss) return;
      for (let index = 0; index < 3; index += 1) {
        this.time.delayedCall(index * 260, () =>
          this.fireEnemyProjectile(
            this.boss?.x ? this.boss.x - 58 : BOSS.x - 58,
            GROUND_Y - 9,
            -205,
            0,
            1,
            1.8,
          ),
        );
      }
      this.shake(0.007, 140);
    });
  }

  private bossHazardDrop(): void {
    if (!this.boss) return;
    const targetX = Phaser.Math.Clamp(
      this.player.x + Phaser.Math.Between(-45, 45),
      BOSS.arenaStart + 30,
      WORLD_WIDTH - 35,
    );
    const marker = this.add
      .rectangle(targetX, GROUND_Y - 3, 34, 4, 0xff5d5d, 0.8)
      .setDepth(6);
    this.time.delayedCall(650, () => {
      marker.destroy();
      if (!this.bossActive || this.phase !== "playing") return;
      const bomb = this.physics.add
        .sprite(targetX, 50, "ir-grenade")
        .setScale(1.5);
      bomb.body.setGravityY(520);
      this.physics.add.collider(bomb, this.platforms, () => {
        if (!bomb.active) return;
        this.explode(bomb.x, bomb.y, 68, 2);
        bomb.destroy();
      });
    });
    if (this.enemies.filter((enemy) => enemy.sprite.active).length < 4) {
      const drone = this.spawnEnemy({
        id: `repair-${this.time.now}`,
        kind: "drone",
        x: BOSS.x - 130,
        y: 95,
        patrolRadius: 80,
        area: 4,
      });
      this.physics.add.overlap(
        this.playerBullets,
        drone.sprite,
        (bullet, enemySprite) =>
          this.hitEnemy(
            bullet as Phaser.GameObjects.GameObject,
            enemySprite as Phaser.GameObjects.GameObject,
          ),
      );
    }
  }

  private fireEnemyProjectile(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    damage: number,
    scale = 1,
  ): void {
    const bullet = this.enemyBullets.get(
      x,
      y,
      "ir-enemy-bullet",
    ) as Phaser.Physics.Arcade.Sprite | null;
    if (!bullet) return;
    bullet
      .setActive(true)
      .setVisible(true)
      .setScale(scale)
      .setVelocity(velocityX, velocityY);
    this.bodyOf(bullet).setAllowGravity(false);
    bullet.setData("damage", damage);
  }

  private handleInteractions(): void {
    if (
      !this.interactQueued &&
      !Phaser.Input.Keyboard.JustDown(this.controls.interact)
    ) {
      return;
    }
    this.interactQueued = false;
    const worker = this.workers.find(
      (candidate) =>
        !candidate.rescued &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          candidate.sprite.x,
          candidate.sprite.y,
        ) < 44,
    );
    if (!worker) return;
    const result = addRescue(this.rescuedIds, worker.id);
    if (!result.changed) return;
    this.rescuedIds = result.ids;
    worker.rescued = true;
    worker.sprite.setTint(0x8ff0c9);
    this.children.getByName(`label-${worker.id}`)?.destroy();
    this.audio.play("pickup");
    this.flashNotice(`WORKER SAFE // ${this.rescuedIds.size} OF 3`);
    this.tweens.add({
      targets: worker.sprite,
      y: worker.sprite.y - 18,
      alpha: 0,
      duration: this.settings.reducedMotion ? 80 : 550,
      onComplete: () => worker.sprite.disableBody(true, true),
    });
  }

  private collectPickup(object: Phaser.GameObjects.GameObject): void {
    const pickup = this.pickups.find(
      (candidate) => candidate.sprite === object,
    );
    if (!pickup?.sprite.active) return;
    if (pickup.kind === "health") {
      this.playerCombat.hp = Math.min(
        this.playerCombat.maxHp,
        this.playerCombat.hp + pickup.amount,
      );
      this.flashNotice("FIELD KIT +2");
    } else if (pickup.weapon) {
      this.weapon = equipWeapon(this.weapon, pickup.weapon, pickup.amount);
      this.flashNotice(
        pickup.weapon === "scatter" ? "ARC SCATTER +24" : "RIVET STORM +90",
      );
    }
    pickup.sprite.disableBody(true, true);
    this.audio.play("pickup");
  }

  private hitPlayerByBullet(object: Phaser.GameObjects.GameObject): void {
    const bullet = object as Phaser.Physics.Arcade.Sprite;
    const damage = Number(bullet.getData("damage") ?? 1);
    this.recycleBullet(bullet);
    this.damagePlayer(damage);
  }

  private hitPlayerByEnemy(object: Phaser.GameObjects.GameObject): void {
    const enemy = this.enemies.find((candidate) => candidate.sprite === object);
    if (!enemy || enemy.state === "dead") return;
    this.damagePlayer(ENEMIES[enemy.kind].damage);
  }

  private damagePlayer(damage: number): void {
    const hit = applyDamage(
      this.playerCombat,
      damage,
      this.time.now,
      PLAYER.invulnerabilityMs,
    );
    if (!hit) return;
    this.audio.play("hurt");
    this.shake(0.006, 120);
    this.player.setTint(0xff7676);
    this.time.delayedCall(100, () => this.player.clearTint());
    if (this.playerCombat.hp <= 0) this.failMission();
  }

  private hitEnemy(
    bulletObject: Phaser.GameObjects.GameObject,
    enemyObject: Phaser.GameObjects.GameObject,
  ): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const enemy = this.enemies.find(
      (candidate) => candidate.sprite === enemyObject,
    );
    if (!enemy || enemy.state === "dead" || !bullet.active) return;
    const damage = Number(bullet.getData("damage") ?? 1);
    this.recycleBullet(bullet);
    enemy.combat.hp = Math.max(0, enemy.combat.hp - damage);
    enemy.combat.invulnerableUntil = this.time.now + 70;
    enemy.state = enemy.combat.hp <= 0 ? "dead" : "hurt";
    this.hitSpark(enemy.sprite.x, enemy.sprite.y);
    if (enemy.combat.hp <= 0) {
      this.audio.play("death");
      enemy.sprite.disableBody(true, true);
      this.burst(enemy.sprite.x, enemy.sprite.y, 0xe2a95b);
    } else {
      this.audio.play("hit");
    }
  }

  private hitBreakable(
    bulletObject: Phaser.GameObjects.GameObject,
    breakableObject: Phaser.GameObjects.GameObject,
  ): void {
    const bullet = bulletObject as Phaser.Physics.Arcade.Sprite;
    const breakable = this.breakables.find(
      (candidate) => candidate.sprite === breakableObject,
    );
    if (!breakable || !breakable.sprite.active || !bullet.active) return;
    this.recycleBullet(bullet);
    breakable.hp -= 1;
    this.hitSpark(breakable.sprite.x, breakable.sprite.y);
    if (breakable.hp > 0) return;
    if (breakable.kind === "barrel") {
      this.explode(breakable.sprite.x, breakable.sprite.y, 72, 5);
    }
    breakable.sprite.disableBody(true, true);
  }

  private hitBoss(object: Phaser.GameObjects.GameObject): void {
    const bullet = object as Phaser.Physics.Arcade.Sprite;
    if (!bullet.active || !this.bossActive || !this.boss?.active) return;
    const damage = Number(bullet.getData("damage") ?? 1);
    this.recycleBullet(bullet);
    this.damageBoss(damage);
  }

  damageBoss(amount: number): void {
    if (!this.bossActive || !this.boss?.active || amount <= 0) return;
    this.bossCombat.hp = Math.max(0, this.bossCombat.hp - amount);
    this.boss.setTint(0xffffff);
    this.time.delayedCall(55, () => this.boss?.clearTint());
    this.hitSpark(this.boss.x - 38, this.boss.y - 4);
    if (this.bossCombat.hp <= 0) this.defeatBoss();
  }

  private explode(x: number, y: number, radius: number, damage: number): void {
    this.audio.play("explosion");
    this.shake(0.012, 180);
    this.burst(x, y, 0xff8c42, 12);
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active || enemy.state === "dead") continue;
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        enemy.sprite.x,
        enemy.sprite.y,
      );
      const applied = radialDamage(distance, radius, damage);
      if (applied > 0) {
        enemy.combat.hp = Math.max(0, enemy.combat.hp - applied);
        if (enemy.combat.hp <= 0) {
          enemy.state = "dead";
          enemy.sprite.disableBody(true, true);
          this.burst(enemy.sprite.x, enemy.sprite.y, 0xe2a95b);
        }
      }
    }
    if (this.bossActive && this.boss?.active) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        this.boss.x,
        this.boss.y,
      );
      this.damageBoss(radialDamage(distance, radius, damage));
    }
    const playerDistance = Phaser.Math.Distance.Between(
      x,
      y,
      this.player.x,
      this.player.y,
    );
    const selfDamage = radialDamage(playerDistance, radius * 0.72, 2);
    if (selfDamage > 0) this.damagePlayer(selfDamage);
  }

  private recycleBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    bullet.disableBody(true, true);
    bullet.setScale(1).clearTint();
  }

  private bodyOf(
    sprite: Phaser.Physics.Arcade.Sprite,
  ): Phaser.Physics.Arcade.Body {
    const body = sprite.body;
    if (!body || body instanceof Phaser.Physics.Arcade.StaticBody) {
      throw new Error(
        `Expected a dynamic physics body for ${sprite.texture.key}`,
      );
    }
    return body;
  }

  private muzzleFlash(x: number, y: number, color: number): void {
    const flash = this.add.circle(x, y, 5, color).setDepth(9);
    this.effects += 1;
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: this.settings.reducedMotion ? 30 : 80,
      onComplete: () => {
        this.effects -= 1;
        flash.destroy();
      },
    });
  }

  private hitSpark(x: number, y: number): void {
    this.burst(x, y, 0xffe082, this.settings.reducedMotion ? 2 : 5);
  }

  private burst(x: number, y: number, color: number, count = 7): void {
    const safeCount = this.settings.reducedMotion ? Math.min(3, count) : count;
    for (let index = 0; index < safeCount; index += 1) {
      const particle = this.add
        .rectangle(x, y, 3, 3, color)
        .setDepth(8)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI));
      this.effects += 1;
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-26, 26),
        y: y + Phaser.Math.Between(-24, 18),
        alpha: 0,
        duration: this.settings.reducedMotion
          ? 90
          : Phaser.Math.Between(180, 360),
        onComplete: () => {
          this.effects -= 1;
          particle.destroy();
        },
      });
    }
  }

  private shake(intensity: number, duration: number): void {
    if (!this.settings.screenShake || this.settings.reducedMotion) return;
    this.cameras.main.shake(duration, intensity);
  }

  private flashNotice(message: string): void {
    this.game.events.emit("iron:notice", message);
  }

  private failMission(): void {
    if (this.phase === "failed") return;
    this.phase = "failed";
    this.physics.pause();
    this.enemyBullets.clear(true, true);
    this.audio.play("death");
    this.emitSnapshot(true);
  }

  private defeatBoss(): void {
    if (!this.boss || !this.bossActive) return;
    this.bossActive = false;
    this.bossDefeated = true;
    this.enemyBullets.clear(true, true);
    this.audio.play("explosion");
    for (let index = 0; index < 6; index += 1) {
      this.time.delayedCall(index * 150, () => {
        if (!this.boss) return;
        this.burst(
          this.boss.x + Phaser.Math.Between(-45, 42),
          this.boss.y + Phaser.Math.Between(-25, 24),
          index % 2 === 0 ? 0xffc857 : 0xf26430,
          10,
        );
        this.shake(0.008, 120);
      });
    }
    this.time.delayedCall(1_050, () => {
      this.boss?.disableBody(true, true);
      this.phase = "victory";
      this.physics.pause();
      this.audio.play("victory");
      this.emitSnapshot(true);
    });
  }

  private emitSnapshot(force: boolean): void {
    if (!force) return;
    this.nextSnapshotAt = this.time.now + 100;
    this.snapshot = {
      phase: this.phase,
      hp: this.playerCombat.hp,
      maxHp: this.playerCombat.maxHp,
      weapon: this.weapon.current,
      ammo: ammoFor(this.weapon),
      grenades: this.grenades,
      rescued: this.rescuedIds.size,
      rescueTotal: LEVEL.workers.length,
      bossActive: this.bossActive,
      bossHp: this.bossCombat.hp,
      bossMaxHp: this.bossCombat.maxHp,
      bossPhase: bossPhase(this.bossCombat.hp, this.bossCombat.maxHp),
      area: this.currentArea,
      playerX: Math.round(this.player.x),
      playerY: Math.round(this.player.y),
      activeEnemies: this.enemies.filter((enemy) => enemy.sprite.active).length,
      playerBullets: this.playerBullets.countActive(true),
      enemyBullets: this.enemyBullets.countActive(true),
      effects: this.effects,
      fps: Math.round(this.game.loop.actualFps),
      status:
        this.phase === "playing"
          ? this.bossActive
            ? `Boss phase ${this.bossMode}`
            : `Combat zone ${this.currentArea}`
          : this.phase,
    };
    this.game.events.emit("iron:snapshot", this.snapshot);
  }

  getSnapshot(): GameSnapshot {
    return { ...this.snapshot };
  }

  setPlayerHealth(hp: number): void {
    this.playerCombat.hp = Phaser.Math.Clamp(
      Math.round(hp),
      0,
      this.playerCombat.maxHp,
    );
    if (this.playerCombat.hp <= 0) this.failMission();
    this.emitSnapshot(true);
  }

  goToArea(area: number | "boss"): void {
    if (this.phase === "title") this.startMission();
    const x =
      area === "boss"
        ? BOSS.arenaStart + 45
        : (LEVEL.areas.find((candidate) => candidate.index === area)?.start ??
          0);
    this.player.setPosition(x + (area === "boss" ? 0 : 55), 205);
    this.player.setVelocity(0, 0);
    if (area === "boss") this.startBoss();
    this.emitSnapshot(true);
  }

  rescueAll(): void {
    for (const worker of this.workers) {
      if (worker.rescued) continue;
      const result = addRescue(this.rescuedIds, worker.id);
      this.rescuedIds = result.ids;
      worker.rescued = true;
      worker.sprite.disableBody(true, true);
      this.children.getByName(`label-${worker.id}`)?.destroy();
    }
    this.emitSnapshot(true);
  }

  getEntityCounts(): {
    enemies: number;
    playerBullets: number;
    enemyBullets: number;
    effects: number;
  } {
    return {
      enemies: this.enemies.filter((enemy) => enemy.sprite.active).length,
      playerBullets: this.playerBullets.countActive(true),
      enemyBullets: this.enemyBullets.countActive(true),
      effects: this.effects,
    };
  }
}

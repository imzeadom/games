import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "test",
    `${pathname}-${process.pid}-${Date.now()}`,
  );
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`https://games.example${pathname}`, {
      headers: { accept: "text/html", host: "games.example" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the game hub and route-specific PWA metadata", async () => {
  const routes = [
    ["/", "纸上游戏厅｜七款轻松小游戏与实用工具", "manifest.webmanifest"],
    ["/sudoku", "纸上数独｜纸上游戏厅", "manifest-sudoku.webmanifest"],
    ["/1024", "合成 1024｜纸上游戏厅", "manifest-1024.webmanifest"],
    ["/sky-hop", "云雀跃｜纸上游戏厅", "manifest-sky-hop.webmanifest"],
    [
      "/twilight-canopy",
      "暮色拾星｜纸上游戏厅",
      "manifest-twilight.webmanifest",
    ],
    ["/maze", "纸上迷宫｜纸上游戏厅", "manifest.webmanifest"],
    [
      "/crossword",
      "Crossword 单词寻踪｜纸上游戏厅",
      "manifest.webmanifest",
    ],
    ["/tools/dice", "骰子工具｜纸上游戏厅", "manifest.webmanifest"],
    ["/history", "历史成绩｜纸上游戏厅", "manifest.webmanifest"],
    ["/privacy", "隐私说明｜纸上游戏厅", "manifest.webmanifest"],
    [
      "/iron-recoil",
      "Iron Recoil｜原创横版跑枪游戏",
      "manifest-iron-recoil.webmanifest",
    ],
  ];

  for (const [pathname, title, manifest] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html lang="zh-CN">/);
    assert.ok(html.includes(`<title>${title}</title>`));
    assert.match(html, new RegExp(`rel="manifest"[^>]+${manifest}`));
    assert.match(
      html,
      /rel="manifest"[^>]+crossorigin="use-credentials"|crossorigin="use-credentials"[^>]+rel="manifest"/,
    );
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  }
});

test("ships animated games, original art, privacy, and discovery assets", async () => {
  const [
    hub,
    sudoku,
    merge,
    skyHop,
    twilight,
    privacy,
    site,
    llms,
    styles,
    serviceWorker,
    maze,
    crossword,
    dice,
    history,
    vocabulary,
    pwaRegister,
    ironRecoil,
  ] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/sudoku/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/1024/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/sky-hop/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/twilight-canopy/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/site.ts", import.meta.url), "utf8"),
      readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
      readFile(new URL("../app/maze/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/crossword/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/tools/dice/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/history/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/crossword/vocabulary.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/pwa-register.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/iron-recoil/page.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(hub, /纸上数独/);
  assert.match(hub, /合成 1024/);
  assert.match(hub, /云雀跃/);
  assert.match(hub, /暮色拾星/);
  assert.match(hub, /纸上迷宫/);
  assert.match(hub, /Crossword · 单词寻踪/);
  assert.match(hub, /掷骰子/);
  assert.match(sudoku, /label: "困难"/);
  assert.match(sudoku, /setNoteMode/);
  assert.match(sudoku, /completionDismissed/);
  assert.match(merge, /TileMovement/);
  assert.match(merge, /moving-tile/);
  assert.match(merge, /mergedTargets/);
  assert.match(merge, /movementDistance/);
  assert.match(merge, /completeSwipe/);
  assert.match(merge, /dismissResult/);
  assert.match(merge, /aria-label="关闭本局结果"/);
  assert.match(styles, /@keyframes tile-move/);
  assert.match(styles, /@keyframes tile-merge/);
  assert.doesNotMatch(styles, /var\(--move-column\) \*/);
  assert.match(skyHop, /drawGate/);
  assert.match(skyHop, /sky-lark\.png/);
  assert.doesNotMatch(skyHop, /next\/image/);
  assert.match(twilight, /generateAhead/);
  assert.match(twilight, /bufferedUntil/);
  assert.match(twilight, /world\.glide/);
  assert.match(twilight, /world\.rescueBand/);
  assert.match(twilight, /fib\(world\.combo\)/);
  assert.match(twilight, /灵蝶相伴 · 总分 ×2/);
  assert.match(twilight, /unlockedThemes/);
  assert.match(twilight, /const BOUNCE_SPEED = 710/);
  assert.match(twilight, /HORIZONTAL_SPEED_MULTIPLIER = 1\.5/);
  assert.match(twilight, /doublePlatform/);
  assert.match(twilight, /requestFullscreen/);
  assert.match(twilight, /DeviceOrientationEvent/);
  assert.match(twilight, /PlatformBehavior/);
  assert.match(twilight, /behavior === "moving"/);
  assert.match(twilight, /platform\.behavior !== "blinking"/);
  assert.match(twilight, /behavior === "fragile"/);
  assert.match(twilight, /behavior === "bell"/);
  assert.match(twilight, /activateRocket/);
  assert.match(twilight, /lastHudSync/);
  assert.match(twilight, /endGame\(\)/);
  assert.match(twilight, /DIFFICULTY_STAGES/);
  assert.match(twilight, /startsAt: 270/);
  assert.match(twilight, /difficultyStageFor/);
  assert.match(twilight, /world\.nextGustAt/);
  assert.match(twilight, /const deadZone = 1\.2/);
  assert.match(twilight, /gamma \/ 12/);
  assert.match(privacy, /不接入广告、行为分析、营销追踪/);
  assert.match(site, /https:\/\/games\.imzeadom\.chatgpt\.site/);
  assert.match(llms, /https:\/\/games\.imzeadom\.chatgpt\.site/);
  assert.doesNotMatch(llms, /paper-sudoku-games/);
  assert.match(serviceWorker, /paper-arcade-v7/);
  assert.match(serviceWorker, /iron-recoil/);
  assert.match(serviceWorker, /twilight-canopy/);
  assert.match(serviceWorker, /crossword/);
  assert.match(serviceWorker, /SKIP_WAITING/);
  assert.match(serviceWorker, /ASSET_REFERENCE_PATTERN/);
  assert.match(serviceWorker, /precacheApp/);
  assert.match(serviceWorker, /cache: "no-store"/);
  assert.match(serviceWorker, /isRscRequest/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.doesNotMatch(serviceWorker, /cache\.put\(event\.request/);
  assert.match(pwaRegister, /强制刷新/);
  assert.match(pwaRegister, /registration\.update\(\)/);
  assert.match(pwaRegister, /updateViaCache: "none"/);
  assert.match(
    pwaRegister,
    /SERVICE_WORKER_ENABLED = process\.env\.NODE_ENV === "production"/,
  );
  assert.match(pwaRegister, /registration\.unregister\(\)/);
  for (const page of [
    hub,
    sudoku,
    merge,
    skyHop,
    twilight,
    privacy,
    maze,
    crossword,
    dice,
    history,
    ironRecoil,
  ]) {
    assert.match(page, /<PwaMenuActions \/>/);
  }
  assert.doesNotMatch(styles, /\.install-pwa-button/);
  assert.doesNotMatch(pwaRegister, /className="install-pwa-button"/);
  assert.match(pwaRegister, /className="menu-pwa-button menu-install-button"/);
  assert.match(pwaRegister, /installContext\.installLabel/);
  assert.match(pwaRegister, /display-mode: standalone/);
  assert.match(pwaRegister, /installationHelpFor/);
  assert.match(pwaRegister, /添加到主屏幕/);
  assert.match(pwaRegister, /useCachedDocumentNavigation/);
  assert.match(pwaRegister, /window\.location\.assign/);
  assert.match(maze, /generateMaze/);
  assert.match(maze, /analysis\.reachable !== cells\.length/);
  assert.match(maze, /branchDepth/);
  assert.match(maze, /maze-token/);
  assert.match(maze, /is-trail/);
  assert.doesNotMatch(maze, /留在这一局查看路径/);
  assert.match(maze, /label: "困难"/);
  assert.match(maze, /recordScore/);
  assert.match(crossword, /VOCABULARY/);
  assert.match(crossword, /从 1000 词分级词库中随机出题/);
  assert.match(crossword, /label: "困难"/);
  assert.match(crossword, /showWinModal/);
  assert.match(crossword, /aria-label="关闭完成提示"/);
  assert.match(crossword, /size: 10/);
  assert.match(crossword, /size: 12/);
  assert.match(vocabulary, /VOCABULARY\.length !== 1000/);
  assert.match(vocabulary, /is used after “he”, “she”, or “it”/);
  assert.doesNotMatch(vocabulary, /She often/);
  assert.ok(
    vocabulary.split("\n").filter((line) => /^\w+\|.+$/.test(line)).length >=
      250,
  );
  assert.match(dice, /DICE_SIDES = \[6, 8, 10, 12, 20\]/);
  assert.match(dice, /D6_PIPS/);
  assert.doesNotMatch(dice, /⚀|⚁|⚂|⚃|⚄|⚅/);
  assert.match(styles, /\.die\.is-d6 span/);
  assert.doesNotMatch(sudoku, /留在这一局查看棋盘/);
  assert.match(history, /getScoreHistory/);

  await Promise.all([
    access(new URL("../public/icon-1024-192.png", import.meta.url)),
    access(new URL("../public/icon-sky-192.png", import.meta.url)),
    access(new URL("../public/sky-hop-background.png", import.meta.url)),
    access(new URL("../public/sky-lark.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon.ico", import.meta.url)),
    access(new URL("../public/llms.txt", import.meta.url)),
    access(new URL("../app/sitemap.ts", import.meta.url)),
    access(new URL("../app/robots.ts", import.meta.url)),
  ]);
  await assert.rejects(access(new URL("../app/_sites-preview", projectRoot)));
});

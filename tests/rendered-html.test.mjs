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
    ["/", "纸上游戏厅｜四款轻松小游戏", "manifest.webmanifest"],
    ["/sudoku", "纸上数独｜纸上游戏厅", "manifest-sudoku.webmanifest"],
    ["/1024", "合成 1024｜纸上游戏厅", "manifest-1024.webmanifest"],
    ["/sky-hop", "云雀跃｜纸上游戏厅", "manifest-sky-hop.webmanifest"],
    [
      "/twilight-canopy",
      "暮色拾星｜纸上游戏厅",
      "manifest-twilight.webmanifest",
    ],
    ["/privacy", "隐私说明｜纸上游戏厅", "manifest.webmanifest"],
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
    ]);

  assert.match(hub, /纸上数独/);
  assert.match(hub, /合成 1024/);
  assert.match(hub, /云雀跃/);
  assert.match(hub, /暮色拾星/);
  assert.match(sudoku, /label: "困难"/);
  assert.match(sudoku, /setNoteMode/);
  assert.match(merge, /TileMovement/);
  assert.match(merge, /moving-tile/);
  assert.match(merge, /mergedTargets/);
  assert.match(merge, /movementDistance/);
  assert.match(merge, /completeSwipe/);
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
  assert.match(privacy, /不接入广告、行为分析、营销追踪/);
  assert.match(site, /https:\/\/games\.imzeadom\.chatgpt\.site/);
  assert.match(llms, /https:\/\/games\.imzeadom\.chatgpt\.site/);
  assert.doesNotMatch(llms, /paper-sudoku-games/);
  assert.match(serviceWorker, /paper-arcade-v4/);
  assert.match(serviceWorker, /twilight-canopy/);

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

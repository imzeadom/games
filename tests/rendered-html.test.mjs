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
    ["/", "纸上游戏厅｜三款轻松小游戏", "manifest.webmanifest"],
    ["/sudoku", "纸上数独｜纸上游戏厅", "manifest-sudoku.webmanifest"],
    ["/1024", "合成 1024｜纸上游戏厅", "manifest-1024.webmanifest"],
    ["/sky-hop", "云雀跃｜纸上游戏厅", "manifest-sky-hop.webmanifest"],
  ];

  for (const [pathname, title, manifest] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html lang="zh-CN">/);
    assert.ok(html.includes(`<title>${title}</title>`));
    assert.ok(html.includes(`rel="manifest" href="/${manifest}"`));
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
  }
});

test("ships three games, original art, and offline assets", async () => {
  const [hub, sudoku, merge, skyHop, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sudoku/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/1024/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sky-hop/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(hub, /纸上数独/);
  assert.match(hub, /合成 1024/);
  assert.match(hub, /云雀跃/);
  assert.match(sudoku, /label: "困难"/);
  assert.match(sudoku, /setNoteMode/);
  assert.match(merge, /mergeLine/);
  assert.match(merge, /completeSwipe/);
  assert.match(skyHop, /drawGate/);
  assert.match(skyHop, /sky-lark\.png/);
  assert.match(serviceWorker, /paper-arcade-v2/);

  await Promise.all([
    access(new URL("../public/icon-1024-192.png", import.meta.url)),
    access(new URL("../public/icon-sky-192.png", import.meta.url)),
    access(new URL("../public/sky-hop-background.png", import.meta.url)),
    access(new URL("../public/sky-lark.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
  ]);
  await assert.rejects(access(new URL("../app/_sites-preview", projectRoot)));
});

import { expect, test } from "@playwright/test";

test.describe("Iron Recoil mission flow", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/iron-recoil");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__IRON_RECOIL_TEST_API__));
    expect(errors).toEqual([]);
  });

  test("loads, enters play, moves, jumps, shoots, pauses and resumes", async ({
    page,
  }) => {
    const initial = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.getState(),
    );
    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("hud")).toBeVisible();

    await page.keyboard.down("KeyD");
    await page.waitForTimeout(450);
    await page.keyboard.up("KeyD");
    const moved = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.getState(),
    );
    expect(moved?.playerX).toBeGreaterThan(initial?.playerX ?? 0);

    const beforeJumpY = moved?.playerY ?? 230;
    await page.keyboard.press("Space");
    await page.waitForFunction(
      (groundY) =>
        (window.__IRON_RECOIL_TEST_API__?.getState().playerY ?? groundY) <
        groundY - 8,
      beforeJumpY,
    );
    const jumped = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.getState(),
    );
    expect(jumped?.playerY).toBeLessThan(beforeJumpY - 8);

    await page.keyboard.press("KeyJ");
    await page.waitForTimeout(30);
    const shotCounts = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.entityCounts(),
    );
    expect(shotCounts?.playerBullets).toBeGreaterThan(0);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-menu")).toBeHidden();
  });

  test("fails, restarts, reaches the boss, wins, and resets cleanly", async ({
    page,
  }) => {
    await page.getByTestId("start-button").click();
    await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.setPlayerHealth(0),
    );
    await expect(page.getByTestId("failure-screen")).toBeVisible();
    await page.getByTestId("restart-button").click();
    await expect(page.getByTestId("title-screen")).toBeVisible();

    const reset = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.getState(),
    );
    expect(reset?.hp).toBe(5);
    expect(reset?.rescued).toBe(0);
    expect(reset?.weapon).toBe("pulse");
    expect(reset?.enemyBullets).toBe(0);

    await page.evaluate(() => {
      window.__IRON_RECOIL_TEST_API__?.start();
      window.__IRON_RECOIL_TEST_API__?.rescueAll();
      window.__IRON_RECOIL_TEST_API__?.goToArea("boss");
    });
    await expect(page.getByTestId("boss-health")).toBeVisible();
    await page.evaluate(() => window.__IRON_RECOIL_TEST_API__?.damageBoss(999));
    await expect(page.getByTestId("victory-screen")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("rescued")).toContainText("3 / 3");

    await page.getByTestId("victory-restart").click();
    await expect(page.getByTestId("title-screen")).toBeVisible();
    const finalState = await page.evaluate(() =>
      window.__IRON_RECOIL_TEST_API__?.getState(),
    );
    expect(finalState?.bossActive).toBe(false);
    expect(finalState?.bossHp).toBe(BOSS_MAX_HP);
    expect(finalState?.activeEnemies).toBe(12);
  });
});

const BOSS_MAX_HP = 72;

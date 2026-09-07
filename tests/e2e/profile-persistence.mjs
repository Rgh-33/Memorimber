// User-run only. Requires Playwright in the user's test environment and a
// previously authenticated storageState file. No credentials are embedded.
import assert from "node:assert/strict";
const { chromium, webkit } = await import("playwright");
const baseURL = process.env.MEMORIMBER_TEST_URL ?? "http://localhost:3000";
const storageState = process.env.MEMORIMBER_STORAGE_STATE;
if (!storageState) throw new Error("MEMORIMBER_STORAGE_STATE must point to an authenticated Playwright storageState file");
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ baseURL, storageState });
    const page = await context.newPage();
    await page.goto("/profile");
    const initialResponse = await page.request.get("/api/profile");
    assert.equal(initialResponse.status(), 200);
    const before = (await initialResponse.json()).progress;
    assert.ok(before, "apply migrations before running this test");
    await page.evaluate(() => {
      localStorage.setItem("memorimber-profile-level-state-v1", JSON.stringify({ version: 1, achievedLevel: 20, activities: { harvestedFruits: 999999, randomQuizChallenges: 999999 }, baselines: {} }));
    });
    await page.reload();
    await page.locator(`.profile-level-summary[aria-label="現在のレベルは${before.achievedLevel}です"]`).waitFor();
    assert.equal(await page.locator(".profile-level-fraction").getAttribute("aria-label"), `${before.photosIntoLevel}/${before.photosForNextLevel}`);
    const after = (await (await page.request.get("/api/profile")).json()).progress;
    assert.equal(after.achievedLevel, before.achievedLevel);
    assert.deepEqual(after.stats, before.stats);
    // The existing record layout must stay 4 x 4 with one expanded row.
    const records = page.locator('section[aria-labelledby="profile-medals-heading"] button');
    assert.equal(await records.count(), 16);
    assert.equal(await records.first().getAttribute("aria-expanded"), "false");
    await records.first().click();
    assert.equal(await records.first().getAttribute("aria-expanded"), "true");
    await records.nth(5).click();
    assert.equal(await records.first().getAttribute("aria-expanded"), "false");
    assert.equal(await records.nth(5).getAttribute("aria-expanded"), "true");
    await context.close();
  } finally { await browser.close(); }
}

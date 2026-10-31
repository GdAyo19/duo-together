import { expect, test, type Page } from "@playwright/test";

const LOCAL_KEY = "tandem-shared-space-v1";

async function openPreview(page: Page) {
  // Run against the on-device preview instead of the live Supabase project:
  // an empty config makes initializeBackend() stop before creating a client.
  await page.route("**/config.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.TANDEM_CONFIG = {};"
    })
  );
  await page.goto("/");
  await expect(page.locator("#greeting")).toBeVisible();
}

async function startLesson(page: Page) {
  await page.locator(".start-challenge").first().click();
  await expect(page.locator("#quiz-learn")).toBeVisible();
  await expect(page.locator("#learn-list .learn-item")).toHaveCount(3);
  await page.locator("#quiz-start").click();
  await expect(page.locator("#quiz-content")).toBeVisible();
}

async function answerAllQuestions(page: Page) {
  for (let index = 0; index < 3; index += 1) {
    await page.locator(".answer-option").first().click();
    await page.locator("#quiz-next").click();
  }
  await expect(page.locator("#quiz-result")).toBeVisible();
}

test("home screen renders in preview mode without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await openPreview(page);

  await expect(page.locator("#couple-name")).toHaveText("Okomi & Ifemi");
  await expect(page.locator("#sync-label")).toHaveText("Saved on this device");
  await expect(page.locator("#practice-lanes .practice-lane")).toHaveCount(2);
  await expect(page.locator("#practice-lanes .lane-total").first()).toHaveText("0/5");
  await expect(page.locator("#streak-count")).toHaveText("0");
  await expect(page.locator("#phrase-target")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("finishing every question and closing the challenge still records practice", async ({
  page
}) => {
  await openPreview(page);
  await startLesson(page);

  const dialog = page.locator("#challenge-dialog");
  await expect(dialog).toBeVisible();
  await answerAllQuestions(page);

  await page.locator("#challenge-dialog .dialog-close").click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const stored = JSON.parse(localStorage.getItem(key) || "{}");
        return Array.isArray(stored.practiceDays) ? stored.practiceDays.length : 0;
      }, LOCAL_KEY)
    )
    .toBe(2);

  await page.reload();
  await expect(page.locator("#practice-lanes .lane-total").first()).toHaveText("5/5");
  await expect(page.locator("#word-count")).toHaveText("3");
});

test("finishing with the button saves practice once", async ({ page }) => {
  await openPreview(page);
  await startLesson(page);
  await answerAllQuestions(page);

  await page.locator("#finish-challenge").click();
  await expect(page.locator("#challenge-dialog")).toBeHidden();
  await expect(page.locator("#practice-lanes .lane-total").first()).toHaveText("5/5");

  const practiceDays = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    return stored.practiceDays;
  }, LOCAL_KEY);
  expect(practiceDays).toHaveLength(2);
  expect(new Set(practiceDays.map((row: { phrase_keys: string[] }) => row.phrase_keys.join("|"))).size).toBe(1);
});

test("saving today's phrase adds it to the shared moments", async ({ page }) => {
  await openPreview(page);
  const phrase = await page.locator("#phrase-target").innerText();

  await page.locator("#save-phrase").click();
  await expect(page.locator("#phrase-count")).toHaveText("1");

  await page.locator('a[data-view="moments"]').first().click();
  await expect(page.locator("#moments-view")).toBeVisible();
  await expect(page.locator("#saved-list")).toContainText(phrase);
});

test("the video call panel stays hidden until a shared space exists", async ({ page }) => {
  await openPreview(page);
  await page.locator(".start-challenge").first().click();

  await expect(page.locator("#challenge-dialog")).toBeVisible();
  await expect(page.locator("#learn-list .learn-item")).toHaveCount(3);
  await expect(page.locator("#call-panel")).toBeHidden();
  await expect(page.locator("#call-status")).toHaveText("Join a shared space to make video calls.");
});

test("the installable manifest is served", async ({ page, request }) => {
  await openPreview(page);
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.name).toContain("Tandem");
  expect(manifest.start_url).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

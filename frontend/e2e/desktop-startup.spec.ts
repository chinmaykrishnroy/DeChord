import { expect, test } from "@playwright/test";

test("desktop shows a responsive startup screen while the engine initializes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: { invoke: () => new Promise(() => {}) },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Starting DeChord" }),
  ).toBeVisible();
  await expect(page.getByText(/Starting locally · [1-9]\d*s/)).toBeVisible();
});

test("desktop startup failure shows the diagnostic once as text", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        invoke: () =>
          Promise.reject("Diagnostic log: C:\\DeChord\\engine.log <details>"),
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "DeChord could not start" }),
  ).toBeVisible();
  await expect(
    page.getByText("Diagnostic log: C:\\DeChord\\engine.log <details>"),
  ).toBeVisible();
  await expect(page.locator("details")).toHaveCount(0);
});

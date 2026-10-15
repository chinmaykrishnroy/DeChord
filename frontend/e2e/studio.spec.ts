import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "E2E Song 6 Local audio", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Tempo BPM" })).toHaveValue(
    "100 BPM",
  );
});

test("library songs stay clipped below their header at short desktop heights", async ({
  page,
}) => {
  for (const height of [820, 720, 650, 560, 533]) {
    await page.setViewportSize({ width: 1280, height });
    await page
      .getByRole("region", { name: "Your music songs" })
      .evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
    const geometry = await page.evaluate(() => {
      const area = document.querySelector(".sidebar-library")!;
      const header = document
        .querySelector(".sidebar-library-heading")!
        .getBoundingClientRect();
      const list = document.querySelector(".sidebar-song-list")!;
      const box = list.getBoundingClientRect();
      const sidebar = area.closest(".studio-sidebar")!;
      return {
        leaked: document
          .elementsFromPoint(
            area.getBoundingClientRect().left + 26,
            header.top - 3,
          )
          .some((node) => node.closest(".library-mini")),
        overlap: header.bottom > box.top + 1,
        fitsRow:
          box.height >=
          list.querySelector(".library-mini")!.getBoundingClientRect().height,
        outerScroll: sidebar.scrollHeight > sidebar.clientHeight + 1,
      };
    });
    expect(geometry).toEqual({
      leaked: false,
      overlap: false,
      fitsRow: true,
      outerScroll: false,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("region", { name: "Your music songs" }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("practice restores per-song controls and position without autoplay", async ({
  page,
}) => {
  const tempo = page.getByRole("textbox", { name: "Tempo BPM" });
  await tempo.fill("85");
  await tempo.press("Enter");
  const pitch = page.getByRole("textbox", { name: "Transpose semitones" });
  await pitch.fill("-2");
  await pitch.press("Enter");
  await page.getByRole("combobox", { name: "Capo fret" }).selectOption("3");
  await page
    .getByRole("spinbutton", { name: "Lyrics offset seconds" })
    .fill("1.25");
  await page
    .getByRole("slider", { name: "Playback position", exact: true })
    .press("End");
  await page.getByRole("button", { name: "Guitar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Guitar", exact: true }),
  ).toBeVisible();
  await expect(tempo).toHaveValue("85 BPM");
  await expect(pitch).toHaveValue("-2 st");
  await expect(page.getByRole("combobox", { name: "Capo fret" })).toHaveValue(
    "3",
  );
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((node: HTMLAudioElement) => node.currentTime),
    )
    .toBeGreaterThan(17);
  expect(
    await page
      .locator("audio")
      .evaluate((node: HTMLAudioElement) => node.paused),
  ).toBe(true);
  await page.getByRole("button", { name: "Lyrics", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Lyrics offset seconds" }),
  ).toHaveValue("1.25");
  await page
    .getByRole("button", { name: "E2E Song 5 Local audio", exact: true })
    .click();
  await expect(pitch).toHaveValue("0 st");
  await page
    .getByRole("button", { name: "E2E Song 6 Local audio", exact: true })
    .click();
  await expect(pitch).toHaveValue("-2 st");
  await expect(page.getByRole("combobox", { name: "Capo fret" })).toHaveValue(
    "3",
  );
});

test("real audio clock runs and timeline follow can be disabled", async ({
  page,
}) => {
  await page.getByRole("slider", { name: "Track volume" }).press("Home");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((node: HTMLAudioElement) => node.currentTime),
    )
    .toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Follow playback" }).click();
  await expect(
    page.getByRole("button", { name: "Follow playback" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Timeline zoom" })
    .selectOption("0.25");
  await expect(
    page.getByRole("combobox", { name: "Timeline zoom" }),
  ).toHaveValue("0.25");
});

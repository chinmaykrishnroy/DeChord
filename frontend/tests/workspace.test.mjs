import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readLayout,
  addWidget,
  defaultLayouts,
  moveWidget,
} from "../src/features/workspace/layout.ts";
import { parseLyrics } from "../src/utils/lyrics.ts";
test("invalid layout storage falls back to usable defaults", () => {
  for (const value of [
    "invalid",
    "{}",
    JSON.stringify({
      version: 1,
      visible: ["guitar"],
      layouts: { lg: [{ i: "guitar", x: NaN }] },
    }),
  ])
    assert.ok(readLayout(value).visible.includes("piano"));
});
test("adding a widget creates valid placements for every breakpoint without duplicates", () => {
  let state = readLayout(null);
  state = addWidget(state, "piano");
  state = addWidget(state, "piano");
  assert.equal(state.visible.filter((i) => i === "piano").length, 1);
  for (const [bp, cols] of Object.entries({ lg: 12, md: 8, sm: 1 })) {
    const item = state.layouts[bp].find((i) => i.i === "piano");
    assert.ok(item.w <= cols);
    assert.ok(item.x + item.w <= cols);
  }
});
test("round trip preserves a moved layout", () => {
  const state = readLayout(null);
  state.layouts.lg = state.layouts.lg.map((i) =>
    i.i === "guitar" ? { ...i, x: 4, w: 8 } : i,
  );
  assert.equal(
    readLayout(JSON.stringify({ version: 2, ...state })).layouts.lg.find(
      (i) => i.i === "guitar",
    ).x,
    4,
  );
});
test("lyrics use sorted repeated timestamps and LRC offsets", () => {
  const l = parseLyrics(
    "[offset:500]\n[00:10.00]Ten\n[00:02.00][00:06.00]Repeat",
    "manual",
  );
  assert.deepEqual(
    l.lines.map((i) => i.timeSeconds),
    [2.5, 6.5, 10.5],
  );
  assert.equal(l.synced, true);
});
test("placeholder lyric responses are not displayed as lyrics", () => {
  assert.equal(parseLyrics("Lyrics unavailable", "internet").status, "empty");
});

test("keyboard movement resolves collisions instead of snapping back", () => {
  const moved = moveWidget(defaultLayouts().md, "guitar", "ArrowDown", 8);
  assert.ok(moved.find((i) => i.i === "guitar").y > 0);
  for (const a of moved)
    for (const b of moved)
      if (a !== b)
        assert.ok(
          a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y,
        );
});

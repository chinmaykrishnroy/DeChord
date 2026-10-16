import { test } from "node:test";
import assert from "node:assert/strict";
import { readLayout, mergeLayouts } from "../src/features/workspace/layout.ts";
import { timelineScale } from "../src/features/timeline/geometry.ts";
import {
  timelineZooms,
  followScroll,
} from "../src/features/timeline/geometry.ts";
import {
  controlValue,
  tempoBounds,
} from "../src/features/playback/controls.ts";
import { centeredLyricScroll } from "../src/utils/lyricsScroll.ts";
import { getGuitarShape } from "../src/features/guitar/model/guitar.ts";

test("default workspace exposes piano and keeps the practice timeline out of movable widgets", () => {
  const state = readLayout(null);
  assert.ok(
    state.visible.includes("piano"),
    "piano must be visible without finding Customize",
  );
  assert.ok(
    !state.visible.includes("timeline"),
    "the timeline belongs to the bottom dock",
  );
});

test("follow mode keeps the playhead at its anchor from start to end with quarter zoom available", () => {
  const anchor = 200,
    width = 5000,
    duration = 200;
  for (const time of [0, 1, 30, 199, 200])
    assert.equal(
      anchor + (time / duration) * width - followScroll(time, duration, width),
      anchor,
    );
  assert.ok(timelineZooms.includes(0.25));
  assert.equal(
    timelineScale([{ label: "C", startSeconds: 0, endSeconds: 2 }], 0.25),
    timelineScale([{ label: "C", startSeconds: 0, endSeconds: 2 }], 1) / 4,
  );
});

test("typed transport values reject invalid input, enforce matching playback bounds and reset to source values", () => {
  const bounds = tempoBounds(100);
  assert.equal(controlValue("80", 100, bounds.min, bounds.max), 80);
  assert.equal(controlValue("100", 80, bounds.min, bounds.max), 100);
  assert.equal(controlValue("900", 100, bounds.min, bounds.max), 200);
  for (const value of ["", "NaN", "Infinity", "tempo"])
    assert.equal(controlValue(value, 100, 25, 200), 100);
  assert.equal(controlValue("-5", 0, -12, 12, true), -5);
  assert.equal(controlValue("0", -5, -12, 12, true), 0);
});

test("saving a resized layout preserves hidden lyrics without duplicating widget ids", () => {
  const original = readLayout(null).layouts;
  const visible = original.lg
    .filter((item) => item.i !== "lyrics")
    .map((item) => (item.i === "piano" ? { ...item, h: 8 } : item));
  let saved = mergeLayouts(original, { ...original, lg: visible });
  saved = mergeLayouts(saved, { ...saved, lg: visible });
  for (const items of Object.values(saved))
    assert.equal(items.length, new Set(items.map((item) => item.i)).size);
  assert.equal(saved.lg.find((item) => item.i === "piano").h, 8);
  assert.ok(saved.lg.some((item) => item.i === "lyrics"));
});

test("open D fingering remains a three-finger shape and capo 4 stays near the capo", () => {
  const chord = {
    id: "fsharp",
    label: "F#",
    root: "F#",
    quality: "major",
    tones: [],
    startSeconds: 0,
    endSeconds: 4,
  };
  const shape = getGuitarShape(chord, "open", 4);
  assert.equal(shape.playedShape, "D");
  assert.deepEqual(
    shape.positions.map((p) => p.fret),
    [2, 3, 2, 0, "x", "x"],
  );
});

test("lyrics center using viewport coordinates even with nested offset parents", () => {
  assert.equal(centeredLyricScroll(300, 200, 240, 520, 40), 520);
  assert.equal(centeredLyricScroll(0, 500, 200, 540, 40), 0);
});

test("dense chord timelines retain readable labels and scroll instead of fitting the song", () => {
  const chords = [
    { label: "F#m7", startSeconds: 0, endSeconds: 0.2 },
    { label: "C#sus4", startSeconds: 0.2, endSeconds: 0.7 },
  ];
  const scale = timelineScale(chords);
  for (const c of chords)
    assert.ok(
      (c.endSeconds - c.startSeconds) * scale >=
        Math.max(64, c.label.length * 9 + 24),
    );
});

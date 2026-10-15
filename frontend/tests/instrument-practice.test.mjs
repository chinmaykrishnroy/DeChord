import { test } from "node:test";
import assert from "node:assert/strict";
import { chordContext } from "../src/features/instruments/chordContext.ts";
import { animateTimeline } from "../src/features/timeline/animation.ts";

const chords = [
  { id: "a", label: "C", startSeconds: 0, endSeconds: 2 },
  { id: "n", label: "N", startSeconds: 2, endSeconds: 3 },
  { id: "b", label: "G7", startSeconds: 4, endSeconds: 6 },
];
test("practice context preserves silence, seeks, gaps and track boundaries", () => {
  assert.deepEqual(chordContext(chords, 1), {
    previous: null,
    current: chords[0],
    next: chords[2],
  });
  assert.deepEqual(chordContext(chords, 2), {
    previous: chords[0],
    current: chords[1],
    next: chords[2],
  });
  assert.deepEqual(chordContext(chords, 3.5), {
    previous: chords[0],
    current: null,
    next: chords[2],
  });
  assert.deepEqual(chordContext(chords, 4), {
    previous: chords[0],
    current: chords[2],
    next: null,
  });
  assert.deepEqual(chordContext(chords, 6), {
    previous: chords[2],
    current: null,
    next: null,
  });
  assert.deepEqual(chordContext([], 0), {
    previous: null,
    current: null,
    next: null,
  });
});
test("timeline samples the live audio clock between React updates and cancels on unmount", () => {
  let scheduled,
    time = 0,
    cancelled;
  const painted = [];
  const stop = animateTimeline(
    () => time,
    (value) => painted.push(value),
    (callback) => {
      scheduled = callback;
      return 7;
    },
    (id) => {
      cancelled = id;
    },
  );
  for (time of [0.016, 0.033, 0.05, 0.066]) scheduled();
  assert.deepEqual(painted, [0.016, 0.033, 0.05, 0.066]);
  stop();
  assert.equal(cancelled, 7);
});

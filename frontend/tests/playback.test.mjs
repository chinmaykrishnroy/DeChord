import { test } from "node:test";
import assert from "node:assert/strict";
import { playbackPosition } from "../src/features/playback/clock.ts";
test("a loop ending at track end wraps instead of stopping", () => {
  assert.deepEqual(
    playbackPosition(12, 12, { startSeconds: 8, endSeconds: 12 }),
    { time: 8, looped: true, ended: false },
  );
});
test("looping preserves clock overshoot", () => {
  assert.ok(
    Math.abs(
      playbackPosition(5.2, 12, { startSeconds: 2, endSeconds: 5 }).time - 2.2,
    ) < 1e-9,
  );
});
test("without a loop end of track stops", () => {
  assert.equal(playbackPosition(12, 12).ended, true);
});

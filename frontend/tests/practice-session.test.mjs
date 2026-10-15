import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPractice,
  readPracticeBook,
  rememberPractice,
  restorePractice,
} from "../src/features/workspace/practiceSession.ts";

test("a saved practice round trip preserves the song's playable settings without a play intent", () => {
  const settings = {
    ...defaultPractice(),
    page: "guitar",
    position: 113.75,
    transpose: -2,
    tempo: -15,
    lyricOffset: 1.25,
    loop: { startSeconds: 100, endSeconds: 120 },
    guitar: {
      mode: "open",
      capo: 4,
      autoCapo: false,
      easyShapes: ["Am", "C", "G"],
    },
  };
  const book = rememberPractice(readPracticeBook(null), "song-a", settings);
  const restored = readPracticeBook(JSON.stringify(book));
  assert.equal(restored.lastSongId, "song-a");
  assert.deepEqual(restored.sessions[0].practice, settings);
  assert.equal("isPlaying" in restored.sessions[0].practice, false);
});

test("sessions stay isolated when switching songs and the most recent 50 are retained", () => {
  let book = readPracticeBook(null);
  for (let i = 0; i < 55; i++)
    book = rememberPractice(book, `song-${i}`, {
      ...defaultPractice(),
      position: i,
    });
  book = rememberPractice(book, "song-10", {
    ...defaultPractice(),
    position: 82,
    lyricOffset: -2,
  });
  assert.equal(book.sessions.length, 50);
  assert.equal(book.lastSongId, "song-10");
  assert.equal(book.sessions[0].practice.position, 82);
  assert.equal(
    book.sessions.find((s) => s.songId === "song-54").practice.position,
    54,
  );
  assert.equal(
    book.sessions.find((s) => s.songId === "song-4"),
    undefined,
  );
});

test("corrupt or obsolete storage is safe and recording duration bounds restored positions and loops", () => {
  for (const text of ["broken", "null", '{"version":2,"sessions":[]}']) {
    assert.deepEqual(readPracticeBook(text), {
      version: 1,
      lastSongId: null,
      sessions: [],
    });
  }
  const restored = restorePractice(
    {
      position: 999,
      transpose: 100,
      tempo: NaN,
      volume: -1,
      lyricOffset: Infinity,
      loop: { startSeconds: 10, endSeconds: 200 },
      guitar: { mode: "invalid", capo: 99, easyShapes: ["C", "C", {}, "Am"] },
    },
    15,
  );
  assert.equal(restored.position, 15);
  assert.deepEqual(restored.loop, { startSeconds: 10, endSeconds: 15 });
  assert.equal(restored.transpose, 12);
  assert.equal(restored.tempo, 0);
  assert.equal(restored.volume, 0);
  assert.equal(restored.lyricOffset, 0);
  assert.deepEqual(restored.guitar, {
    mode: "open",
    capo: 12,
    autoCapo: true,
    easyShapes: ["C", "Am"],
  });
  assert.equal(
    restorePractice({ loop: { startSeconds: 20, endSeconds: 30 } }, 15).loop,
    null,
  );
  assert.equal(
    restorePractice({ loop: { startSeconds: 8, endSeconds: 3 } }, 15).loop,
    null,
  );
});

test("duplicate and malformed song entries cannot replace valid session identities", () => {
  const book = readPracticeBook(
    JSON.stringify({
      version: 1,
      lastSongId: "missing",
      sessions: [
        { songId: "song", practice: { position: 5 } },
        { songId: "song", practice: { position: 99 } },
        { songId: {}, practice: {} },
      ],
    }),
  );
  assert.equal(book.sessions.length, 1);
  assert.equal(book.sessions[0].practice.position, 5);
  assert.equal(book.lastSongId, null);
});

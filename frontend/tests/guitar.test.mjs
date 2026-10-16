import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGuitarShape,
  guitarStrings,
} from "../src/features/guitar/model/guitar.ts";
import { pitchClassForNote } from "../src/utils/musicTheory.ts";
const chord = (label, root, notes) => ({
  id: label,
  label,
  root,
  quality: "",
  tones: notes.map((note) => ({ note, role: "root" })),
  startSeconds: 0,
  endSeconds: 4,
});
test("open mode gives a compact F without silently choosing a full barre", () => {
  const shape = getGuitarShape(chord("F", "F", ["F", "A", "C"]), "open", 0);
  assert.equal(shape.playable, true);
  assert.equal(shape.mode, "open");
  assert.equal(shape.barreFret, undefined);
});
test("every sounded note belongs to the exact chord, including altered chords", () => {
  for (const c of [
    chord("Esus2", "E", ["E", "F#", "B"]),
    chord("C7b9", "C", ["C", "E", "G", "Bb", "Db"]),
    chord("Gdim", "G", ["G", "Bb", "Db"]),
  ]) {
    const shape = getGuitarShape(c, "barre", 0);
    if (!shape.playable) continue;
    const pcs = new Set(c.tones.map((t) => pitchClassForNote(t.note)));
    for (const pos of shape.positions)
      if (pos.note)
        assert.ok(
          pcs.has(pitchClassForNote(pos.note)),
          `${c.label}: unexpected ${pos.note}`,
        );
    for (const pc of pcs)
      assert.ok(
        shape.positions.some((p) => p.note && pitchClassForNote(p.note) === pc),
        `${c.label}: missing tone ${pc}`,
      );
  }
});
test("slash chord preserves the requested bass", () => {
  const c = chord("C/E", "C", ["C", "E", "G"]);
  const shape = getGuitarShape(c, "open", 0);
  assert.equal(shape.playable, true);
  const lowest = [...shape.positions].reverse().find((p) => p.fret !== "x");
  assert.equal(pitchClassForNote(lowest.note), pitchClassForNote("E"));
});
test("muted strings have no assigned finger and fretted positions use at most four fingers", () => {
  for (const c of [
    chord("C", "C", ["C", "E", "G"]),
    chord("Bm", "B", ["B", "D", "F#"]),
  ])
    for (const mode of ["open", "barre"]) {
      const s = getGuitarShape(c, mode, 0);
      assert.equal(s.positions.length, guitarStrings.length);
      for (const p of s.positions)
        if (p.fret === "x" || p.fret === 0) assert.equal(p.finger, undefined);
      assert.ok(
        new Set(s.positions.filter((p) => p.finger).map((p) => p.finger))
          .size <= 4,
      );
    }
});

import type { ChordSegment } from "../../types/music";

/** Preserve explicit silence and gaps instead of inventing a held chord. */
export function chordContext(chords: ChordSegment[], time: number) {
  const current =
    chords.find((c) => time >= c.startSeconds && time < c.endSeconds) ?? null;
  const previous =
    [...chords]
      .reverse()
      .find(
        (c) =>
          c.endSeconds <= (current?.startSeconds ?? time) && c.label !== "N",
      ) ?? null;
  const next =
    chords.find(
      (c) =>
        c.startSeconds >= (current?.endSeconds ?? time) &&
        c !== current &&
        c.label !== "N",
    ) ?? null;
  return { previous, current, next };
}

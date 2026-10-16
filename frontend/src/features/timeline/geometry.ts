import type { ChordSegment } from "../../types/music";
export const timelineZooms = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
export function followScroll(time: number, duration: number, width: number) {
  return Math.max(0, Math.min(width, (time / Math.max(1, duration)) * width));
}

export function timelineScale(chords: ChordSegment[], zoom = 1) {
  // Size the time axis around the narrowest label, not the full song length.
  return (
    Math.max(
      24,
      ...chords.map(
        (c) =>
          Math.max(64, c.label.length * 9 + 24) /
          Math.max(0.01, c.endSeconds - c.startSeconds),
      ),
    ) * zoom
  );
}

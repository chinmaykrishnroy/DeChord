import type { LoopRange } from "../../types/music";
/** Resolve an audio-clock sample before applying end-of-track stop behavior. */
export function playbackPosition(
  time: number,
  duration: number,
  loop?: LoopRange | null,
) {
  const start = Math.max(0, loop?.startSeconds ?? 0),
    end = Math.min(duration, loop?.endSeconds ?? duration);
  if (loop && end > start && time >= end)
    return {
      time: start + ((time - end) % (end - start)),
      looped: true,
      ended: false,
    };
  return {
    time: Math.max(0, Math.min(duration, time)),
    looped: false,
    ended: time >= duration,
  };
}

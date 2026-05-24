import type { ChordSegment } from "../../types/music";
import { formatTime } from "../../utils/time";

interface TimelineProps {
  chords: ChordSegment[];
  currentTimeSeconds: number;
  durationSeconds: number;
  onSeek: (timeSeconds: number) => void;
}

export function Timeline({ chords, currentTimeSeconds, durationSeconds, onSeek }: TimelineProps) {
  const progressPercent = durationSeconds > 0 ? (currentTimeSeconds / durationSeconds) * 100 : 0;

  return (
    <section className="timeline-panel" aria-label="Chord timeline">
      <div className="timeline-panel__header">
        <div>
          <span>Timeline</span>
          <strong>Chord map preview</strong>
        </div>
        <small>
          {formatTime(currentTimeSeconds)} / {formatTime(durationSeconds)}
        </small>
      </div>

      <div className="timeline-track">
        <div className="timeline-track__progress" style={{ width: `${progressPercent}%` }} />
        <div className="timeline-track__cursor" style={{ left: `${progressPercent}%` }} />
        {chords.length === 0 && (
          <div className="timeline-empty">Timeline appears after the first chord batch.</div>
        )}
        {chords.map((chord) => {
          const widthPercent =
            ((chord.endSeconds - chord.startSeconds) / durationSeconds) * 100;
          return (
            <button
              className="timeline-segment"
              key={chord.id}
              onClick={() => onSeek(chord.startSeconds)}
              style={{ width: `${widthPercent}%` }}
              title={`${chord.label} ${formatTime(chord.startSeconds)}-${formatTime(chord.endSeconds)}`}
              type="button"
            >
              <span>{chord.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

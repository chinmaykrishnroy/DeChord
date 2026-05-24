import type { ChordSegment } from "../../types/music";

interface ChordFocusProps {
  chords: ChordSegment[];
  currentIndex: number;
}

export function ChordFocus({ chords, currentIndex }: ChordFocusProps) {
  if (chords.length === 0) {
    return (
      <section className="chord-focus chord-focus--empty" aria-label="Chord queue">
        <div className="chord-focus__label">
          <span>Chord queue</span>
          <strong>Waiting for analysis</strong>
        </div>
        <div className="chord-focus__rail">
          <div className="chord-tile chord-tile--current">
            <span>Pending</span>
            <strong>Ready soon</strong>
          </div>
        </div>
      </section>
    );
  }

  const startIndex = Math.min(Math.max(currentIndex - 2, 0), Math.max(chords.length - 7, 0));
  const visibleChords = Array.from({ length: 7 }, (_, offset) => {
    const index = startIndex + offset;
    return { chord: chords[index], index };
  }).filter((entry): entry is { chord: ChordSegment; index: number } => Boolean(entry.chord));

  return (
    <section className="chord-focus" aria-label="Chord queue">
      <div className="chord-focus__label">
        <span>Chord queue</span>
        <strong>Previous / now / next</strong>
      </div>
      <div className="chord-focus__rail">
        {visibleChords.map(({ chord, index }) => {
          const stateClass = index === currentIndex ? "current" : index < currentIndex ? "previous" : "next";

          return (
            <button
              className={`chord-tile chord-tile--${stateClass}`}
              key={chord.id}
              type="button"
            >
              <span>{index === currentIndex ? "Now" : index < currentIndex ? "Prev" : "Next"}</span>
              <strong>{chord.label}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

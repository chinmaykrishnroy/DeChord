import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { ChordSegment } from "../../types/music";
import { formatTime } from "../../utils/time";
export function ChordSheet({
  chords,
  time,
  onSeek,
  onCorrect,
  canEdit,
}: {
  chords: ChordSegment[];
  time: number;
  onSeek: (n: number) => void;
  onCorrect: (s: number, e: number, l: string) => Promise<void>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [label, setLabel] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function save(c: ChordSegment) {
    if (!/^[A-G](?:#|b)?[^\s]*$|^N$/.test(label)) {
      setError("Enter a chord such as C, Am7, F#dim or C/E.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onCorrect(c.startSeconds, c.endSeconds, label);
      setEditing(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="chord-sheet">
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-heading">
        <span>Time</span>
        <span>Chord</span>
        <span>Notes</span>
        <span />
      </div>
      {chords.map((c) => (
        <div
          key={c.id}
          className={`sheet-row ${time >= c.startSeconds && time < c.endSeconds ? "is-current" : ""}`}
        >
          <button
            className="text-button"
            onClick={() => onSeek(c.startSeconds)}
          >
            {formatTime(c.startSeconds)}
          </button>
          {editing === c.id ? (
            <input
              aria-label="Edit chord label"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save(c);
                if (e.key === "Escape") setEditing(null);
              }}
            />
          ) : (
            <strong>{c.label}</strong>
          )}
          <small>{c.tones.map((t) => t.note).join(" · ")}</small>
          <div>
            {editing === c.id ? (
              <>
                <button
                  className="icon-button"
                  disabled={saving}
                  aria-label="Save chord correction"
                  onClick={() => void save(c)}
                >
                  <Check size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Cancel correction"
                  onClick={() => setEditing(null)}
                >
                  <X size={15} />
                </button>
              </>
            ) : (
              <button
                className="icon-button"
                disabled={!canEdit}
                title={
                  canEdit
                    ? "Edit chord"
                    : "Import a song and reset transpose to edit"
                }
                aria-label={`Edit ${c.label} at ${formatTime(c.startSeconds)}`}
                onClick={() => {
                  setEditing(c.id);
                  setLabel(c.label);
                }}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {!chords.length && (
        <div className="empty-state">
          <strong>No chords yet</strong>
          <p>Your analysis will fill this sheet as it runs.</p>
        </div>
      )}
    </div>
  );
}

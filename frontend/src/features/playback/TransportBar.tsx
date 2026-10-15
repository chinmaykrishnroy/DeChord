import { Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";

import type { PlaybackState } from "../../types/music";
import { formatTime } from "../../utils/time";
import { useEffect, useRef, useState } from "react";
import { controlValue, tempoBounds } from "./controls";

function EditableValue({
  value,
  reset,
  min,
  max,
  unit,
  label,
  disabled,
  integer,
  onCommit,
}: {
  value: number;
  reset: number;
  min: number;
  max: number;
  unit: string;
  label: string;
  disabled: boolean;
  integer?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null),
    cancelled = useRef(false),
    input = useRef<HTMLInputElement>(null);
  const editing = draft !== null;
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  return (
    <input
      ref={input}
      className="transport-value"
      aria-label={label}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      disabled={disabled}
      title={`Type a value (${min}–${max}); double-click to reset`}
      value={draft ?? `${Number(value.toFixed(1))} ${unit}`}
      onFocus={(event) => {
        setDraft(String(Number(value.toFixed(1))));
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (!cancelled.current && draft !== null)
          onCommit(controlValue(draft, value, min, max, integer));
        cancelled.current = false;
        setDraft(null);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        onCommit(reset);
        setDraft(String(Number(reset.toFixed(1))));
        event.currentTarget.select();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface TransportBarProps {
  playback: PlaybackState;
  disabled?: boolean;
  baseTempoBpm: number | null;
  tempoOffsetBpm: number;
  trackVolume: number;
  transposeSemitones: number;
  onTogglePlayback: () => void;
  onSeek: (timeSeconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onTempoOffsetChange: (offsetBpm: number) => void;
  onTrackVolumeChange: (volume: number) => void;
  onTransposeChange: (semitones: number) => void;
}

export function TransportBar({
  playback,
  disabled = false,
  baseTempoBpm,
  tempoOffsetBpm,
  trackVolume,
  transposeSemitones,
  onTogglePlayback,
  onSeek,
  onSkip,
  onTempoOffsetChange,
  onTrackVolumeChange,
  onTransposeChange,
}: TransportBarProps) {
  const tempoReady = baseTempoBpm !== null;
  const bounds = tempoBounds(baseTempoBpm ?? 100);
  const targetTempo =
    baseTempoBpm === null
      ? 0
      : Math.max(
          bounds.min,
          Math.min(bounds.max, baseTempoBpm + tempoOffsetBpm),
        );
  const setTempo = (value: number) =>
    onTempoOffsetChange(
      Math.max(bounds.min, Math.min(bounds.max, value)) - (baseTempoBpm ?? 100),
    );

  return (
    <footer
      className={
        disabled ? "transport-bar transport-bar--disabled" : "transport-bar"
      }
      aria-label="Playback controls"
    >
      <div className="transport-bar__cluster">
        <button
          type="button"
          aria-label="Skip backward"
          disabled={disabled}
          onClick={() => onSkip(-10)}
        >
          <RotateCcw size={18} />
        </button>
        <button
          className="transport-bar__play"
          type="button"
          aria-label={playback.isPlaying ? "Pause" : "Play"}
          disabled={disabled}
          onClick={onTogglePlayback}
        >
          {playback.isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button
          type="button"
          aria-label="Skip forward"
          disabled={disabled}
          onClick={() => onSkip(10)}
        >
          <RotateCw size={18} />
        </button>
      </div>

      <div className="transport-bar__time transport-bar__time--current">
        {formatTime(playback.currentTimeSeconds)}
      </div>
      <input
        aria-label="Playback position"
        className="transport-slider"
        disabled={disabled}
        max={playback.durationSeconds}
        min={0}
        onChange={(event) => onSeek(Number(event.target.value))}
        step={0.25}
        type="range"
        value={playback.currentTimeSeconds}
      />
      <div className="transport-bar__time transport-bar__time--duration">
        {formatTime(playback.durationSeconds)}
      </div>

      <div className="transport-bar__tools">
        <div className="stepper-control" aria-label="Tempo control">
          <button
            disabled={!tempoReady}
            aria-label="Decrease tempo"
            onClick={() => setTempo(targetTempo - 5)}
            type="button"
          >
            &lt;
          </button>
          {tempoReady ? (
            <EditableValue
              value={targetTempo}
              reset={baseTempoBpm!}
              min={bounds.min}
              max={bounds.max}
              unit="BPM"
              label="Tempo BPM"
              disabled={false}
              onCommit={setTempo}
            />
          ) : (
            <span>Tempo pending</span>
          )}
          <button
            disabled={!tempoReady}
            aria-label="Increase tempo"
            onClick={() => setTempo(targetTempo + 5)}
            type="button"
          >
            &gt;
          </button>
        </div>
        <div className="stepper-control" aria-label="Transpose control">
          <button
            disabled={disabled}
            onClick={() =>
              onTransposeChange(Math.max(-12, transposeSemitones - 1))
            }
            type="button"
          >
            -
          </button>
          <EditableValue
            value={transposeSemitones}
            reset={0}
            min={-12}
            max={12}
            unit="st"
            label="Transpose semitones"
            disabled={disabled}
            integer
            onCommit={onTransposeChange}
          />
          <button
            disabled={disabled}
            onClick={() =>
              onTransposeChange(Math.min(12, transposeSemitones + 1))
            }
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="transport-bar__volume">
        <Volume2 size={18} />
        <input
          aria-label="Track volume"
          className="volume-slider"
          max={1}
          min={0}
          onChange={(event) => onTrackVolumeChange(Number(event.target.value))}
          step={0.01}
          type="range"
          value={trackVolume}
        />
      </div>
    </footer>
  );
}

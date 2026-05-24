import { Pause, Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";

import type { PlaybackState } from "../../types/music";
import { formatTime } from "../../utils/time";

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
  const targetTempo = tempoReady ? Math.max(30, Math.round(baseTempoBpm + tempoOffsetBpm)) : null;

  return (
    <footer
      className={disabled ? "transport-bar transport-bar--disabled" : "transport-bar"}
      aria-label="Playback controls"
    >
      <div className="transport-bar__cluster">
        <button type="button" aria-label="Skip backward" disabled={disabled} onClick={() => onSkip(-10)}>
          <RotateCcw size={18} />
        </button>
        <button
          className="transport-bar__play"
          type="button"
          aria-label={playback.isPlaying ? "Pause preview" : "Play preview"}
          disabled={disabled}
          onClick={onTogglePlayback}
        >
          {playback.isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button type="button" aria-label="Skip forward" disabled={disabled} onClick={() => onSkip(10)}>
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
            onClick={() => onTempoOffsetChange(Math.max(-80, tempoOffsetBpm - 5))}
            type="button"
          >
            &lt;
          </button>
          <span>{tempoReady ? `${targetTempo} BPM` : "Tempo pending"}</span>
          <button
            disabled={!tempoReady}
            onClick={() => onTempoOffsetChange(Math.min(80, tempoOffsetBpm + 5))}
            type="button"
          >
            &gt;
          </button>
        </div>
        <div className="stepper-control" aria-label="Transpose control">
          <button
            disabled={disabled}
            onClick={() => onTransposeChange(Math.max(-12, transposeSemitones - 1))}
            type="button"
          >
            -
          </button>
          <span>{transposeSemitones > 0 ? `+${transposeSemitones}` : transposeSemitones} st</span>
          <button
            disabled={disabled}
            onClick={() => onTransposeChange(Math.min(12, transposeSemitones + 1))}
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

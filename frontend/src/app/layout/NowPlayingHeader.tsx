import { useRef, type ChangeEvent } from "react";
import { Gauge, KeyRound, Music2, RefreshCw, SlidersHorizontal, Upload } from "lucide-react";

import type { AnalysisSummary, ChordSegment, SongSummary } from "../../types/music";
import { getChordToneNotes } from "../../utils/chordNames";
import type { useBackendWorkspace } from "../../features/workspace/useBackendWorkspace";

interface NowPlayingHeaderProps {
  song: SongSummary;
  analysis: AnalysisSummary;
  currentChord: ChordSegment;
  currentTimeSeconds: number;
  backendWorkspace: ReturnType<typeof useBackendWorkspace>;
  onOpenSettings: () => void;
}

export function NowPlayingHeader({
  song,
  analysis,
  currentChord,
  currentTimeSeconds,
  backendWorkspace,
  onOpenSettings,
}: NowPlayingHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isBusy =
    backendWorkspace.workStatus === "uploading" ||
    backendWorkspace.workStatus === "queued" ||
    backendWorkspace.workStatus === "analyzing";
  const statusLabel =
    backendWorkspace.connectionStatus === "offline"
      ? "Backend offline"
      : backendWorkspace.usingMock
        ? "Preview data"
        : backendWorkspace.workStatus;
  const tempoLabel = analysis.tempoBpm ? `${Math.round(analysis.tempoBpm)} BPM` : "Tempo pending";
  const chordNotes = getChordToneNotes(currentChord);
  const chordDuration = Math.max(0, currentChord.endSeconds - currentChord.startSeconds);
  const chordRemaining =
    chordDuration > 0
      ? Math.max(0, Math.min(1, (currentChord.endSeconds - currentTimeSeconds) / chordDuration))
      : 0;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (file) {
      void backendWorkspace.uploadAndAnalyze(file);
    }
    event.target.value = "";
  }

  return (
    <section className="now-playing" aria-label="Current song and chord">
      <div className="song-identity">
        <div className="song-cover" aria-hidden="true">
          <Music2 size={28} />
        </div>
        <div>
          <span>Now playing</span>
          <strong>{song.title}</strong>
          <small>{song.artist} · {statusLabel}</small>
        </div>
        <input
          accept="audio/*"
          className="visually-hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="song-import-button"
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload size={16} />
          {isBusy ? "Working" : "Import"}
        </button>
      </div>

      <div className="current-chord-card">
        <span>Current chord</span>
        <strong>{currentChord.label}</strong>
        <small>{chordNotes ? `${currentChord.quality} / ${chordNotes}` : currentChord.quality}</small>
        <div className="current-chord-card__meter" aria-hidden="true">
          <i style={{ transform: `scaleX(${chordRemaining})` }} />
        </div>
      </div>

      <div className="session-stats" aria-label="Analysis snapshot">
        <div>
          <KeyRound size={18} />
          <span>{analysis.key}</span>
        </div>
        <div>
          <Gauge size={18} />
          <span>{tempoLabel}</span>
        </div>
      </div>

      {backendWorkspace.connectionStatus === "offline" ? (
        <button
          className="settings-button settings-button--status"
          type="button"
          onClick={backendWorkspace.refreshHealth}
          aria-label="Reconnect backend"
        >
          <RefreshCw size={18} />
          Reconnect
        </button>
      ) : (
      <button className="settings-button" type="button" onClick={onOpenSettings} aria-label="Open settings">
        <SlidersHorizontal size={18} />
        Theme
      </button>
      )}
    </section>
  );
}

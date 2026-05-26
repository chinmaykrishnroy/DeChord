import { useRef, type ChangeEvent } from "react";
import { Metronome, Music2, Piano, RefreshCw, Upload } from "lucide-react";

import type { AnalysisSummary, ChordSegment, SongSummary } from "../../types/music";
import { getChordToneNotes } from "../../utils/chordNames";
import type { useBackendWorkspace } from "../../features/workspace/useBackendWorkspace";

interface NowPlayingHeaderProps {
  song: SongSummary;
  analysis: AnalysisSummary;
  currentChord: ChordSegment;
  currentTimeSeconds: number;
  backendWorkspace: ReturnType<typeof useBackendWorkspace>;
}

export function NowPlayingHeader({
  song,
  analysis,
  currentChord,
  currentTimeSeconds,
  backendWorkspace,
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
        <div className={backendWorkspace.albumArtUrl ? "song-cover song-cover--art" : "song-cover"} aria-hidden="true">
          {backendWorkspace.albumArtUrl ? (
            <img src={backendWorkspace.albumArtUrl} alt="" />
          ) : (
            <Music2 size={24} />
          )}
        </div>
        <div>
          <span>Now playing</span>
          <strong>{song.title}</strong>
          <small>{song.artist} - {statusLabel}</small>
          <div className="song-progress" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.max(0.02, backendWorkspace.progress)})` }} />
          </div>
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
          <Upload size={15} />
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
          <Piano size={17} />
          <span>{analysis.key}</span>
        </div>
        <div>
          <Metronome size={17} />
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
          <RefreshCw size={17} />
          Reconnect
        </button>
      ) : null}
    </section>
  );
}

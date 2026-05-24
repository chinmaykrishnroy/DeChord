import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Guitar, Piano } from "lucide-react";

import { NowPlayingHeader } from "../../app/layout/NowPlayingHeader";
import type {
  AnalysisMode,
  CapoSuggestionMode,
  GuitarDisplayMode,
  InstrumentTab,
  SongWorkspace,
  ThemeSettings,
} from "../../types/music";
import type { useMockPlayback } from "../playback/useMockPlayback";
import { ChordFocus } from "../chords/ChordFocus";
import { GuitarPage } from "../guitar/components/GuitarPage";
import { getGuitarShape, suggestCapo } from "../guitar/model/guitar";
import {
  notesForFallbackGuitarChord,
  notesForPianoChord,
  useInstrumentSampler,
} from "../instruments/useInstrumentSampler";
import { PianoPage } from "../piano/components/PianoPage";
import { Timeline } from "../timeline/Timeline";
import { TransportBar } from "../playback/TransportBar";
import { SettingsPanel } from "./SettingsPanel";
import type { useBackendWorkspace } from "./useBackendWorkspace";

interface WorkspaceViewProps {
  workspace: SongWorkspace;
  backendWorkspace: ReturnType<typeof useBackendWorkspace>;
  playbackController: ReturnType<typeof useMockPlayback>;
  settingsOpen: boolean;
  themeSettings: ThemeSettings;
  onThemeSettingsChange: (settings: ThemeSettings) => void;
  tempoOffsetBpm: number;
  trackVolume: number;
  transposeSemitones: number;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onTempoOffsetChange: (offsetBpm: number) => void;
  onTrackVolumeChange: (volume: number) => void;
  onTransposeChange: (semitones: number) => void;
}

const tabs: Array<{ id: InstrumentTab; label: string; icon: typeof Guitar }> = [
  { id: "guitar", label: "Guitar", icon: Guitar },
  { id: "piano", label: "Piano", icon: Piano },
];

export function WorkspaceView({
  workspace,
  backendWorkspace,
  playbackController,
  settingsOpen,
  themeSettings,
  onThemeSettingsChange,
  tempoOffsetBpm,
  trackVolume,
  transposeSemitones,
  onOpenSettings,
  onCloseSettings,
  onTempoOffsetChange,
  onTrackVolumeChange,
  onTransposeChange,
}: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<InstrumentTab>(() =>
    window.location.hash === "#piano" ? "piano" : "guitar",
  );
  const [guitarMode, setGuitarMode] = useState<GuitarDisplayMode>("open");
  const [capoMode, setCapoMode] = useState<CapoSuggestionMode>("balanced");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const currentChord = playbackController.currentChord;
  const capoSuggestion = useMemo(
    () => suggestCapo(workspace.chords, capoMode),
    [capoMode, workspace.chords],
  );
  const guitarShape = useMemo(
    () => getGuitarShape(currentChord, guitarMode, capoSuggestion.capo),
    [capoSuggestion.capo, currentChord, guitarMode],
  );
  const instrumentSampler = useInstrumentSampler(themeSettings.instrumentSoundsEnabled);
  const playGuitarNote = useCallback(
    (note: string, octave?: number) => instrumentSampler.playNote("guitar", note, octave),
    [instrumentSampler],
  );
  const playPianoNote = useCallback(
    (note: string, octave?: number) => instrumentSampler.playNote("piano", note, octave),
    [instrumentSampler],
  );
  const activeChordNotes = useMemo(() => {
    if (activeTab === "piano") {
      return notesForPianoChord(currentChord);
    }

    const shapeNotes = guitarShape.positions
      .filter((position) => position.note && position.octave !== undefined)
      .map((position, index) => ({
        note: position.note as string,
        octave: position.octave as number,
        delaySeconds: index * 0.018,
      }));
    return shapeNotes.length > 0 ? shapeNotes : notesForFallbackGuitarChord(currentChord);
  }, [activeTab, currentChord, guitarShape.positions]);

  useEffect(() => {
    if (
      !themeSettings.instrumentSoundsEnabled ||
      !playbackController.playback.isPlaying ||
      currentChord.label === "N" ||
      activeChordNotes.length === 0
    ) {
      instrumentSampler.releaseActiveChord(0.08);
      return undefined;
    }

    instrumentSampler.playChord(activeTab, activeChordNotes);
    return () => instrumentSampler.releaseActiveChord(0.08);
  }, [
    activeChordNotes,
    activeTab,
    currentChord.label,
    instrumentSampler,
    playbackController.currentChordIndex,
    playbackController.playback.isPlaying,
    themeSettings.instrumentSoundsEnabled,
  ]);

  function handleModeChange(nextMode: AnalysisMode) {
    backendWorkspace.setMode(nextMode);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    const [file] = Array.from(event.dataTransfer.files).filter((candidate) =>
      candidate.type.startsWith("audio/"),
    );
    if (file) {
      void backendWorkspace.uploadAndAnalyze(file);
    }
  }

  return (
    <main
      className={isDraggingFile ? "workspace workspace--dragging" : "workspace"}
      onDragLeave={() => setIsDraggingFile(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingFile(true);
      }}
      onDrop={handleDrop}
    >
      <NowPlayingHeader
        analysis={workspace.analysis}
        backendWorkspace={backendWorkspace}
        currentChord={currentChord}
        currentTimeSeconds={playbackController.playback.currentTimeSeconds}
        onOpenSettings={onOpenSettings}
        song={workspace.song}
      />

      <section className="workspace-grid">
        <div className="workspace-main">
          <ChordFocus
            chords={workspace.chords}
            currentIndex={playbackController.currentChordIndex}
          />

          <div className="instrument-header">
            <div>
              <span>Instrument</span>
              <strong>{activeTab === "guitar" ? "Fretboard" : "Keyboard"}</strong>
            </div>

            <div className="tab-switcher" role="tablist" aria-label="Instrument tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    aria-selected={activeTab === tab.id}
                    className={activeTab === tab.id ? "tab-switcher__tab active" : "tab-switcher__tab"}
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      window.history.replaceState(null, "", `#${tab.id}`);
                    }}
                    role="tab"
                    type="button"
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="instrument-stage">
            {activeTab === "guitar" ? (
              <GuitarPage
                capoSuggestion={capoSuggestion}
                capoMode={capoMode}
                currentChord={currentChord}
                mode={guitarMode}
                onCapoModeChange={setCapoMode}
                onNotePreview={playGuitarNote}
                onModeChange={setGuitarMode}
                shape={guitarShape}
                soundEnabled={themeSettings.instrumentSoundsEnabled}
              />
            ) : (
              <PianoPage
                currentChord={currentChord}
                onNotePreview={playPianoNote}
                soundEnabled={themeSettings.instrumentSoundsEnabled}
              />
            )}
          </div>
        </div>

        <aside className="practice-panel" aria-label="Practice controls">
          <div className="practice-card practice-card--analysis">
            <span>Analysis mode</span>
            <select
              aria-label="Analysis mode"
              disabled={backendWorkspace.workStatus === "uploading" || backendWorkspace.workStatus === "analyzing"}
              onChange={(event) => handleModeChange(event.target.value as AnalysisMode)}
              value={backendWorkspace.mode}
            >
              <option value="full_song">Full song</option>
              <option value="batched">Batched</option>
              <option value="preview">Preview</option>
            </select>
            {backendWorkspace.mode === "batched" && (
              <label>
                <span>Batch seconds</span>
                <input
                  max={90}
                  min={5}
                  onChange={(event) => backendWorkspace.setBatchSeconds(Number(event.target.value))}
                  step={5}
                  type="range"
                  value={backendWorkspace.batchSeconds}
                />
                <small>{backendWorkspace.batchSeconds}s windows</small>
              </label>
            )}
          </div>
          <div className="practice-card practice-card--capo">
            <span>Capo suggestion</span>
            <strong>Capo {capoSuggestion.capo}</strong>
            <small>
              {capoSuggestion.easyCount} easy, {capoSuggestion.hardCount} hard,
              {" "}
              {capoSuggestion.impossibleCount} unsupported.
            </small>
            <div className="segmented-control segmented-control--compact" role="group" aria-label="Capo scoring mode">
              <button
                className={capoMode === "balanced" ? "active" : ""}
                onClick={() => setCapoMode("balanced")}
                type="button"
              >
                Reasonable
              </button>
              <button
                className={capoMode === "easy" ? "active" : ""}
                onClick={() => setCapoMode("easy")}
                type="button"
              >
                Very easy
              </button>
            </div>
            <div className="capo-difficulty-list" aria-label="Hardest chord checks">
              {capoSuggestion.chordDifficulties
                .filter((entry) => !entry.playable || entry.difficulty >= 3.4)
                .slice(0, 3)
                .map((entry) => (
                  <small key={`${entry.chord}-${entry.playedShape}-${entry.fret}`}>
                    {entry.chord}: {entry.playable ? `${entry.label}, ${entry.difficulty.toFixed(1)}/5` : "unsupported"}
                  </small>
                ))}
            </div>
          </div>
          <div className="practice-card">
            <span>Practice</span>
            <button type="button">Loop section</button>
            <button type="button">Transpose</button>
            <button type="button">Export chart</button>
          </div>
        </aside>
      </section>

      <Timeline
        chords={workspace.chords}
        currentTimeSeconds={playbackController.playback.currentTimeSeconds}
        durationSeconds={workspace.song.durationSeconds}
        onSeek={playbackController.seek}
      />

      <TransportBar
        baseTempoBpm={backendWorkspace.usingMock ? null : backendWorkspace.workspace.analysis.tempoBpm}
        disabled={!backendWorkspace.hasAnalysis}
        playback={playbackController.playback}
        tempoOffsetBpm={tempoOffsetBpm}
        trackVolume={trackVolume}
        transposeSemitones={transposeSemitones}
        onTempoOffsetChange={onTempoOffsetChange}
        onSeek={playbackController.seek}
        onSkip={playbackController.skipBy}
        onTrackVolumeChange={onTrackVolumeChange}
        onTogglePlayback={playbackController.togglePlayback}
        onTransposeChange={onTransposeChange}
      />

      <SettingsPanel
        onChange={onThemeSettingsChange}
        onClose={onCloseSettings}
        open={settingsOpen}
        settings={themeSettings}
      />

      {isDraggingFile && (
        <div className="drop-overlay" aria-hidden="true">
          Drop audio to analyze
        </div>
      )}
    </main>
  );
}

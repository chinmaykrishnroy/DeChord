import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { Download, FileText, Guitar, Piano, Search } from "lucide-react";

import { NowPlayingHeader } from "../../app/layout/NowPlayingHeader";
import type {
  AnalysisMode,
  CapoSuggestionMode,
  GuitarDisplayMode,
  InstrumentTab,
  LoopRange,
  SongWorkspace,
  ThemeSettings,
  WorkspacePanel,
} from "../../types/music";
import { extractLyricsPalette, getFallbackLyricsPalette, type LyricsPalette } from "../../utils/colorPalette";
import type { useMockPlayback } from "../playback/useMockPlayback";
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
  activePanel: WorkspacePanel;
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
  activePanel,
}: WorkspaceViewProps) {
  const [activeTab, setActiveTab] = useState<InstrumentTab>(() =>
    window.location.hash === "#piano" ? "piano" : "guitar",
  );
  const [guitarMode, setGuitarMode] = useState<GuitarDisplayMode>("open");
  const [capoMode, setCapoMode] = useState<CapoSuggestionMode>("balanced");
  const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [lyricsPalette, setLyricsPalette] = useState<LyricsPalette>(getFallbackLyricsPalette);
  const lyricsInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsPanelRef = useRef<HTMLDivElement | null>(null);
  const lyricsLineRefs = useRef(new Map<string, HTMLElement>());
  const lyricsSyncPausedRef = useRef(false);
  const lyricsAutoScrollingRef = useRef(false);
  const lyricsResumeTimerRef = useRef<number | null>(null);
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
  const activeLyricsIndex = useMemo(() => {
    if (!backendWorkspace.lyrics.synced) {
      return -1;
    }

    let index = -1;
    for (let lineIndex = 0; lineIndex < backendWorkspace.lyrics.lines.length; lineIndex += 1) {
      const line = backendWorkspace.lyrics.lines[lineIndex];
      if (line.timeSeconds === null || !line.text.trim()) {
        continue;
      }
      if (line.timeSeconds <= playbackController.playback.currentTimeSeconds + 0.08) {
        index = lineIndex;
      } else {
        break;
      }
    }
    return index;
  }, [
    backendWorkspace.lyrics.lines,
    backendWorkspace.lyrics.synced,
    playbackController.playback.currentTimeSeconds,
  ]);
  const lyricsStyle = useMemo(
    () =>
      ({
        "--lyrics-bg": lyricsPalette.background,
        "--lyrics-fg": lyricsPalette.foreground,
        "--lyrics-muted": lyricsPalette.muted,
        "--lyrics-accent": lyricsPalette.accent,
        "--lyrics-shadow": lyricsPalette.shadow,
      }) as CSSProperties,
    [lyricsPalette],
  );

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

  useEffect(() => {
    let cancelled = false;
    if (!backendWorkspace.albumArtUrl) {
      setLyricsPalette(getFallbackLyricsPalette());
      return undefined;
    }

    extractLyricsPalette(backendWorkspace.albumArtUrl)
      .then((palette) => {
        if (!cancelled) {
          setLyricsPalette(palette);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLyricsPalette(getFallbackLyricsPalette());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backendWorkspace.albumArtUrl]);

  useEffect(() => {
    if (activePanel !== "lyrics" || activeLyricsIndex < 0 || lyricsSyncPausedRef.current) {
      return;
    }

    const activeLine = backendWorkspace.lyrics.lines[activeLyricsIndex];
    const lineNode = activeLine ? lyricsLineRefs.current.get(activeLine.id) : null;
    if (lineNode) {
      lyricsAutoScrollingRef.current = true;
      lineNode.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        lyricsAutoScrollingRef.current = false;
      }, 650);
    }
  }, [activeLyricsIndex, activePanel, backendWorkspace.lyrics.lines]);

  useEffect(() => {
    if (
      loopRange &&
      playbackController.playback.isPlaying &&
      playbackController.playback.currentTimeSeconds >= loopRange.endSeconds - 0.08
    ) {
      playbackController.seek(loopRange.startSeconds);
    }
  }, [
    loopRange,
    playbackController,
    playbackController.playback.currentTimeSeconds,
    playbackController.playback.isPlaying,
  ]);

  useEffect(
    () => () => {
      if (lyricsResumeTimerRef.current !== null) {
        window.clearTimeout(lyricsResumeTimerRef.current);
      }
    },
    [],
  );

  function handleModeChange(nextMode: AnalysisMode) {
    backendWorkspace.setMode(nextMode);
  }

  function isAudioFile(file: File) {
    return file.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name);
  }

  function isLyricsFile(file: File) {
    return (
      file.type.startsWith("text/") ||
      /\.(lrc|txt|lyrics)$/i.test(file.name)
    );
  }

  async function handleLyricsFile(file: File) {
    await backendWorkspace.importLyricsFile(file);
  }

  const handleDroppedFiles = useCallback(
    (files: File[]) => {
      const lyricsFile = files.find(isLyricsFile);
      if (lyricsFile) {
        void handleLyricsFile(lyricsFile);
        return;
      }

      const audioFile = files.find(isAudioFile);
      if (audioFile) {
        void backendWorkspace.uploadAndAnalyze(audioFile);
      }
    },
    [backendWorkspace],
  );

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    handleDroppedFiles(Array.from(event.dataTransfer.files));
  }

  function handleLyricsDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(true);
  }

  function handleLyricsDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
    handleDroppedFiles(Array.from(event.dataTransfer.files));
  }

  function exportTextChart() {
    const rows = [
      `DeChord chart: ${workspace.song.title}`,
      `Artist: ${workspace.song.artist}`,
      `Key: ${workspace.analysis.key}`,
      `Tempo: ${workspace.analysis.tempoBpm ? `${Math.round(workspace.analysis.tempoBpm)} BPM` : "pending"}`,
      "",
      "Start\tEnd\tChord\tQuality\tNotes",
      ...workspace.chords.map((chord) => {
        const notes = chord.tones.map((tone) => tone.note).join(" ");
        return `${chord.startSeconds.toFixed(3)}\t${chord.endSeconds.toFixed(3)}\t${chord.label}\t${chord.quality}\t${notes}`;
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.song.title.replace(/[^A-Za-z0-9._-]+/g, "-") || "dechord"}-chords.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleLyricsScroll() {
    if (activePanel !== "lyrics" || !backendWorkspace.lyrics.synced) {
      return;
    }
    if (lyricsAutoScrollingRef.current) {
      return;
    }

    lyricsSyncPausedRef.current = true;
    if (lyricsResumeTimerRef.current !== null) {
      window.clearTimeout(lyricsResumeTimerRef.current);
    }

    lyricsResumeTimerRef.current = window.setTimeout(() => {
      lyricsSyncPausedRef.current = false;
      const activeLine = backendWorkspace.lyrics.lines[activeLyricsIndex];
      const lineNode = activeLine ? lyricsLineRefs.current.get(activeLine.id) : null;
      lineNode?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 2800);
  }

  function setLyricsLineRef(id: string, node: HTMLElement | null) {
    if (node) {
      lyricsLineRefs.current.set(id, node);
    } else {
      lyricsLineRefs.current.delete(id);
    }
  }

  function getLyricsLineClass(index: number, text: string, size: "compact" | "large") {
    const classes = ["lyrics-line"];
    if (size === "large") {
      classes.push("lyrics-line--large");
    }
    if (!text.trim()) {
      classes.push("lyrics-line--spacer");
    }
    if (index === activeLyricsIndex) {
      classes.push("lyrics-line--active");
    } else if (activeLyricsIndex >= 0 && index < activeLyricsIndex) {
      classes.push("lyrics-line--past");
    }
    return classes.join(" ");
  }

  function handleLyricsLineSeek(timeSeconds: number | null) {
    if (timeSeconds === null) {
      return;
    }
    lyricsSyncPausedRef.current = false;
    if (lyricsResumeTimerRef.current !== null) {
      window.clearTimeout(lyricsResumeTimerRef.current);
      lyricsResumeTimerRef.current = null;
    }
    playbackController.seek(timeSeconds);
  }

  function renderLyricsPanel(size: "compact" | "large") {
    const hasLyrics =
      backendWorkspace.lyrics.status === "ready" &&
      backendWorkspace.lyrics.lines.some((line) => line.text.trim());
    const hideChrome = size === "large" && hasLyrics;
    const cardClassName = [
      size === "large" ? "mode-card lyrics-card lyrics-card--large" : "side-card lyrics-card",
      hasLyrics ? "lyrics-card--ready" : "",
      isDraggingFile && size === "large" ? "lyrics-card--dragging" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <section
        className={cardClassName}
        onDragOver={handleLyricsDragOver}
        onDrop={handleLyricsDrop}
        style={size === "large" ? lyricsStyle : undefined}
      >
        {!hideChrome && (
          <div className="side-card__header">
            <div>
              <span>Lyrics</span>
              <strong>
                {backendWorkspace.lyrics.status === "ready"
                  ? backendWorkspace.lyrics.synced
                    ? "Synced lyrics"
                    : "Plain lyrics"
                  : "No lyrics yet"}
              </strong>
              {size === "large" && (
                <small>
                  {backendWorkspace.lyrics.synced
                    ? "Synced LRC - follows playback"
                    : "Plain lyrics"}
                </small>
              )}
            </div>
            <FileText size={17} />
          </div>
        )}
        <input
          accept=".lrc,.txt,text/plain"
          className="visually-hidden"
          onChange={(event) => {
            const [file] = Array.from(event.target.files ?? []);
            if (file) {
              void handleLyricsFile(file);
            }
            event.target.value = "";
          }}
          ref={lyricsInputRef}
          type="file"
        />
        {!hideChrome && (
          <div className="lyrics-actions">
            <button type="button" onClick={() => lyricsInputRef.current?.click()}>
              <FileText size={15} />
              Import lyrics
            </button>
            <button type="button" onClick={() => void backendWorkspace.downloadLyrics()}>
              <Search size={15} />
              Find online
            </button>
          </div>
        )}
        <div
          className={size === "large" ? "lyrics-panel lyrics-panel--large" : "lyrics-panel"}
          onDragOver={handleLyricsDragOver}
          onDrop={handleLyricsDrop}
          onScroll={size === "large" ? handleLyricsScroll : undefined}
          ref={size === "large" ? lyricsPanelRef : undefined}
        >
          {backendWorkspace.lyrics.status === "loading" && <p>Searching lyrics...</p>}
          {backendWorkspace.lyrics.status === "failed" && (
            <p>{backendWorkspace.lyrics.error ?? "Lyrics unavailable."}</p>
          )}
          {backendWorkspace.lyrics.status === "empty" && (
            <p>Drop an `.lrc` or `.txt` file, or use online search after importing a song.</p>
          )}
          {backendWorkspace.lyrics.status === "ready" &&
            backendWorkspace.lyrics.lines.map((line, index) => {
              const className = getLyricsLineClass(index, line.text, size);
              if (line.timeSeconds === null) {
                return (
                  <p
                    className={className}
                    key={line.id}
                    ref={(node) => setLyricsLineRef(line.id, node)}
                  >
                    {line.text}
                  </p>
                );
              }

              return (
                <button
                  aria-label={`Seek to lyric at ${line.timeSeconds.toFixed(1)} seconds`}
                  className={`${className} lyrics-line--seekable`}
                  key={line.id}
                  onClick={() => handleLyricsLineSeek(line.timeSeconds)}
                  ref={(node) => setLyricsLineRef(line.id, node)}
                  type="button"
                >
                  {line.text}
                </button>
              );
            })}
        </div>
      </section>
    );
  }

  function renderInstrumentSurface() {
    return (
      <>
        <div className="instrument-header">
          <div>
            <span>Studio</span>
            <strong>{activeTab === "guitar" ? "Guitar fretboard" : "Piano keyboard"}</strong>
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
      </>
    );
  }

  function renderAnalysisSurface() {
    return (
      <section className="mode-page mode-page--analysis" aria-label="Analysis workspace">
        <div className="mode-card analysis-hero">
          <div>
            <span>Analysis</span>
            <strong>{backendWorkspace.workStatus}</strong>
            <small>
              {backendWorkspace.usingMock
                ? "Import audio to run the local engine."
                : `${workspace.analysis.chordCount} chords - ${workspace.analysis.engine}`}
            </small>
          </div>
          <div className="analysis-percent">{Math.round(backendWorkspace.progress * 100)}%</div>
          <div className="analysis-progress" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.max(0.02, backendWorkspace.progress)})` }} />
          </div>
        </div>

        <div className="mode-card analysis-controls">
          <label>
            <span>Mode</span>
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
          </label>
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
          <button type="button" onClick={exportTextChart}>
            <Download size={15} />
            Export text chart
          </button>
          {backendWorkspace.error && <small className="side-card__error">{backendWorkspace.error}</small>}
        </div>

        <div className="mode-card batch-list">
          <span>Recent batches</span>
          {backendWorkspace.batches.length === 0 ? (
            <small>No batch data yet.</small>
          ) : (
            backendWorkspace.batches.slice(-6).map((batch) => (
              <div className="batch-row" key={`${batch.job_id}-${batch.batch_index}`}>
                <strong>Batch {batch.batch_index}</strong>
                <span>{batch.status}</span>
                <small>
                  {batch.start.toFixed(0)}s-{(batch.end ?? 0).toFixed(0)}s
                  {batch.elapsed_seconds ? ` - ${batch.elapsed_seconds.toFixed(1)}s` : ""}
                </small>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderPracticeSurface() {
    return (
      <section className="mode-page mode-page--practice" aria-label="Practice workspace">
        <div className="mode-card practice-actions">
          <span>Practice</span>
          <strong>Loop, transpose, export</strong>
          <div className="practice-action-grid">
            <button type="button" onClick={() => setLoopRange(loopRange ? null : {
              startSeconds: currentChord.startSeconds,
              endSeconds: currentChord.endSeconds,
            })}>
              {loopRange ? "Clear loop" : "Loop current chord"}
            </button>
            <button type="button" onClick={() => onTransposeChange(0)}>Reset transpose</button>
            <button type="button" onClick={exportTextChart}>Export text chart</button>
          </div>
        </div>
        <div className="mode-card mode-card--capo">
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
        </div>
      </section>
    );
  }

  function renderMainSurface() {
    if (activePanel === "lyrics") {
      return (
        <section className="mode-page mode-page--lyrics" aria-label="Lyrics workspace">
          {renderLyricsPanel("large")}
        </section>
      );
    }

    if (activePanel === "analysis") {
      return renderAnalysisSurface();
    }

    if (activePanel === "practice") {
      return renderPracticeSurface();
    }

    return renderInstrumentSurface();
  }

  function renderSidePanel() {
    if (activePanel !== "studio") {
      return null;
    }

    return (
      <aside className="workspace-sidebar" aria-label="Studio details">
        <section className="side-card side-card--capo">
          <span>Capo suggestion</span>
          <strong>Capo {capoSuggestion.capo}</strong>
          <small>
            {capoSuggestion.easyCount} easy, {capoSuggestion.hardCount} hard,
            {" "}
            {capoSuggestion.impossibleCount} unsupported.
          </small>
          <div className="capo-difficulty-list" aria-label="Hardest chord checks">
            {capoSuggestion.chordDifficulties
              .filter((entry) => !entry.playable || entry.difficulty >= 3.4)
              .slice(0, 5)
              .map((entry) => (
                <small key={`${entry.chord}-${entry.playedShape}-${entry.fret}`}>
                  {entry.chord}: {entry.playable ? `${entry.label}, ${entry.difficulty.toFixed(1)}/5` : "unsupported"}
                </small>
              ))}
          </div>
        </section>
        <section className="side-card">
          <span>Export</span>
          <button type="button" onClick={exportTextChart}>
            <Download size={15} />
            Export text chart
          </button>
        </section>
      </aside>
    );
  }

  useEffect(() => {
    function preventWindowDrop(event: globalThis.DragEvent) {
      const alreadyHandled = event.defaultPrevented;
      event.preventDefault();
      if (event.type === "dragover") {
        setIsDraggingFile(true);
        return;
      }

      setIsDraggingFile(false);
      if (alreadyHandled) {
        return;
      }

      handleDroppedFiles(Array.from(event.dataTransfer?.files ?? []));
    }
    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);
    return () => {
      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, [handleDroppedFiles]);

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
        song={workspace.song}
      />

      <section className={`workspace-grid workspace-grid--${activePanel}`}>
        <div className={`workspace-main workspace-main--${activePanel}`}>
          {renderMainSurface()}
        </div>

        {renderSidePanel()}
      </section>

      <Timeline
        chords={workspace.chords}
        currentTimeSeconds={playbackController.playback.currentTimeSeconds}
        durationSeconds={workspace.song.durationSeconds}
        loopRange={loopRange}
        onLoopChange={setLoopRange}
        onSeek={playbackController.seek}
        tempoBpm={workspace.analysis.tempoBpm}
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
          {activePanel === "lyrics" ? "Drop lyrics to replace" : "Drop audio or lyrics"}
        </div>
      )}
    </main>
  );
}

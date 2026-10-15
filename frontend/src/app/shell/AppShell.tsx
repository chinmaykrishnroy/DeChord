import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownToLine,
  AudioLines,
  BookOpen,
  ChevronRight,
  FolderOpen,
  Guitar,
  LayoutDashboard,
  Library,
  ListMusic,
  Piano,
  Settings2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { TitleBar } from "./TitleBar";
import { AppLogo } from "./AppLogo";
import { SongCover } from "./SongCover";
import { InstrumentPractice } from "../../features/instruments/InstrumentPractice";
import { useBackendWorkspace } from "../../features/workspace/useBackendWorkspace";
import { usePlayback } from "../../features/playback/usePlayback";
import { TransportBar } from "../../features/playback/TransportBar";
import { WidgetGrid } from "../../features/workspace/WidgetGrid";
import { GuitarWidget } from "../../features/guitar/components/GuitarWidget";
import { PianoPage } from "../../features/piano/components/PianoPage";
import { useInstrumentSampler } from "../../features/instruments/useInstrumentSampler";
import { LyricsWidget } from "../../features/workspace/LyricsWidget";
import { ChordSheet } from "../../features/workspace/ChordSheet";
import { Timeline } from "../../features/timeline/Timeline";
import { transposeChordSegment, transposeNote } from "../../utils/musicTheory";
import type { LoopRange } from "../../types/music";
import type { WidgetId } from "../../features/workspace/layout";
import { formatTime } from "../../utils/time";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { importSongPath } from "../../services/backendClient";
import {
  PracticePreferences,
  usePracticeSession,
} from "../../features/workspace/usePracticeSession";
import type { PracticePage } from "../../features/workspace/practiceSession";

export function AppShell() {
  const backend = useBackendWorkspace();
  const session = usePracticeSession();
  const { page, transpose, tempo, volume, loop } = session.settings;
  const setPage = (page: PracticePage) => session.update({ page });
  const setTranspose = (transpose: number) => session.update({ transpose });
  const setTempo = (tempo: number) => session.update({ tempo });
  const setVolume = (volume: number) => session.update({ volume });
  const setLoop = (loop: LoopRange | null) => session.update({ loop });
  const [customizing, setCustomizing] = useState(false),
    [search, setSearch] = useState(""),
    [importError, setImportError] = useState(""),
    [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    startupRestored = useRef(false),
    justRestored = useRef(false),
    loopRef = useRef(loop);
  loopRef.current = loop;
  const workspace = useMemo(
    () => ({
      ...backend.workspace,
      analysis: {
        ...backend.workspace.analysis,
        key: backend.workspace.analysis.key.replace(/^([A-G][#b]?)/, (root) =>
          transposeNote(root, transpose),
        ),
      },
      chords: backend.workspace.chords.map((c) =>
        transposeChordSegment(c, transpose),
      ),
    }),
    [backend.workspace, transpose],
  );
  const baseTempo = backend.usingMock ? null : workspace.analysis.tempoBpm;
  const rate = baseTempo
    ? Math.max(0.25, Math.min(2, (baseTempo + tempo) / baseTempo))
    : 1;
  const player = usePlayback(workspace.chords, workspace.song.durationSeconds, {
    enabled: !!backend.audioSourceUrl || backend.usingMock,
    audioSourceUrl: backend.audioSourceUrl,
    playbackRate: rate,
    pitchSemitones: transpose,
    volume,
    loopRange: loop,
  });
  const sampler = useInstrumentSampler(true);
  const identity = backend.audioSourceUrl ?? "demo";
  useEffect(() => {
    const position = session.activate(
      backend.song?.id ?? null,
      backend.workspace.song.durationSeconds,
    );
    justRestored.current = true;
    player.pause();
    player.seek(position);
  }, [identity, backend.song?.id, session.activate, player.pause, player.seek]);
  useEffect(() => {
    if (justRestored.current) {
      justRestored.current = false;
      return;
    }
    session.recordPosition(
      backend.song?.id ?? null,
      player.playback.currentTimeSeconds,
    );
  }, [
    identity,
    backend.song?.id,
    player.playback.currentTimeSeconds,
    session.recordPosition,
  ]);
  useEffect(() => {
    if (startupRestored.current || backend.connectionStatus !== "online")
      return;
    // A user import or song choice takes priority over delayed startup recovery.
    if (
      backend.song ||
      backend.audioSourceUrl ||
      backend.workStatus !== "idle"
    ) {
      startupRestored.current = true;
      return;
    }
    // Health and library arrive separately; wait for the capability/library response.
    if (!backend.capabilities) return;
    startupRestored.current = true;
    const song = backend.library.find((s) => s.id === session.lastSongId);
    if (song) void backend.openSong(song);
  }, [
    backend.connectionStatus,
    backend.capabilities,
    backend.library,
    backend.song,
    backend.audioSourceUrl,
    backend.workStatus,
    backend.openSong,
    session.lastSongId,
  ]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,button,[contenteditable],[data-scroll-area]",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        player.togglePlayback();
      }
      if (e.key === "ArrowRight") player.skipBy(5);
      if (e.key === "ArrowLeft") player.skipBy(-5);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [player]);
  function importFile(file: File) {
    setImportError("");
    setPage("workspace");
    if (/\.(lrc|txt)$/i.test(file.name)) void backend.importLyricsFile(file);
    else if (
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|flac|m4a|aac|ogg|opus|aif|aiff|wma)$/i.test(file.name)
    ) {
      player.pause();
      void backend.uploadAndAnalyze(file);
    } else setImportError("Choose an audio file, or an LRC lyrics file.");
  }
  const nativeDrop = useRef<(paths: string[]) => void>(() => {});
  nativeDrop.current = (paths) => {
    const path = paths[0];
    if (!path) return;
    setPage("workspace");
    setImportError("");
    if (/\.(lrc|txt)$/i.test(path)) {
      void invoke<string>("read_lyrics_file", { path })
        .then((text) => backend.saveLyricsText(text))
        .catch((e) => setImportError(String(e)));
    } else if (/\.(mp3|wav|flac|m4a|aac|ogg|opus|aif|aiff|wma)$/i.test(path)) {
      player.pause();
      void importSongPath(path)
        .then((song) => backend.openSong(song))
        .catch((e) => setImportError(`Import failed: ${e.message}`));
    } else setImportError("Choose an audio file, or an LRC lyrics file.");
  };
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false,
      unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(({ payload }) => {
        if (payload.type === "enter" || payload.type === "over")
          setDragging(true);
        else {
          setDragging(false);
          if (payload.type === "drop") nativeDrop.current(payload.paths);
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((e) =>
        setImportError(`Desktop drop handler unavailable: ${String(e)}`),
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) importFile(file);
  }
  function exportChart() {
    const text = [
      `DeChord · ${workspace.song.title}`,
      `Key: ${workspace.analysis.key}`,
      `Transpose: ${transpose} semitones`,
      "Start\tEnd\tChord",
      ...workspace.chords.map(
        (c) =>
          `${c.startSeconds.toFixed(3)}\t${c.endSeconds.toFixed(3)}\t${c.label}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.song.title.replace(/[^a-z0-9_-]+/gi, "-")}-chords.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderWidget(id: WidgetId) {
    switch (id) {
      case "guitar":
        return (
          <GuitarWidget chord={player.currentChord} chords={workspace.chords} />
        );
      case "piano":
        return (
          <PianoPage
            currentChord={player.currentChord}
            soundEnabled
            onNotePreview={(note, octave) =>
              sampler.playNote("piano", note, octave)
            }
          />
        );
      case "lyrics":
        return (
          <LyricsWidget
            backend={backend}
            time={player.playback.currentTimeSeconds}
            onSeek={player.seek}
          />
        );
      case "chords":
        return (
          <ChordSheet
            chords={workspace.chords}
            time={player.playback.currentTimeSeconds}
            onSeek={player.seek}
            canEdit={!!backend.song && transpose === 0}
            onCorrect={backend.correctChord}
          />
        );
      case "analysis":
        return (
          <div className="analysis-widget">
            <div className="analysis-state">
              <i
                className={
                  backend.workStatus === "ready"
                    ? "status-dot is-online"
                    : "status-dot"
                }
              />
              <strong>
                {backend.usingMock
                  ? "Demo workspace"
                  : backend.workStatus === "idle"
                    ? "Ready to import"
                    : backend.workStatus}
              </strong>
              <span>{Math.round(backend.progress * 100)}%</span>
            </div>
            <progress value={backend.progress} max="1" />
            <label>
              Analysis mode
              <select
                aria-label="Analysis mode"
                value={backend.mode}
                onChange={(e) =>
                  backend.setMode(e.target.value as typeof backend.mode)
                }
              >
                <option value="full_song">Full song · best continuity</option>
                <option value="batched">Progressive · early results</option>
                <option value="preview">30-second preview</option>
              </select>
            </label>
            {backend.mode === "batched" && (
              <label>
                Batch size
                <select
                  aria-label="Batch duration"
                  value={backend.batchSeconds}
                  onChange={(e) => backend.setBatchSeconds(+e.target.value)}
                >
                  {[15, 30, 60].map((s) => (
                    <option key={s} value={s}>
                      {s} seconds
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="analysis-meta">
              <span>
                Engine <strong>{workspace.analysis.engine}</strong>
              </span>
              <span>
                Chords <strong>{workspace.chords.length}</strong>
              </span>
              <span>
                Updates <strong>Incremental stream</strong>
              </span>
            </div>
            <button onClick={exportChart}>
              <ArrowDownToLine size={15} /> Export chord chart
            </button>
            {backend.capabilities && !backend.capabilities.analysis_ready && (
              <p className="inline-error">
                Analysis engines are not installed. See Settings for setup.
              </p>
            )}
          </div>
        );
    }
  }
  const nav = [
    { id: "workspace", icon: LayoutDashboard, label: "Your workspace" },
    { id: "library", icon: Library, label: "Song library" },
    { id: "lyrics", icon: ListMusic, label: "Lyrics" },
    { id: "guitar", icon: Guitar, label: "Guitar" },
    { id: "piano", icon: Piano, label: "Piano" },
  ] as const;
  const filteredSongs = backend.library.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <PracticePreferences value={session.preferences}>
      <div
        className={`studio-app ${dragging ? "file-over" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={drop}
      >
        <a href="#main-content" className="skip-link">
          Skip to workspace
        </a>
        <TitleBar />
        <div className="studio-body">
          <aside className="studio-sidebar">
            <a
              className="wordmark"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPage("workspace");
              }}
            >
              <span className="sidebar-brand-icon">
                <AppLogo />
              </span>
              <strong>
                DeChord<span>studio</span>
              </strong>
            </a>
            <nav aria-label="Main navigation">
              {nav.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={page === id ? "is-active" : ""}
                  onClick={() => setPage(id)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="sidebar-library">
              <div className="sidebar-library-heading">
                <span>Your music</span>
                <button
                  className="icon-button"
                  aria-label="Import song"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={15} />
                </button>
              </div>
              <div
                className="sidebar-song-list"
                role="region"
                aria-label="Your music songs"
                tabIndex={0}
                data-scroll-area
              >
                {backend.library.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    className={
                      s.id === backend.song?.id
                        ? "library-mini is-active"
                        : "library-mini"
                    }
                    onClick={() => {
                      void backend.openSong(s);
                      setPage("workspace");
                    }}
                  >
                    <SongCover songId={s.id} />
                    <span>
                      <strong>{s.title}</strong>
                      <small>Local audio</small>
                    </span>
                  </button>
                ))}
                {!backend.library.length && (
                  <p>Keep the songs you're learning close at hand.</p>
                )}
              </div>
            </div>
            <div className="sidebar-bottom">
              <div className="local-badge">
                <span
                  className={`status-dot ${backend.connectionStatus === "online" ? "is-online" : ""}`}
                />
                {backend.connectionStatus === "online"
                  ? "Local engine connected"
                  : "Local engine offline"}
              </div>
              <button
                onClick={() => setPage("settings")}
                className={page === "settings" ? "is-active" : ""}
              >
                <Settings2 size={19} /> Settings
              </button>
              <span>Made for the way you practice.</span>
            </div>
          </aside>
          <main id="main-content" className="studio-main">
            <header className="studio-topbar">
              <div className="breadcrumbs">
                <span>Studio</span>
                <ChevronRight size={14} />
                <strong>
                  {page === "workspace"
                    ? "Workspace"
                    : page === "library"
                      ? "Library"
                      : page === "lyrics"
                        ? "Lyrics"
                        : page === "guitar"
                          ? "Guitar"
                          : page === "piano"
                            ? "Piano"
                            : "Settings"}
                </strong>
              </div>
              <div>
                <button
                  className="button-muted customize-button"
                  onClick={() => {
                    setPage("workspace");
                    setCustomizing((v) => !v);
                  }}
                >
                  <SlidersHorizontal size={16} />{" "}
                  {customizing ? "Finish arranging" : "Customize"}
                </button>
                <button
                  className="button-primary"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={16} />
                  <span>Import audio</span>
                </button>
              </div>
            </header>
            <input
              className="sr-only"
              type="file"
              accept="audio/*,.lrc,.txt"
              ref={fileInput}
              onChange={(e) => {
                if (e.target.files?.[0]) importFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <div className="main-scroll">
              {session.storageError && (
                <div className="error-banner" role="status">
                  {session.storageError}
                </div>
              )}
              {player.audioError && (
                <div className="error-banner" role="alert">
                  <strong>Playback unavailable</strong>
                  <span>{player.audioError}</span>
                </div>
              )}
              {sampler.error && (
                <div className="error-banner" role="status">
                  Note preview unavailable: {sampler.error}
                </div>
              )}
              {importError && (
                <div className="error-banner" role="alert">
                  {importError}
                </div>
              )}
              {page === "workspace" && (
                <>
                  <section className="session-heading">
                    <div className="session-art">
                      {backend.albumArtUrl ? (
                        <img src={backend.albumArtUrl} alt="Song artwork" />
                      ) : (
                        <AudioLines size={42} />
                      )}
                    </div>
                    <div>
                      <span className="eyebrow">
                        {backend.usingMock
                          ? "Explore the demo"
                          : "Your practice session"}
                      </span>
                      <h1>{workspace.song.title}</h1>
                      <p>
                        {workspace.song.artist} <span>·</span>{" "}
                        {formatTime(player.playback.durationSeconds)}{" "}
                        <span>·</span> {workspace.analysis.key}{" "}
                        {baseTempo && (
                          <>
                            <span>·</span> {Math.round(baseTempo)} BPM
                          </>
                        )}
                      </p>
                    </div>
                    <div className="current-chord-chip">
                      <span>Current chord</span>
                      <strong>{player.currentChord.label}</strong>
                      <small>
                        {player.currentChord.tones
                          .map((t) => t.note)
                          .join(" · ")}
                      </small>
                    </div>
                  </section>
                  {backend.error && (
                    <div className="error-banner" role="alert">
                      <strong>Analysis needs attention</strong>
                      <span>{backend.error}</span>
                      <button onClick={() => void backend.refreshHealth()}>
                        Check engine
                      </button>
                    </div>
                  )}
                  <WidgetGrid
                    render={renderWidget}
                    customizing={customizing}
                    onCustomizing={setCustomizing}
                    hasLyrics={
                      backend.lyrics.synced && backend.lyrics.lines.length > 0
                    }
                  />
                </>
              )}
              {page === "library" && (
                <section className="library-page">
                  <span className="eyebrow">Your collection</span>
                  <h1>Keep learning.</h1>
                  <p>
                    Local songs, saved chords, and somewhere to pick up again.
                  </p>
                  <input
                    className="library-search"
                    placeholder="Search your songs"
                    aria-label="Search song library"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="library-table">
                    <div className="library-table-head">
                      <span>Title</span>
                      <span>Source</span>
                      <span>Duration</span>
                    </div>
                    {filteredSongs.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          void backend.openSong(s);
                          setPage("workspace");
                        }}
                      >
                        <span>
                          <SongCover songId={s.id} />
                          <strong>{s.title}</strong>
                        </span>
                        <span>Local file</span>
                        <span>{formatTime(s.duration ?? 0)}</span>
                      </button>
                    ))}
                  </div>
                  {!filteredSongs.length && (
                    <div className="empty-state">
                      <FolderOpen size={38} />
                      <strong>
                        {search
                          ? "No matching songs"
                          : "Your next song starts here."}
                      </strong>
                      <p>
                        Import a recording. Audio and analysis stay on this
                        machine.
                      </p>
                      <button
                        className="button-primary"
                        onClick={() => fileInput.current?.click()}
                      >
                        Import your first song
                      </button>
                    </div>
                  )}
                </section>
              )}
              {page === "lyrics" && (
                <section className="lyrics-page">
                  <span className="eyebrow">Sing it back</span>
                  <h1>{workspace.song.title}</h1>
                  <LyricsWidget
                    backend={backend}
                    time={player.playback.currentTimeSeconds}
                    onSeek={player.seek}
                  />
                </section>
              )}
              {(page === "guitar" || page === "piano") && (
                <InstrumentPractice
                  instrument={page}
                  chords={workspace.chords}
                  currentChord={player.currentChord}
                  time={player.playback.currentTimeSeconds}
                  onSeek={player.seek}
                  onNotePreview={(note, octave) =>
                    sampler.playNote("piano", note, octave)
                  }
                />
              )}
              {page === "settings" && (
                <section className="settings-page">
                  <span className="eyebrow">Settle in</span>
                  <h1>Your studio.</h1>
                  <div className="setting-row">
                    <div>
                      <h3>Pick up where you left off</h3>
                      <p>
                        Song position, loop, tempo, transposition, capo and
                        lyric offset are saved on this device. Reopening keeps
                        audio paused. Browser and desktop profiles save
                        separately.
                      </p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>Automatic lyrics</h3>
                      <p>
                        Look up synced lyrics when you open a song. Sends song
                        metadata to LRCLIB.
                      </p>
                    </div>
                    <input
                      aria-label="Automatic lyric lookup"
                      type="checkbox"
                      checked={backend.autoLyrics}
                      onChange={(e) => backend.setAutoLyrics(e.target.checked)}
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>Local analysis engine</h3>
                      <p>
                        {backend.connectionStatus === "online"
                          ? "Connected on this machine."
                          : "Start the backend to analyze and save your songs."}
                      </p>
                      <code>
                        python -m uvicorn backend.app.main:app --host 127.0.0.1
                        --port 8765
                      </code>
                      <p>
                        {backend.capabilities
                          ? Object.entries(backend.capabilities.engines)
                              .map(
                                ([name, ready]) =>
                                  `${name}: ${ready ? "installed" : "missing"}`,
                              )
                              .join(" · ")
                          : "Engine capabilities unavailable."}
                      </p>
                    </div>
                    <button onClick={() => void backend.refreshHealth()}>
                      Reconnect
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3>Workspace layout</h3>
                      <p>
                        Move, resize, add, or hide widgets. Layouts are saved
                        separately for wide and compact screens.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPage("workspace");
                        setCustomizing(true);
                      }}
                    >
                      Arrange widgets
                    </button>
                  </div>
                  <div className="setting-row">
                    <BookOpen size={24} />
                    <p>
                      Space to play or pause · Arrow keys to seek · Click a
                      lyric to jump · Drag the timeline to loop
                    </p>
                  </div>
                </section>
              )}
            </div>
          </main>
        </div>
        <div className="practice-dock">
          <Timeline
            chords={workspace.chords}
            currentTimeSeconds={player.playback.currentTimeSeconds}
            readTime={player.readTime}
            isPlaying={player.playback.isPlaying}
            durationSeconds={player.playback.durationSeconds}
            tempoBpm={baseTempo}
            loopRange={loop}
            onLoopChange={setLoop}
            onSeek={player.seek}
          />
        </div>
        <TransportBar
          playback={player.playback}
          disabled={!backend.audioSourceUrl && !backend.usingMock}
          baseTempoBpm={baseTempo}
          tempoOffsetBpm={tempo}
          trackVolume={volume}
          transposeSemitones={transpose}
          onTogglePlayback={player.togglePlayback}
          onSeek={player.seek}
          onSkip={player.skipBy}
          onTempoOffsetChange={setTempo}
          onTrackVolumeChange={setVolume}
          onTransposeChange={setTranspose}
        />
        {dragging && (
          <div className="file-drop-overlay">
            <Upload size={40} />
            <strong>Drop a song. Make it yours.</strong>
            <span>Audio files · LRC and text lyrics</span>
          </div>
        )}
      </div>
    </PracticePreferences>
  );
}

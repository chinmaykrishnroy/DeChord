import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { WorkspaceView } from "../../features/workspace/WorkspaceView";
import { useBackendWorkspace } from "../../features/workspace/useBackendWorkspace";
import { useMockPlayback } from "../../features/playback/useMockPlayback";
import type { ThemeSettings, WorkspacePanel } from "../../types/music";
import { transposeChordSegment } from "../../utils/musicTheory";
import { SideRail } from "./SideRail";
import { TitleBar } from "./TitleBar";

function getInitialThemeSettings(): ThemeSettings {
  const params = new URLSearchParams(window.location.search);
  const hue = params.has("hue") ? Number(params.get("hue")) : Number.NaN;
  const mode = params.get("theme");

  return {
    mode: mode === "light" ? "light" : "dark",
    hue: Number.isFinite(hue) ? Math.min(360, Math.max(0, hue)) : 15,
    instrumentSoundsEnabled: true,
  };
}

export function AppShell() {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(getInitialThemeSettings);
  const [settingsOpen, setSettingsOpen] = useState(
    () => new URLSearchParams(window.location.search).get("settings") === "1",
  );
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [tempoOffsetBpm, setTempoOffsetBpm] = useState(0);
  const [trackVolume, setTrackVolume] = useState(0.82);
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("studio");
  const backendWorkspace = useBackendWorkspace();
  const displayWorkspace = useMemo(
    () => ({
      ...backendWorkspace.workspace,
      chords: backendWorkspace.workspace.chords.map((chord) =>
        transposeChordSegment(chord, transposeSemitones),
      ),
    }),
    [backendWorkspace.workspace, transposeSemitones],
  );
  const baseTempoBpm =
    !backendWorkspace.usingMock && backendWorkspace.workspace.analysis.tempoBpm
      ? backendWorkspace.workspace.analysis.tempoBpm
      : null;
  const playbackRate =
    baseTempoBpm && baseTempoBpm + tempoOffsetBpm > 0
      ? Math.max(0.5, Math.min(1.75, (baseTempoBpm + tempoOffsetBpm) / baseTempoBpm))
      : 1;
  const playbackController = useMockPlayback(
    displayWorkspace.chords,
    displayWorkspace.song.durationSeconds,
    {
      enabled: backendWorkspace.hasAnalysis,
      availableUntilSeconds: backendWorkspace.availableUntilSeconds,
      audioSourceUrl: backendWorkspace.audioSourceUrl,
      pitchSemitones: transposeSemitones,
      playbackRate,
      volume: trackVolume,
    },
  );
  const lastAutoPlayVersion = useRef(0);
  const lastAutoPlaySongId = useRef<string | null>(null);
  const themeStyle = useMemo(
    () =>
      ({
        "--hue-color": String(themeSettings.hue),
        "--first-color": `hsl(${themeSettings.hue} 89% 60%)`,
        "--second-color": `hsl(${themeSettings.hue} 56% 82%)`,
      }) as CSSProperties,
    [themeSettings.hue],
  );

  useEffect(() => {
    if (
      backendWorkspace.hasAnalysis &&
      backendWorkspace.analysisVersion > lastAutoPlayVersion.current &&
      !backendWorkspace.usingMock
    ) {
      const currentSongId = backendWorkspace.song?.id ?? null;
      lastAutoPlayVersion.current = backendWorkspace.analysisVersion;
      if (currentSongId !== lastAutoPlaySongId.current) {
        lastAutoPlaySongId.current = currentSongId;
        playbackController.seek(0);
      }
      playbackController.play();
    }
  }, [
    backendWorkspace.analysisVersion,
    backendWorkspace.hasAnalysis,
    backendWorkspace.usingMock,
    playbackController,
  ]);

  return (
    <div className={`app-frame theme-${themeSettings.mode}`} style={themeStyle}>
      <TitleBar />
      <div className="app-body">
        <SideRail
          activePanel={activePanel}
          onOpenSettings={() => setSettingsOpen(true)}
          onPanelChange={setActivePanel}
        />
        <WorkspaceView
          activePanel={activePanel}
          onCloseSettings={() => setSettingsOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeSettingsChange={setThemeSettings}
          playbackController={playbackController}
          settingsOpen={settingsOpen}
          tempoOffsetBpm={tempoOffsetBpm}
          themeSettings={themeSettings}
          trackVolume={trackVolume}
          backendWorkspace={backendWorkspace}
          transposeSemitones={transposeSemitones}
          workspace={displayWorkspace}
          onTempoOffsetChange={setTempoOffsetBpm}
          onTrackVolumeChange={setTrackVolume}
          onTransposeChange={setTransposeSemitones}
        />
      </div>
    </div>
  );
}

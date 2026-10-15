import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import processorUrl from "@soundtouchjs/audio-worklet/processor?url";
import type { ChordSegment, PlaybackState, LoopRange } from "../../types/music";
import { playbackPosition } from "./clock";
import { clamp } from "../../utils/time";

const silentChord: ChordSegment = {
  id: "silence",
  label: "N",
  root: "",
  quality: "No chord",
  startSeconds: 0,
  endSeconds: 0,
  tones: [],
};
interface PlaybackOptions {
  enabled?: boolean;
  availableUntilSeconds?: number;
  audioSourceUrl?: string | null;
  playbackRate?: number;
  pitchSemitones?: number;
  volume?: number;
  loopRange?: LoopRange | null;
}
interface Graph {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  node: SoundTouchNode;
  routed: boolean;
}

/** The media clock is authoritative. React only samples it; it never advances audio. */
export function usePlayback(
  chords: ChordSegment[],
  durationSeconds: number,
  options: PlaybackOptions = {},
) {
  const {
    enabled = true,
    audioSourceUrl = null,
    playbackRate = 1,
    pitchSemitones = 0,
    volume = 0.8,
  } = options;
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTimeSeconds: 0,
    durationSeconds,
  });
  const [audioError, setAudioError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null),
    graph = useRef<Graph | null>(null);
  const graphSetup = useRef<Promise<void> | null>(null),
    pendingSeek = useRef<number | null>(null),
    generation = useRef(0),
    playIntent = useRef(false);
  const config = useRef({
    enabled,
    playbackRate,
    pitchSemitones,
    volume,
    loop: options.loopRange,
    durationSeconds,
  });
  config.current = {
    enabled,
    playbackRate,
    pitchSemitones,
    volume,
    loop: options.loopRange,
    durationSeconds,
  };
  const state = useRef(playback);
  state.current = playback;

  const sync = useCallback(() => {
    const el = audio.current;
    if (!el) return;
    const duration = Number.isFinite(el.duration)
      ? el.duration
      : config.current.durationSeconds;
    const time = pendingSeek.current ?? el.currentTime;
    const position = playbackPosition(
      time,
      duration,
      config.current.loop,
    );
    if (position.looped && playIntent.current) el.currentTime = position.time;
    setPlayback({
      isPlaying: !el.paused && !el.ended,
      currentTimeSeconds:
        position.looped && playIntent.current ? position.time : time,
      durationSeconds: duration,
    });
  }, []);

  const routeGraph = useCallback(() => {
    const el = audio.current,
      g = graph.current;
    if (!el) return;
    el.playbackRate = config.current.playbackRate;
    el.volume = clamp(config.current.volume, 0, 1);
    if (!g) {
      el.preservesPitch = true;
      return;
    }
    const shifted = config.current.pitchSemitones !== 0;
    g.node.pitchSemitones.value = config.current.pitchSemitones;
    g.node.playbackRate.value = config.current.playbackRate;
    if (g.routed !== shifted) {
      g.source.disconnect();
      g.node.disconnect();
      if (shifted) {
        g.source.connect(g.node);
        g.node.connect(g.context.destination);
      } else g.source.connect(g.context.destination);
      g.routed = shifted;
    }
    el.preservesPitch = !shifted;
  }, []);

  const ensureGraph = useCallback(async () => {
    if (graph.current || config.current.pitchSemitones === 0) return;
    if (graphSetup.current) return graphSetup.current;
    const el = audio.current,
      token = generation.current;
    if (!el) return;
    const context = new AudioContext({ latencyHint: "playback" });
    // Resume within the original user gesture, before awaiting module loading.
    const resumed = context.resume();
    const setup = (async () => {
      try {
        await Promise.all([
          SoundTouchNode.register(context, processorUrl),
          resumed,
        ]);
        if (generation.current !== token) {
          await context.close();
          return;
        }
        const source = context.createMediaElementSource(el);
        const node = new SoundTouchNode({ context });
        source.connect(context.destination);
        node.addEventListener("processorerror", () => {
          if (generation.current === token)
            setAudioError(
              "Pitch processing stopped. Reload this song to retry.",
            );
        });
        graph.current = { context, source, node, routed: false };
        routeGraph();
      } catch (error) {
        await context.close();
        throw error;
      }
    })();
    graphSetup.current = setup;
    try {
      await setup;
    } finally {
      if (generation.current === token) graphSetup.current = null;
    }
  }, [routeGraph]);

  useEffect(() => {
    generation.current++;
    playIntent.current = false;
    pendingSeek.current = null;
    setAudioError(null);
    setPlayback({ isPlaying: false, currentTimeSeconds: 0, durationSeconds });
    if (!audioSourceUrl) return;
    const el = new Audio();
    el.hidden = true;
    el.dataset.dechordAudio = "true";
    document.body.appendChild(el);
    el.crossOrigin = "anonymous";
    el.preload = "metadata";
    el.volume = volume;
    el.playbackRate = playbackRate;
    el.src = audioSourceUrl;
    audio.current = el;
    const onMetadata = () => {
      if (pendingSeek.current !== null && Number.isFinite(el.duration)) {
        el.currentTime = clamp(pendingSeek.current, 0, el.duration);
        pendingSeek.current = null;
      }
      sync();
    };
    const onEnd = () => {
      const loop = config.current.loop;
      if (loop && playIntent.current) {
        el.currentTime = loop.startSeconds;
        void el.play().catch((e) => setAudioError(e.message));
      } else {
        playIntent.current = false;
        sync();
      }
    };
    const onError = () =>
      setAudioError(
        "This audio could not be played. Check that the source file is available and uses a supported format.",
      );
    for (const event of [
      "durationchange",
      "play",
      "pause",
      "seeked",
      "timeupdate",
    ])
      el.addEventListener(event, sync);
    el.addEventListener("loadedmetadata", onMetadata);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    const ticker = window.setInterval(() => {
      if (!el.paused) sync();
    }, 80);
    return () => {
      generation.current++;
      playIntent.current = false;
      window.clearInterval(ticker);
      for (const event of [
        "durationchange",
        "play",
        "pause",
        "seeked",
        "timeupdate",
      ])
        el.removeEventListener(event, sync);
      el.removeEventListener("loadedmetadata", onMetadata);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
      el.pause();
      el.removeAttribute("src");
      el.load();
      el.remove();
      audio.current = null;
      const g = graph.current;
      graph.current = null;
      graphSetup.current = null;
      if (g) {
        g.source.disconnect();
        g.node.disconnect();
        void g.context.close();
      }
    };
  }, [audioSourceUrl, sync]);

  useEffect(() => {
    routeGraph();
    if (pitchSemitones !== 0 && audio.current && !audio.current.paused) {
      void ensureGraph().catch((e) => {
        audio.current?.pause();
        setAudioError(`Pitch processing unavailable: ${e.message}`);
      });
    }
  }, [playbackRate, pitchSemitones, volume, routeGraph, ensureGraph]);
  useEffect(() => {
    if (!enabled) {
      playIntent.current = false;
      audio.current?.pause();
      setPlayback((s) => ({ ...s, isPlaying: false }));
    }
  }, [enabled]);
  // Demo mode has no source; keep its simulated clock isolated from real playback.
  useEffect(() => {
    if (audioSourceUrl || !playback.isPlaying || !enabled) return;
    let previous = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now(),
        delta = (now - previous) / 1000;
      previous = now;
      setPlayback((s) => {
        const p = playbackPosition(
          s.currentTimeSeconds + delta * config.current.playbackRate,
          config.current.durationSeconds,
          config.current.loop,
        );
        return { ...s, currentTimeSeconds: p.time, isPlaying: !p.ended };
      });
    }, 80);
    return () => clearInterval(id);
  }, [audioSourceUrl, playback.isPlaying, enabled]);

  const play = useCallback(async () => {
    if (!config.current.enabled) return;
    const el = audio.current,
      token = generation.current;
    playIntent.current = true;
    if (!el) {
      setPlayback((s) => ({
        ...s,
        isPlaying: true,
        currentTimeSeconds:
          s.currentTimeSeconds >= s.durationSeconds ? 0 : s.currentTimeSeconds,
      }));
      return;
    }
    try {
      setAudioError(null);
      await ensureGraph();
      if (generation.current !== token || !playIntent.current) return;
      if (graph.current?.context.state === "suspended")
        await graph.current.context.resume();
      if (
        el.ended ||
        (Number.isFinite(el.duration) && el.currentTime >= el.duration - 0.02)
      )
        el.currentTime = 0;
      routeGraph();
      await el.play();
      if (generation.current !== token || !playIntent.current) el.pause();
    } catch (error) {
      if (generation.current === token && playIntent.current) {
        playIntent.current = false;
        setAudioError(
          error instanceof Error ? error.message : "Could not start playback.",
        );
      }
    }
  }, [ensureGraph, routeGraph]);
  const pause = useCallback(() => {
    playIntent.current = false;
    audio.current?.pause();
    setPlayback((s) => ({ ...s, isPlaying: false }));
  }, []);
  const seek = useCallback((time: number) => {
    const el = audio.current,
      end =
        el && Number.isFinite(el.duration)
          ? el.duration
          : config.current.durationSeconds;
    const next = clamp(
      Number.isFinite(time) ? time : 0,
      0,
      end > 0 ? end : Infinity,
    );
    if (el) {
      if (el.readyState < HTMLMediaElement.HAVE_METADATA)
        pendingSeek.current = next;
      else {
        pendingSeek.current = null;
        el.currentTime = next;
      }
    }
    setPlayback((s) => ({ ...s, currentTimeSeconds: next }));
  }, []);
  const skipBy = useCallback(
    (delta: number) =>
      seek(
        (audio.current?.currentTime ?? state.current.currentTimeSeconds) +
          delta,
      ),
    [seek],
  );
  const togglePlayback = useCallback(() => {
    if (playIntent.current || state.current.isPlaying) pause();
    else void play();
  }, [pause, play]);
  const currentChordIndex = useMemo(
    () =>
      chords.findIndex(
        (c) =>
          playback.currentTimeSeconds >= c.startSeconds &&
          playback.currentTimeSeconds < c.endSeconds,
      ),
    [chords, playback.currentTimeSeconds],
  );
  const readTime = useCallback(
    () => audio.current?.currentTime ?? state.current.currentTimeSeconds,
    [],
  );
  return {
    readTime,
    playback,
    audioError,
    currentChordIndex,
    currentChord: chords[currentChordIndex] ?? silentChord,
    togglePlayback,
    play,
    pause,
    seek,
    skipBy,
  };
}

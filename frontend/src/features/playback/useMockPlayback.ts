import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PitchShifter } from "soundtouchjs";

import type { ChordSegment, PlaybackState } from "../../types/music";
import { clamp } from "../../utils/time";

const silentChord: ChordSegment = {
  id: "pending-analysis",
  label: "N",
  root: "",
  quality: "Waiting for analysis",
  startSeconds: 0,
  endSeconds: 1,
  tones: [],
};

const playbackTickMs = 50;
const playbackTickSeconds = playbackTickMs / 1000;

interface PlaybackOptions {
  enabled?: boolean;
  availableUntilSeconds?: number;
  audioSourceUrl?: string | null;
  playbackRate?: number;
  pitchSemitones?: number;
  volume?: number;
}

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext(): AudioContext | null {
  const audioWindow = window as AudioWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function applySoundTouchControls(
  shifter: PitchShifter,
  tempoRate: number,
  pitchSemitones: number,
) {
  shifter.tempo = tempoRate;
  shifter.pitchSemitones = pitchSemitones;
}

function seekSoundTouch(shifter: PitchShifter, timeSeconds: number, durationSeconds: number) {
  shifter.percentagePlayed =
    durationSeconds > 0 ? clamp(timeSeconds / durationSeconds, 0, 1) : 0;
  shifter.timePlayed = timeSeconds;
}

function disconnectSoundTouch(shifter: PitchShifter | null, connectedRef: { current: boolean }) {
  if (!shifter || !connectedRef.current) {
    return;
  }

  try {
    shifter.disconnect();
  } catch {
    // The underlying pseudo-node throws if it is already disconnected.
  }
  connectedRef.current = false;
}

export function useMockPlayback(
  chords: ChordSegment[],
  durationSeconds: number,
  options: PlaybackOptions = {},
) {
  const enabled = options.enabled ?? true;
  const availableUntilSeconds = options.availableUntilSeconds ?? durationSeconds;
  const audioSourceUrl = options.audioSourceUrl ?? null;
  const playbackRate = options.playbackRate ?? 1;
  const pitchSemitones = options.pitchSemitones ?? 0;
  const volume = options.volume ?? 1;
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const shifterRef = useRef<PitchShifter | null>(null);
  const shifterConnectedRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const enabledRef = useRef(enabled);
  const hardStopSecondsRef = useRef(availableUntilSeconds || durationSeconds);
  const playbackRateRef = useRef(playbackRate);
  const pitchSemitonesRef = useRef(pitchSemitones);
  const volumeRef = useRef(volume);
  const durationRef = useRef(durationSeconds);
  const lastTickMsRef = useRef<number | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTimeSeconds: 0,
    durationSeconds,
  });
  const hardStopSeconds = Math.min(durationSeconds, availableUntilSeconds || durationSeconds);

  const clampToPlayableTime = useCallback(
    (timeSeconds: number) => clamp(timeSeconds, 0, hardStopSeconds),
    [hardStopSeconds],
  );

  useEffect(() => {
    enabledRef.current = enabled;
    hardStopSecondsRef.current = hardStopSeconds;
    playbackRateRef.current = playbackRate;
    pitchSemitonesRef.current = pitchSemitones;
    volumeRef.current = volume;
    durationRef.current = playback.durationSeconds || durationSeconds;
  }, [durationSeconds, enabled, hardStopSeconds, pitchSemitones, playback.durationSeconds, playbackRate, volume]);

  const startSoundTouchPlayback = useCallback(async () => {
    const shifter = shifterRef.current;
    const audioContext = audioContextRef.current;
    const gain = gainRef.current;

    if (!enabledRef.current || !shifter || !audioContext || !gain) {
      return;
    }

    const audioDuration = shifter.duration || durationRef.current;
    if (
      shifter.timePlayed >= hardStopSecondsRef.current - 0.05 ||
      shifter.timePlayed >= audioDuration - 0.05
    ) {
      seekSoundTouch(shifter, 0, audioDuration);
    }

    applySoundTouchControls(shifter, playbackRateRef.current, pitchSemitonesRef.current);

    try {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (!shifterConnectedRef.current) {
        shifter.connect(gain);
        shifterConnectedRef.current = true;
      }

      pendingPlayRef.current = false;
      lastTickMsRef.current = performance.now();
      setPlayback((current) => ({
        ...current,
        durationSeconds: audioDuration,
        isPlaying: true,
      }));
    } catch {
      setPlayback((current) => ({ ...current, isPlaying: false }));
    }
  }, []);

  useEffect(() => {
    const shifter = shifterRef.current;
    if (shifter) {
      applySoundTouchControls(shifter, playbackRate, pitchSemitones);
    }
    const gain = gainRef.current;
    if (gain) {
      gain.gain.setTargetAtTime(volume, gain.context.currentTime, 0.015);
    }
  }, [pitchSemitones, playbackRate, volume]);

  useEffect(() => {
    if (!audioSourceUrl) {
      disconnectSoundTouch(shifterRef.current, shifterConnectedRef);
      shifterRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const audioContext = createAudioContext();
    if (!audioContext) {
      setPlayback((current) => ({
        ...current,
        isPlaying: false,
        currentTimeSeconds: 0,
        durationSeconds,
      }));
      return undefined;
    }

    const gain = audioContext.createGain();
    gain.gain.value = volumeRef.current;
    gain.connect(audioContext.destination);
    audioContextRef.current = audioContext;
    gainRef.current = gain;

    setPlayback((current) => ({
      ...current,
      isPlaying: false,
      currentTimeSeconds: 0,
      durationSeconds,
    }));

    fetch(audioSourceUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Audio fetch failed: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer.slice(0)))
      .then((audioBuffer) => {
        if (cancelled) {
          return;
        }

        const shifter = new PitchShifter(audioContext, audioBuffer, 4096, () => {
          disconnectSoundTouch(shifterRef.current, shifterConnectedRef);
          setPlayback((current) => ({
            ...current,
            currentTimeSeconds: Math.min(current.durationSeconds, hardStopSecondsRef.current),
            isPlaying: false,
          }));
        });

        applySoundTouchControls(shifter, playbackRateRef.current, pitchSemitonesRef.current);
        shifter.on("play", (detail) => {
          const audioDuration = shifter.duration || audioBuffer.duration;
          const nextTime = clamp(detail.timePlayed ?? shifter.timePlayed, 0, audioDuration);

          if (nextTime >= hardStopSecondsRef.current - 0.08) {
            seekSoundTouch(shifter, hardStopSecondsRef.current, audioDuration);
            disconnectSoundTouch(shifter, shifterConnectedRef);
            setPlayback((current) => ({
              ...current,
              currentTimeSeconds: hardStopSecondsRef.current,
              durationSeconds: audioDuration,
              isPlaying: false,
            }));
            return;
          }

          setPlayback((current) => {
            const shouldResync = Math.abs(current.currentTimeSeconds - nextTime) > 0.75;
            if (shouldResync) {
              lastTickMsRef.current = performance.now();
            }

            return {
              ...current,
              currentTimeSeconds: shouldResync ? nextTime : current.currentTimeSeconds,
              durationSeconds: audioDuration,
              isPlaying: shifterConnectedRef.current,
            };
          });
        });

        shifterRef.current = shifter;
        setPlayback((current) => ({
          ...current,
          durationSeconds: audioBuffer.duration,
          currentTimeSeconds: clamp(current.currentTimeSeconds, 0, audioBuffer.duration),
        }));

        if (pendingPlayRef.current) {
          void startSoundTouchPlayback();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlayback((current) => ({
            ...current,
            isPlaying: false,
          }));
        }
      });

    return () => {
      cancelled = true;
      pendingPlayRef.current = false;
      disconnectSoundTouch(shifterRef.current, shifterConnectedRef);
      shifterRef.current = null;
      gain.disconnect();
      if (audioContextRef.current === audioContext) {
        audioContextRef.current = null;
      }
      if (gainRef.current === gain) {
        gainRef.current = null;
      }
      void audioContext.close();
    };
  }, [audioSourceUrl, durationSeconds, startSoundTouchPlayback]);

  useEffect(() => {
    if (!enabled) {
      pendingPlayRef.current = false;
      lastTickMsRef.current = null;
      disconnectSoundTouch(shifterRef.current, shifterConnectedRef);
    }

    setPlayback((current) => ({
      ...current,
      durationSeconds,
      currentTimeSeconds: clamp(current.currentTimeSeconds, 0, durationSeconds),
      isPlaying: enabled ? current.isPlaying : false,
    }));
  }, [durationSeconds, enabled]);

  useEffect(() => {
    if (!playback.isPlaying || !enabled || audioSourceUrl) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPlayback((current) => {
        const now = performance.now();
        const lastTickMs = lastTickMsRef.current ?? now;
        lastTickMsRef.current = now;
        const elapsedSeconds = Math.max(0, (now - lastTickMs) / 1000);
        const nextTime = current.currentTimeSeconds + elapsedSeconds * playbackRateRef.current;
        if (nextTime >= hardStopSeconds) {
          lastTickMsRef.current = null;
          return {
            ...current,
            isPlaying: false,
            currentTimeSeconds: hardStopSeconds,
          };
        }

        return {
          ...current,
          currentTimeSeconds: nextTime,
        };
      });
    }, playbackTickMs);

    return () => window.clearInterval(timer);
  }, [audioSourceUrl, enabled, hardStopSeconds, playback.isPlaying, playbackRate]);

  useEffect(() => {
    if (!playback.isPlaying || !enabled || !audioSourceUrl) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const shifter = shifterRef.current;
      if (!shifter || !shifterConnectedRef.current) {
        return;
      }

      const audioDuration = shifter.duration || durationRef.current;
      const now = performance.now();
      const lastTickMs = lastTickMsRef.current ?? now;
      lastTickMsRef.current = now;
      const elapsedSeconds = Math.max(0, (now - lastTickMs) / 1000);

      setPlayback((current) => {
        const nextTime = clamp(
          current.currentTimeSeconds + elapsedSeconds * playbackRateRef.current,
          0,
          audioDuration,
        );

        if (nextTime >= hardStopSecondsRef.current - 0.05) {
          lastTickMsRef.current = null;
          seekSoundTouch(shifter, hardStopSecondsRef.current, audioDuration);
          disconnectSoundTouch(shifter, shifterConnectedRef);
          return {
            ...current,
            currentTimeSeconds: hardStopSecondsRef.current,
            durationSeconds: audioDuration,
            isPlaying: false,
          };
        }

        return {
          ...current,
          currentTimeSeconds: nextTime,
          durationSeconds: audioDuration,
          isPlaying: true,
        };
      });
    }, playbackTickMs);

    return () => window.clearInterval(timer);
  }, [audioSourceUrl, enabled, playback.isPlaying]);

  const currentChordIndex = useMemo(() => {
    if (chords.length === 0) {
      return 0;
    }

    const activeIndex = chords.findIndex(
      (chord) =>
        playback.currentTimeSeconds >= chord.startSeconds &&
        playback.currentTimeSeconds < chord.endSeconds,
    );
    return activeIndex === -1 ? Math.max(0, chords.length - 1) : activeIndex;
  }, [chords, playback.currentTimeSeconds]);

  function togglePlayback() {
    if (!enabled) {
      return;
    }

    if (shifterRef.current || audioSourceUrl) {
      if (playback.isPlaying) {
        pause();
      } else {
        play();
      }
      return;
    }

    lastTickMsRef.current = performance.now();
    setPlayback((current) => ({
      ...current,
      isPlaying: current.currentTimeSeconds >= current.durationSeconds ? true : !current.isPlaying,
      currentTimeSeconds:
        current.currentTimeSeconds >= current.durationSeconds ? 0 : current.currentTimeSeconds,
    }));
  }

  function play() {
    if (!enabled) {
      return;
    }

    lastTickMsRef.current = performance.now();

    if (shifterRef.current) {
      void startSoundTouchPlayback();
      return;
    }

    if (audioSourceUrl) {
      pendingPlayRef.current = true;
      return;
    }

    setPlayback((current) => ({
      ...current,
      isPlaying: true,
      currentTimeSeconds:
        current.currentTimeSeconds >= current.durationSeconds ? 0 : current.currentTimeSeconds,
    }));
  }

  function pause() {
    pendingPlayRef.current = false;
    lastTickMsRef.current = null;
    disconnectSoundTouch(shifterRef.current, shifterConnectedRef);
    setPlayback((current) => ({
      ...current,
      isPlaying: false,
    }));
  }

  function seek(nextTimeSeconds: number) {
    const playableTime = clampToPlayableTime(nextTimeSeconds);
    lastTickMsRef.current = playback.isPlaying ? performance.now() : null;
    if (shifterRef.current) {
      seekSoundTouch(shifterRef.current, playableTime, playback.durationSeconds);
    }

    setPlayback((current) => ({
      ...current,
      currentTimeSeconds: playableTime,
    }));
  }

  function skipBy(deltaSeconds: number) {
    const nextTime = clampToPlayableTime(playback.currentTimeSeconds + deltaSeconds);
    lastTickMsRef.current = playback.isPlaying ? performance.now() : null;
    if (shifterRef.current) {
      seekSoundTouch(shifterRef.current, nextTime, playback.durationSeconds);
    }

    setPlayback((current) => ({
      ...current,
      currentTimeSeconds: nextTime,
    }));
  }

  return {
    playback,
    currentChordIndex,
    currentChord: chords[currentChordIndex] ?? silentChord,
    togglePlayback,
    play,
    pause,
    seek,
    skipBy,
  };
}

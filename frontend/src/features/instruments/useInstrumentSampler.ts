import { useCallback, useMemo, useRef } from "react";

import type { ChordSegment, InstrumentTab } from "../../types/music";
import { midiForNote, normalizeNote, pitchClassForNote } from "../../utils/musicTheory";

export interface SampleNote {
  note: string;
  octave: number;
  gain?: number;
  delaySeconds?: number;
}

interface SampleDefinition {
  note: string;
  octave: number;
  midi: number;
  url: string;
}

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

type AudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

const pianoSampleNames = [
  "piano-a2.wav",
  "piano-a3.wav",
  "piano-a4.wav",
  "piano-a5.wav",
  "piano-a6.wav",
  "piano-c2.wav",
  "piano-c3.wav",
  "piano-c4.wav",
  "piano-c5.wav",
  "piano-c6.wav",
  "piano-ds2.wav",
  "piano-ds3.wav",
  "piano-ds4.wav",
  "piano-ds5.wav",
  "piano-ds6.wav",
  "piano-fs2.wav",
  "piano-fs3.wav",
  "piano-fs4.wav",
  "piano-fs5.wav",
  "piano-fs6.wav",
];

const guitarSampleNames = [
  "guitar-a1.flac",
  "guitar-a2.flac",
  "guitar-a3.flac",
  "guitar-a4.flac",
  "guitar-a5.flac",
  "guitar-as1.flac",
  "guitar-as3.flac",
  "guitar-as4.flac",
  "guitar-as5.flac",
  "guitar-b1.flac",
  "guitar-b2.flac",
  "guitar-b3.flac",
  "guitar-b4.flac",
  "guitar-b5.flac",
  "guitar-c2.flac",
  "guitar-c3.flac",
  "guitar-c4.flac",
  "guitar-c5.flac",
  "guitar-c6.flac",
  "guitar-cs2.flac",
  "guitar-cs4.flac",
  "guitar-cs5.flac",
  "guitar-d2.flac",
  "guitar-d3.flac",
  "guitar-d4.flac",
  "guitar-d5.flac",
  "guitar-ds2.flac",
  "guitar-ds4.flac",
  "guitar-ds5.flac",
  "guitar-e2.flac",
  "guitar-e3.flac",
  "guitar-e4.flac",
  "guitar-e5.flac",
  "guitar-f2.flac",
  "guitar-f3.flac",
  "guitar-f4.flac",
  "guitar-f5.flac",
  "guitar-fs3.flac",
  "guitar-fs4.flac",
  "guitar-fs5.flac",
  "guitar-g1.flac",
  "guitar-g2.flac",
  "guitar-g3.flac",
  "guitar-g4.flac",
  "guitar-g5.flac",
  "guitar-gs1.flac",
  "guitar-gs3.flac",
  "guitar-gs5.flac",
];

function decodeSampleName(fileName: string, instrument: InstrumentTab): SampleDefinition {
  const match = /^(?:piano|guitar)-([a-g]s?)(\d)\.(?:wav|flac)$/.exec(fileName);
  if (!match) {
    throw new Error(`Invalid sample file name: ${fileName}`);
  }

  const note = match[1].replace("s", "#").toUpperCase();
  const octave = Number(match[2]);
  return {
    note,
    octave,
    midi: midiForNote(note, octave),
    url: `/samples/${instrument}/${fileName}`,
  };
}

const sampleBanks: Record<InstrumentTab, SampleDefinition[]> = {
  piano: pianoSampleNames.map((name) => decodeSampleName(name, "piano")),
  guitar: guitarSampleNames.map((name) => decodeSampleName(name, "guitar")),
};

function createAudioContext(): AudioContext | null {
  const audioWindow = window as AudioWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function nearestSample(instrument: InstrumentTab, targetMidi: number) {
  const bank = sampleBanks[instrument];
  return bank.reduce((best, sample) =>
    Math.abs(sample.midi - targetMidi) < Math.abs(best.midi - targetMidi) ? sample : best,
  );
}

function releaseVoices(context: AudioContext, voices: ActiveVoice[], releaseSeconds = 0.11) {
  const now = context.currentTime;
  voices.forEach((voice) => {
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, releaseSeconds / 3);
      voice.source.stop(now + releaseSeconds + 0.05);
    } catch {
      // Source nodes can only be stopped once.
    }
  });
}

function targetGain(instrument: InstrumentTab, noteCount: number, explicitGain?: number) {
  if (explicitGain !== undefined) {
    return explicitGain;
  }
  const base = instrument === "piano" ? 0.34 : 0.24;
  return Math.min(base, base / Math.max(1, Math.sqrt(noteCount) * 0.8));
}

function noteToPreferredOctave(note: string, instrument: InstrumentTab) {
  const pc = pitchClassForNote(note);
  if (instrument === "guitar") {
    return pc >= pitchClassForNote("E") ? 2 : 3;
  }
  return pc >= pitchClassForNote("C") && pc <= pitchClassForNote("B") ? 3 : 4;
}

export function notesForPianoChord(chord: ChordSegment): SampleNote[] {
  if (!chord.root || chord.tones.length === 0) {
    return [];
  }

  const rootPc = pitchClassForNote(chord.root);
  const rootOctave = rootPc >= pitchClassForNote("C") && rootPc <= pitchClassForNote("B") ? 3 : 4;
  let previousMidi = midiForNote(chord.root, rootOctave) - 1;

  return chord.tones.slice(0, 5).map((tone) => {
    const note = normalizeNote(tone.note);
    let octave = rootOctave;
    let midi = midiForNote(note, octave);
    while (midi <= previousMidi) {
      octave += 1;
      midi = midiForNote(note, octave);
    }
    previousMidi = midi;
    return { note, octave };
  });
}

export function notesForFallbackGuitarChord(chord: ChordSegment): SampleNote[] {
  return chord.tones.slice(0, 4).map((tone, index) => ({
    note: normalizeNote(tone.note),
    octave: noteToPreferredOctave(tone.note, "guitar") + (index >= 3 ? 1 : 0),
    delaySeconds: index * 0.018,
  }));
}

export function useInstrumentSampler(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const activeChordVoicesRef = useRef<ActiveVoice[]>([]);

  const getContext = useCallback(() => {
    const context = audioContextRef.current ?? createAudioContext();
    if (context) {
      audioContextRef.current = context;
    }
    return context;
  }, []);

  const loadSample = useCallback(async (context: AudioContext, sample: SampleDefinition) => {
    const existing = bufferCacheRef.current.get(sample.url);
    if (existing) {
      return existing;
    }

    const promise = fetch(sample.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load sample ${sample.url}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)));
    bufferCacheRef.current.set(sample.url, promise);
    return promise;
  }, []);

  const releaseActiveChord = useCallback((releaseSeconds = 0.11) => {
    const context = audioContextRef.current;
    if (!context || activeChordVoicesRef.current.length === 0) {
      activeChordVoicesRef.current = [];
      return;
    }

    releaseVoices(context, activeChordVoicesRef.current, releaseSeconds);
    activeChordVoicesRef.current = [];
  }, []);

  const playNotes = useCallback(
    async (
      instrument: InstrumentTab,
      notes: SampleNote[],
      options: { hold?: boolean; durationSeconds?: number; releasePrevious?: boolean } = {},
    ) => {
      if (!enabled || notes.length === 0) {
        return;
      }

      const context = getContext();
      if (!context) {
        return;
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      if (options.releasePrevious ?? options.hold) {
        releaseActiveChord(0.08);
      }

      const now = context.currentTime;
      const voices = await Promise.all(
        notes.map(async (note, index) => {
          const targetMidi = midiForNote(note.note, note.octave);
          const sample = nearestSample(instrument, targetMidi);
          const buffer = await loadSample(context, sample);
          const source = context.createBufferSource();
          const gain = context.createGain();
          const startAt = now + (note.delaySeconds ?? (instrument === "guitar" ? index * 0.018 : index * 0.006));
          const attack = instrument === "guitar" ? 0.006 : 0.012;

          source.buffer = buffer;
          source.playbackRate.setValueAtTime(2 ** ((targetMidi - sample.midi) / 12), startAt);
          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(targetGain(instrument, notes.length, note.gain), startAt + attack);
          source.connect(gain);
          gain.connect(context.destination);
          source.start(startAt);

          if (!options.hold) {
            const duration = options.durationSeconds ?? (instrument === "guitar" ? 1.7 : 1.3);
            gain.gain.setTargetAtTime(0.0001, startAt + duration, 0.08);
            source.stop(startAt + duration + 0.45);
          }

          return { source, gain };
        }),
      );

      if (options.hold) {
        activeChordVoicesRef.current = voices;
      }
    },
    [enabled, getContext, loadSample, releaseActiveChord],
  );

  const playNote = useCallback(
    (instrument: InstrumentTab, note: string, octave = 4, durationSeconds = 0.9) => {
      void playNotes(instrument, [{ note: normalizeNote(note), octave }], { durationSeconds });
    },
    [playNotes],
  );

  const playChord = useCallback(
    (instrument: InstrumentTab, notes: SampleNote[]) => {
      void playNotes(instrument, notes, { hold: true, releasePrevious: true });
    },
    [playNotes],
  );

  return useMemo(
    () => ({
      playNote,
      playChord,
      releaseActiveChord,
    }),
    [playChord, playNote, releaseActiveChord],
  );
}

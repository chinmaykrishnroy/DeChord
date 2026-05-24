declare module "soundtouchjs" {
  export interface PitchShifterPlayDetail {
    timePlayed: number;
    formattedTimePlayed?: string;
    percentagePlayed: number;
  }

  export class PitchShifter {
    constructor(
      context: AudioContext,
      buffer: AudioBuffer,
      bufferSize: number,
      onEnd?: () => void,
    );

    duration: number;
    formattedDuration: string;
    formattedTimePlayed: string;
    percentagePlayed: number;
    pitch: number;
    pitchSemitones: number;
    rate: number;
    sampleRate: number;
    tempo: number;
    timePlayed: number;

    connect(toNode: AudioNode): void;
    disconnect(): void;
    off(eventName?: string | null): void;
    on(eventName: "play", callback: (detail: PitchShifterPlayDetail) => void): void;
  }
}

import { Activity, AudioLines, Gauge, KeyRound, Music2 } from "lucide-react";

import type { AnalysisSummary, ChordSegment, SongSummary } from "../../types/music";
import { getChordToneNotes } from "../../utils/chordNames";

interface AnalysisStripProps {
  song: SongSummary;
  analysis: AnalysisSummary;
  currentChord: ChordSegment;
}

export function AnalysisStrip({ song, analysis, currentChord }: AnalysisStripProps) {
  const chordNotes = getChordToneNotes(currentChord);

  return (
    <section className="analysis-strip" aria-label="Analysis summary">
      <article className="analysis-card analysis-card--song">
        <div className="analysis-card__icon">
          <Music2 size={22} />
        </div>
        <div>
          <span>Song</span>
          <strong>{song.title}</strong>
          <small>{song.artist}</small>
        </div>
      </article>

      <article className="analysis-card">
        <div className="analysis-card__icon">
          <KeyRound size={21} />
        </div>
        <div>
          <span>Key</span>
          <strong>{analysis.key}</strong>
          <small>{currentChord.quality}</small>
        </div>
      </article>

      <article className="analysis-card analysis-card--hero">
        <span>Current</span>
        <strong>{currentChord.label}</strong>
        <small>{chordNotes}</small>
      </article>

      <article className="analysis-card">
        <div className="analysis-card__icon">
          <Gauge size={21} />
        </div>
        <div>
          <span>Tempo</span>
          <strong>{analysis.tempoBpm} BPM</strong>
          <small>{analysis.chordCount} chords</small>
        </div>
      </article>

      <article className="analysis-card">
        <div className="analysis-card__icon">
          <AudioLines size={21} />
        </div>
        <div>
          <span>Engine</span>
          <strong>{analysis.engine}</strong>
          <small>
            <Activity size={12} /> {analysis.status}
          </small>
        </div>
      </article>
    </section>
  );
}

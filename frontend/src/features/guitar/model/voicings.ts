export interface VoicingDefinition {
  frets: Array<number | "x">;
  difficulty: number;
  family: "open" | "barre";
}
export const openVoicings: Record<string, VoicingDefinition> = {
  A: { frets: [0, 2, 2, 2, 0, "x"], difficulty: 1.1, family: "open" },
  Am: { frets: [0, 1, 2, 2, 0, "x"], difficulty: 1.1, family: "open" },
  A7: { frets: [0, 2, 0, 2, 0, "x"], difficulty: 1.3, family: "open" },
  Am7: { frets: [0, 1, 0, 2, 0, "x"], difficulty: 1.4, family: "open" },
  AM7: { frets: [0, 2, 1, 2, 0, "x"], difficulty: 1.8, family: "open" },
  Asus2: { frets: [0, 0, 2, 2, 0, "x"], difficulty: 1.2, family: "open" },
  Asus4: { frets: [0, 3, 2, 2, 0, "x"], difficulty: 1.5, family: "open" },
  B7: { frets: [2, 0, 2, 1, 2, "x"], difficulty: 2.6, family: "open" },
  Bm7: { frets: [2, 0, 2, 0, 2, "x"], difficulty: 2.8, family: "open" },
  C: { frets: [0, 1, 0, 2, 3, "x"], difficulty: 1.2, family: "open" },
  C7: { frets: [0, 1, 3, 2, 3, "x"], difficulty: 2.1, family: "open" },
  CM7: { frets: [0, 0, 0, 2, 3, "x"], difficulty: 1.5, family: "open" },
  Cadd9: { frets: [3, 3, 0, 2, 3, "x"], difficulty: 1.7, family: "open" },
  D: { frets: [2, 3, 2, 0, "x", "x"], difficulty: 1.0, family: "open" },
  Dm: { frets: [1, 3, 2, 0, "x", "x"], difficulty: 1.5, family: "open" },
  D7: { frets: [2, 1, 2, 0, "x", "x"], difficulty: 1.4, family: "open" },
  Dm7: { frets: [1, 1, 2, 0, "x", "x"], difficulty: 1.7, family: "open" },
  DM7: { frets: [2, 2, 2, 0, "x", "x"], difficulty: 1.7, family: "open" },
  Dsus2: { frets: [0, 3, 2, 0, "x", "x"], difficulty: 1.2, family: "open" },
  Dsus4: { frets: [3, 3, 2, 0, "x", "x"], difficulty: 1.3, family: "open" },
  E: { frets: [0, 0, 1, 2, 2, 0], difficulty: 1.0, family: "open" },
  Em: { frets: [0, 0, 0, 2, 2, 0], difficulty: 1.0, family: "open" },
  E7: { frets: [0, 0, 1, 0, 2, 0], difficulty: 1.2, family: "open" },
  Em7: { frets: [0, 3, 0, 0, 2, 0], difficulty: 1.6, family: "open" },
  EM7: { frets: [0, 0, 1, 1, 2, 0], difficulty: 2.2, family: "open" },
  Esus4: { frets: [0, 0, 2, 2, 2, 0], difficulty: 1.4, family: "open" },
  F: { frets: [1, 1, 2, 3, 3, 1], difficulty: 3.8, family: "barre" },
  Fm: { frets: [1, 1, 1, 3, 3, 1], difficulty: 3.9, family: "barre" },
  G: { frets: [3, 0, 0, 0, 2, 3], difficulty: 1.2, family: "open" },
  G7: { frets: [1, 0, 0, 0, 2, 3], difficulty: 1.7, family: "open" },
  GM7: { frets: [2, 0, 0, 0, 2, 3], difficulty: 2.0, family: "open" },
  Gsus4: { frets: [3, 1, 0, 0, 3, 3], difficulty: 2.3, family: "open" },
};

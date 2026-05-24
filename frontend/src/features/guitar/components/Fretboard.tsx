import type { GuitarVoicingShape } from "../model/guitar";
import { guitarStrings } from "../model/guitar";

interface FretboardProps {
  shape: GuitarVoicingShape;
  soundEnabled: boolean;
  onNotePreview: (note: string, octave?: number) => void;
}

const board = {
  width: 980,
  height: 285,
  x: 84,
  y: 42,
  widthInner: 820,
  stringGap: 32,
};

export function Fretboard({ shape, soundEnabled, onNotePreview }: FretboardProps) {
  const isOpenWindow = shape.displayFrets.includes(0);
  const visibleFrets = isOpenWindow
    ? shape.displayFrets.filter((fret) => fret !== 0)
    : shape.displayFrets;
  const fretWidth = board.widthInner / visibleFrets.length;
  const boardHeight = (guitarStrings.length - 1) * board.stringGap;
  const boardBottom = board.y + boardHeight;

  function getFretX(fret: number | "x") {
    if (fret === "x") {
      return board.x - 48;
    }

    if (fret === 0) {
      return board.x - 38;
    }

    const visibleIndex = visibleFrets.indexOf(fret);
    if (visibleIndex === -1) {
      return board.x + fretWidth / 2;
    }

    return board.x + visibleIndex * fretWidth + fretWidth / 2;
  }

  return (
    <svg className="fretboard" viewBox={`0 0 ${board.width} ${board.height}`} role="img">
      <title>Guitar fingering for {shape.label}</title>
      <defs>
        <linearGradient id="fretboardSurface" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="var(--wood-start)" />
          <stop offset="50%" stopColor="var(--wood-mid)" />
          <stop offset="100%" stopColor="var(--wood-end)" />
        </linearGradient>
      </defs>

      <rect className="fretboard-shell" x="30" y="12" width="920" height="246" rx="28" />
      <rect
        className="fretboard-surface"
        fill="url(#fretboardSurface)"
        x={board.x}
        y={board.y - 22}
        width={board.widthInner}
        height={boardHeight + 44}
        rx="20"
      />

      {isOpenWindow && (
        <line
          className="fretboard-nut"
          x1={board.x}
          x2={board.x}
          y1={board.y - 28}
          y2={boardBottom + 22}
        />
      )}

      {visibleFrets.map((fret, index) => {
        const x = board.x + index * fretWidth;
        return (
          <g key={fret}>
            {!isOpenWindow && index === 0 && (
              <line
                className="fretboard-fret"
                x1={x}
                x2={x}
                y1={board.y - 28}
                y2={boardBottom + 22}
              />
            )}
            {index > 0 && (
              <line
                className="fretboard-fret"
                x1={x}
                x2={x}
                y1={board.y - 28}
                y2={boardBottom + 22}
              />
            )}
            <text className="fretboard-fret-label" x={x + fretWidth / 2} y={boardBottom + 46}>
              {fret}
            </text>
          </g>
        );
      })}
      <line
        className="fretboard-fret"
        x1={board.x + board.widthInner}
        x2={board.x + board.widthInner}
        y1={board.y - 28}
        y2={boardBottom + 22}
      />

      {shape.capo > 0 && shape.mode === "open" && (
        <g className="fretboard-capo">
          <rect x={board.x - 18} y={board.y - 30} width="16" height={boardHeight + 60} rx="8" />
          <text x={board.x - 10} y={board.y - 16}>
            capo {shape.capo}
          </text>
        </g>
      )}

      {shape.barreFret && (
        <g className="fretboard-barre">
          <rect
            x={getFretX(shape.barreFret) - 18}
            y={board.y - 18}
            width="36"
            height={boardHeight + 36}
            rx="18"
          />
          <text x={getFretX(shape.barreFret)} y={board.y - 18}>
            barre {shape.barreFret}
          </text>
        </g>
      )}

      {guitarStrings.map((guitarString, stringIndex) => {
        const y = board.y + stringIndex * board.stringGap;
        return (
          <g key={`${guitarString.label}-${stringIndex}`}>
            <text className="fretboard-string-label" x="22" y={y + 5}>
              {guitarString.label}
            </text>
            <line
              className="fretboard-string"
              x1={board.x - 44}
              x2={board.x + board.widthInner}
              y1={y}
              y2={y}
              strokeWidth={Math.max(2.4, 7.4 - stringIndex * 0.75)}
            />
          </g>
        );
      })}

      {shape.positions.map((position) => {
        const y = board.y + position.stringIndex * board.stringGap;
        const x = getFretX(position.fret);
        const isMuted = position.fret === "x";
        const isOpen = position.fret === 0;

        return (
          <g
            className={`fret-marker fret-marker--${position.role ?? "neutral"} ${
              isMuted ? "fret-marker--muted" : ""
            } ${isOpen ? "fret-marker--open" : ""}`}
            key={`${position.stringIndex}-${position.fret}`}
            onClick={() => {
              if (soundEnabled && position.note) {
                onNotePreview(position.note, position.octave);
              }
            }}
            role={position.note ? "button" : undefined}
            tabIndex={position.note ? 0 : undefined}
          >
            {position.note && <title>{`${position.note}${position.octave ?? ""}`}</title>}
            {isMuted ? (
              <>
                <line x1={x - 10} x2={x + 10} y1={y - 10} y2={y + 10} />
                <line x1={x + 10} x2={x - 10} y1={y - 10} y2={y + 10} />
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r={isOpen ? 15 : 20} />
                <text x={x} y={y + 5}>
                  {position.finger ?? position.note}
                </text>
              </>
            )}
          </g>
        );
      })}

      {isOpenWindow && (
        <text className="fretboard-open-label" x={board.x - 38} y={boardBottom + 46}>
          open
        </text>
      )}
    </svg>
  );
}

import type { GuitarVoicingShape } from "../model/guitar";
import { guitarStrings } from "../model/guitar";
import { useEffect, useRef, useState } from "react";
interface Props {
  shape: GuitarVoicingShape;
  soundEnabled: boolean;
  onNotePreview: (note: string, octave?: number) => void;
  orientation?: "auto" | "vertical";
  showLegend?: boolean;
}
export function Fretboard({
  shape,
  soundEnabled,
  onNotePreview,
  orientation = "auto",
  showLegend = true,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 740, height: 240 });
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shape.playable]);
  if (!shape.playable)
    return (
      <div className="empty-state">
        <strong>No safe shape in this mode</strong>
        <p>{shape.message}</p>
      </div>
    );
  const pressedFrets = shape.positions.flatMap((p) =>
    typeof p.fret === "number" && p.fret > 0 ? [p.fret] : [],
  );
  const firstFret = shape.displayFrets.find((f) => f > 0) ?? 1;
  const fretCount = Math.max(
    3,
    pressedFrets.length ? Math.max(...pressedFrets) - firstFret + 1 : 3,
  );
  const frets = shape.displayFrets.filter((f) => f > 0).slice(0, fretCount),
    start = frets[0];
  const play = (i: number) => {
    const p = shape.positions[i];
    if (soundEnabled && p.note) onNotePreview(p.note, p.octave);
  };
  function diagram(vertical: boolean) {
    const width = Math.max(300, size.width),
      height = Math.max(70, size.height - (showLegend ? 18 : 0)),
      inner = width - 84,
      gap = (height - 36) / 5,
      verticalEnd = 70 + frets.length * 44;
    const point = (string: number, fret: number): [number, number] =>
      vertical
        ? [
            42 + (5 - string) * 34,
            70 + (fret === 0 ? -25 : (fret - start + 0.5) * 44),
          ]
        : [
            60 +
              (fret === 0
                ? -26
                : ((fret - start + 0.5) * inner) / frets.length),
            14 + string * gap,
          ];
    return (
      <svg
        className={vertical ? "neck neck--compact" : "neck neck--wide"}
        viewBox={
          vertical ? `0 0 260 ${verticalEnd + 40}` : `0 0 ${width} ${height}`
        }
        role="group"
        aria-label={`${shape.label} fingering, ${shape.playedShape} shape${shape.capo ? `, capo ${shape.capo}` : ""}`}
      >
        <rect
          className="neck-wood"
          x={vertical ? 26 : 60}
          y={vertical ? 70 : 8}
          width={vertical ? 203 : inner}
          height={vertical ? frets.length * 44 : height - 22}
          rx="4"
        />
        {Array.from({ length: frets.length + 1 }, (_, i) =>
          vertical ? (
            <line
              key={`f${i}`}
              className={i === 0 && start === 1 ? "neck-nut" : "neck-fret"}
              x1="26"
              x2="229"
              y1={70 + i * 44}
              y2={70 + i * 44}
            />
          ) : (
            <line
              key={`f${i}`}
              className={i === 0 && start === 1 ? "neck-nut" : "neck-fret"}
              x1={60 + (i * inner) / frets.length}
              x2={60 + (i * inner) / frets.length}
              y1="8"
              y2={height - 14}
            />
          ),
        )}
        {frets.map((f, i) =>
          vertical ? (
            <text className="neck-label" key={f} x="246" y={97 + i * 44}>
              {f}
            </text>
          ) : (
            <text
              className="neck-label"
              key={f}
              x={60 + ((i + 0.5) * inner) / frets.length}
              y={height - 1}
            >
              {f}
            </text>
          ),
        )}
        {guitarStrings.map((s, i) => {
          const [x, y] = point(i, start);
          return (
            <g key={i}>
              {vertical ? (
                <line
                  className="neck-string"
                  x1={x}
                  x2={x}
                  y1="70"
                  y2={verticalEnd}
                  strokeWidth={1 + i * 0.35}
                />
              ) : (
                <line
                  className="neck-string"
                  x1="60"
                  x2={60 + inner}
                  y1={y}
                  y2={y}
                  strokeWidth={1 + i * 0.35}
                />
              )}
              <text
                className="neck-label"
                x={vertical ? x : 12}
                y={vertical ? verticalEnd + 26 : y + 5}
              >
                {s.label}
              </text>
            </g>
          );
        })}
        {shape.barreFret &&
          shape.barreStrings &&
          (() => {
            const a = point(shape.barreStrings[0], shape.barreFret!),
              b = point(shape.barreStrings[1], shape.barreFret!);
            return (
              <line
                className="neck-barre"
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
              />
            );
          })()}
        {shape.positions.map((p, i) => {
          const [x, y] = point(i, p.fret === "x" ? 0 : p.fret);
          return (
            <g
              key={i}
              role={p.note ? "button" : undefined}
              tabIndex={p.note && soundEnabled ? 0 : undefined}
              aria-label={
                p.note
                  ? `Play ${p.note}${p.octave}, ${p.fret === 0 ? "open string" : `finger ${p.finger}, fret ${p.fret}`}`
                  : `Mute ${p.stringLabel} string`
              }
              onClick={() => play(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  play(i);
                }
              }}
              className={`neck-marker ${p.fret === 0 ? "neck-marker--open" : ""} ${p.role === "root" ? "neck-marker--root" : ""}`}
            >
              <title>
                {p.note
                  ? `${p.note}${p.octave} · ${p.fret === 0 ? "open" : `finger ${p.finger}`}`
                  : "Muted string"}
              </title>
              {p.fret === "x" ? (
                <text className="neck-mute" x={x} y={y + 5}>
                  ×
                </text>
              ) : (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={
                      vertical
                        ? p.fret === 0
                          ? 10
                          : 15
                        : Math.max(
                            4,
                            Math.min(p.fret === 0 ? 11 : 17, gap * 0.48),
                          )
                    }
                  />
                  {p.fret !== 0 && (
                    <text
                      x={x}
                      y={y + (vertical ? 5 : Math.min(5, gap * 0.3))}
                      style={{
                        fontSize: vertical ? 16 : Math.min(16, gap * 0.88),
                      }}
                    >
                      {p.finger}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <div
      className={`fretboard-wrap ${orientation === "vertical" ? "fretboard-wrap--vertical" : ""}`}
      ref={container}
    >
      {diagram(false)}
      {diagram(true)}
      {showLegend && (
        <div className="fretboard-legend">
          <span>
            <i /> Root note
          </span>
          <span>1 index · 2 middle · 3 ring · 4 little</span>
          <span>○ open · × mute</span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import type { ChordSegment, LoopRange } from "../../types/music";
import { formatTime } from "../../utils/time";

interface TimelineProps {
  chords: ChordSegment[];
  currentTimeSeconds: number;
  durationSeconds: number;
  tempoBpm: number | null;
  loopRange: LoopRange | null;
  onLoopChange: (range: LoopRange | null) => void;
  onSeek: (timeSeconds: number) => void;
}

interface TimelineBlock {
  chord: ChordSegment;
  index: number;
  x: number;
  width: number;
}

interface ProgressionSummary {
  labels: string[];
  repeats: number;
}

const anchorPercent = 20;
const pixelsPerSecond = 34;
const minChordBlockWidth = 92;
const blockPadding = 48;

function readableBlockWidth(chord: ChordSegment) {
  const durationWidth = Math.max(1, chord.endSeconds - chord.startSeconds) * pixelsPerSecond;
  const labelWidth = chord.label.length * 13 + blockPadding;
  return Math.max(minChordBlockWidth, labelWidth, durationWidth);
}

function buildBlocks(chords: ChordSegment[]) {
  let cursor = 0;
  return chords.map((chord, index) => {
    const width = readableBlockWidth(chord);
    const block = { chord, index, x: cursor, width };
    cursor += width;
    return block;
  });
}

function findActiveIndex(chords: ChordSegment[], currentTimeSeconds: number) {
  const index = chords.findIndex(
    (chord) => currentTimeSeconds >= chord.startSeconds && currentTimeSeconds < chord.endSeconds,
  );
  return index === -1 ? Math.max(0, chords.length - 1) : index;
}

function blockXForTime(blocks: TimelineBlock[], timeSeconds: number) {
  if (blocks.length === 0) {
    return 0;
  }

  const block =
    blocks.find(({ chord }) => timeSeconds >= chord.startSeconds && timeSeconds < chord.endSeconds) ??
    blocks[blocks.length - 1];
  const duration = Math.max(0.01, block.chord.endSeconds - block.chord.startSeconds);
  const progress = Math.max(0, Math.min(1, (timeSeconds - block.chord.startSeconds) / duration));
  return block.x + block.width * progress;
}

function compactLabels(chords: ChordSegment[]) {
  return chords
    .map((chord) => chord.label)
    .filter((label) => label !== "N")
    .filter((label, index, labels) => index === 0 || label !== labels[index - 1]);
}

function detectRepeatedProgression(chords: ChordSegment[]): ProgressionSummary | null {
  const labels = compactLabels(chords);
  let best: ProgressionSummary | null = null;

  for (let length = 2; length <= 6; length += 1) {
    const counts = new Map<string, { labels: string[]; repeats: number }>();
    for (let index = 0; index <= labels.length - length; index += 1) {
      const pattern = labels.slice(index, index + length);
      const key = pattern.join("|");
      const current = counts.get(key) ?? { labels: pattern, repeats: 0 };
      current.repeats += 1;
      counts.set(key, current);
    }

    for (const candidate of counts.values()) {
      if (candidate.repeats < 2) {
        continue;
      }
      if (
        !best ||
        candidate.repeats * candidate.labels.length > best.repeats * best.labels.length
      ) {
        best = candidate;
      }
    }
  }

  return best;
}

function makeBeatMarkers(blocks: TimelineBlock[], durationSeconds: number, tempoBpm: number | null) {
  if (!tempoBpm || tempoBpm <= 0 || blocks.length === 0) {
    return [];
  }

  const beatSeconds = 60 / tempoBpm;
  const maxBeats = Math.min(640, Math.floor(durationSeconds / beatSeconds));
  return Array.from({ length: maxBeats + 1 }, (_, beat) => ({
    beat,
    x: blockXForTime(blocks, beat * beatSeconds),
    isBar: beat % 4 === 0,
  }));
}

function blockIndexAtLaneX(blocks: TimelineBlock[], laneX: number) {
  const index = blocks.findIndex((block) => laneX >= block.x && laneX <= block.x + block.width);
  if (index !== -1) {
    return index;
  }

  return laneX < 0 ? 0 : Math.max(0, blocks.length - 1);
}

function isInLoop(chord: ChordSegment, loopRange: LoopRange | null) {
  return Boolean(
    loopRange &&
      chord.endSeconds > loopRange.startSeconds &&
      chord.startSeconds < loopRange.endSeconds,
  );
}

export function Timeline({
  chords,
  currentTimeSeconds,
  durationSeconds,
  tempoBpm,
  loopRange,
  onLoopChange,
  onSeek,
}: TimelineProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(900);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const blocks = useMemo(() => buildBlocks(chords), [chords]);
  const activeIndex = useMemo(
    () => findActiveIndex(chords, currentTimeSeconds),
    [chords, currentTimeSeconds],
  );
  const progression = useMemo(() => detectRepeatedProgression(chords), [chords]);
  const beatMarkers = useMemo(
    () => makeBeatMarkers(blocks, durationSeconds, tempoBpm),
    [blocks, durationSeconds, tempoBpm],
  );
  const currentX = blockXForTime(blocks, currentTimeSeconds);
  const laneWidth = blocks.length > 0 ? blocks[blocks.length - 1].x + blocks[blocks.length - 1].width : 0;
  const laneTransform = viewportWidth * (anchorPercent / 100) - currentX;
  const dragRange =
    dragStartIndex === null || dragEndIndex === null
      ? null
      : {
          start: Math.min(dragStartIndex, dragEndIndex),
          end: Math.max(dragStartIndex, dragEndIndex),
        };

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    setViewportWidth(node.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      setViewportWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, index: number) {
    viewportRef.current?.setPointerCapture(event.pointerId);
    setDragStartIndex(index);
    setDragEndIndex(index);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartIndex === null || blocks.length === 0 || !viewportRef.current) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const laneX = event.clientX - rect.left - laneTransform;
    setDragEndIndex(blockIndexAtLaneX(blocks, laneX));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStartIndex === null || dragEndIndex === null) {
      return;
    }

    const startIndex = Math.min(dragStartIndex, dragEndIndex);
    const endIndex = Math.max(dragStartIndex, dragEndIndex);
    viewportRef.current?.releasePointerCapture(event.pointerId);
    setDragStartIndex(null);
    setDragEndIndex(null);

    if (startIndex === endIndex) {
      onSeek(chords[startIndex].startSeconds);
      return;
    }

    onLoopChange({
      startSeconds: chords[startIndex].startSeconds,
      endSeconds: chords[endIndex].endSeconds,
    });
  }

  return (
    <section className="timeline-panel" aria-label="Practice progression">
      <div className="timeline-panel__header">
        <div>
          <span>Practice timeline</span>
          <strong>Readable progression lane</strong>
        </div>
        <small>
          {formatTime(currentTimeSeconds)} / {formatTime(durationSeconds)}
        </small>
      </div>

      <div className="timeline-insights">
        {progression ? (
          <div className="timeline-insight">
            <span>Detected progression</span>
            <strong>{progression.labels.join(" | ")}</strong>
            <small>appears {progression.repeats} times</small>
          </div>
        ) : (
          <div className="timeline-insight">
            <span>Detected progression</span>
            <strong>Listening for repeats</strong>
            <small>more chords improve section grouping</small>
          </div>
        )}
        {loopRange && (
          <button className="timeline-loop-chip" onClick={() => onLoopChange(null)} type="button">
            Loop {formatTime(loopRange.startSeconds)}-{formatTime(loopRange.endSeconds)} - clear
          </button>
        )}
      </div>

      <div
        className="timeline-viewport"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
      >
        <div className="timeline-anchor" style={{ left: `${anchorPercent}%` }} />
        {chords.length === 0 && (
          <div className="timeline-empty">Timeline appears after the first chord batch.</div>
        )}
        <div
          className="timeline-lane"
          style={{
            transform: `translate3d(${laneTransform}px, 0, 0)`,
            width: `${laneWidth}px`,
          }}
        >
          <div className="timeline-beats" aria-hidden="true">
            {beatMarkers.map((marker) => (
              <span
                className={marker.isBar ? "timeline-beat timeline-beat--bar" : "timeline-beat"}
                key={marker.beat}
                style={{ left: `${marker.x}px` }}
              >
                {marker.isBar && marker.beat % 16 === 0 && <span>Bar {marker.beat / 4 + 1}</span>}
              </span>
            ))}
          </div>

          <div className="timeline-section-row" aria-hidden="true">
            {blocks
              .filter((_, index) => index % 8 === 0)
              .map((block, sectionIndex) => {
                const nextBlock = blocks[(sectionIndex + 1) * 8] ?? blocks[blocks.length - 1];
                const width =
                  nextBlock === block
                    ? block.width
                    : Math.max(120, nextBlock.x - block.x + nextBlock.width);
                return (
                  <span
                    className="timeline-section"
                    key={`${block.chord.id}-section`}
                    style={{ left: `${block.x}px`, width: `${width}px` }}
                  >
                    Section {sectionIndex + 1}
                  </span>
                );
              })}
          </div>

          <div className="timeline-block-row">
            {blocks.map((block) => {
              const isActive = block.index === activeIndex;
              const isDragging =
                dragRange && block.index >= dragRange.start && block.index <= dragRange.end;
              return (
                <button
                  className={[
                    "timeline-segment",
                    isActive ? "timeline-segment--active" : "",
                    isInLoop(block.chord, loopRange) ? "timeline-segment--loop" : "",
                    isDragging ? "timeline-segment--dragging" : "",
                  ].join(" ")}
                  key={block.chord.id}
                  onPointerDown={(event) => handlePointerDown(event, block.index)}
                  style={{ width: `${block.width}px` }}
                  title={`${block.chord.label} ${formatTime(block.chord.startSeconds)}-${formatTime(block.chord.endSeconds)}`}
                  type="button"
                >
                  <strong>{block.chord.label}</strong>
                  <small>{formatTime(block.chord.startSeconds)}</small>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="timeline-map" aria-label="Song map overview">
        {chords.map((chord) => {
          const widthPercent =
            durationSeconds > 0
              ? ((chord.endSeconds - chord.startSeconds) / durationSeconds) * 100
              : 0;
          return (
            <button
              className={isInLoop(chord, loopRange) ? "timeline-map__segment timeline-map__segment--loop" : "timeline-map__segment"}
              key={`${chord.id}-map`}
              onClick={() => onSeek(chord.startSeconds)}
              style={{ width: `${widthPercent}%` }}
              title={`${chord.label} ${formatTime(chord.startSeconds)}`}
              type="button"
            />
          );
        })}
        <span
          className="timeline-map__cursor"
          style={{
            left: `${durationSeconds > 0 ? (currentTimeSeconds / durationSeconds) * 100 : 0}%`,
          }}
        />
      </div>
    </section>
  );
}

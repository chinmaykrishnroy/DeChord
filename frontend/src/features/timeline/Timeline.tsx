import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { LocateFixed, Repeat2, ZoomIn, ZoomOut } from "lucide-react";
import type { ChordSegment, LoopRange } from "../../types/music";
import { formatTime } from "../../utils/time";
import { timelineScale, timelineZooms, followScroll } from "./geometry";
import { animateTimeline } from "./animation";
interface Props {
  chords: ChordSegment[];
  currentTimeSeconds: number;
  readTime: () => number;
  isPlaying: boolean;
  durationSeconds: number;
  tempoBpm: number | null;
  loopRange: LoopRange | null;
  onLoopChange: (r: LoopRange | null) => void;
  onSeek: (time: number) => void;
}
export function Timeline({
  chords,
  currentTimeSeconds,
  readTime,
  isPlaying,
  durationSeconds,
  loopRange,
  onLoopChange,
  onSeek,
}: Props) {
  const [zoom, setZoom] = useState(1),
    [follow, setFollow] = useState(true),
    [selection, setSelection] = useState<LoopRange | null>(null),
    [viewportWidth, setViewportWidth] = useState(800);
  const viewport = useRef<HTMLDivElement>(null),
    lane = useRef<HTMLDivElement>(null),
    movingPlayhead = useRef<HTMLDivElement>(null),
    drag = useRef<{ start: number; x: number } | null>(null);
  const duration = Math.max(durationSeconds, 1),
    pixelsPerSecond = timelineScale(chords, zoom),
    axisWidth = Math.max(viewportWidth, duration * pixelsPerSecond),
    anchor = Math.round(Math.min(200, viewportWidth * 0.25)),
    percent = (time: number) =>
      Math.max(0, Math.min(100, (time / duration) * 100));
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      setFollow(false);
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        el.scrollBy({
          left:
            event.deltaY *
            (event.deltaMode === 1
              ? 16
              : event.deltaMode === 2
                ? el.clientWidth
                : 1),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const draw = (time: number) => {
      if (follow) el.scrollLeft = followScroll(time, duration, axisWidth);
      else if (movingPlayhead.current)
        movingPlayhead.current.style.left = `${Math.max(0, Math.min(100, (time / duration) * 100))}%`;
    };
    draw(currentTimeSeconds);
    if (isPlaying) return animateTimeline(readTime, draw);
  }, [duration, follow, axisWidth, isPlaying, readTime]);
  useLayoutEffect(() => {
    if (!isPlaying && follow && viewport.current)
      viewport.current.scrollLeft = followScroll(
        currentTimeSeconds,
        duration,
        axisWidth,
      );
  }, [currentTimeSeconds, isPlaying, follow, duration, axisWidth]);
  function timeAt(e: PointerEvent) {
    const rect = lane.current!.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration),
    );
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (!chords.length) return;
    drag.current = { start: timeAt(e), x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag.current || Math.abs(e.clientX - drag.current.x) < 5) return;
    const t = timeAt(e);
    setSelection({
      startSeconds: Math.min(t, drag.current.start),
      endSeconds: Math.max(t, drag.current.start),
    });
  }
  function up(e: PointerEvent) {
    if (!drag.current) return;
    const t = timeAt(e);
    if (Math.abs(e.clientX - drag.current.x) < 5)
      onSeek(
        chords.find((c) => t >= c.startSeconds && t < c.endSeconds)
          ?.startSeconds ?? t,
      );
    else if (Math.abs(t - drag.current.start) > 0.1)
      onLoopChange({
        startSeconds: Math.min(t, drag.current.start),
        endSeconds: Math.max(t, drag.current.start),
      });
    drag.current = null;
    setSelection(null);
  }
  const shownLoop = selection ?? loopRange;
  return (
    <section className="practice-timeline" aria-label="Practice timeline">
      <div className="timeline-toolbar">
        <span>
          {loopRange ? (
            <>
              <Repeat2 size={14} /> {formatTime(loopRange.startSeconds)}–
              {formatTime(loopRange.endSeconds)}{" "}
              <button
                className="text-button"
                onClick={() => onLoopChange(null)}
              >
                Clear loop
              </button>
            </>
          ) : (
            "Practice timeline · click to seek · drag to loop"
          )}
        </span>
        <div>
          <button
            className={`icon-button ${follow ? "selected" : ""}`}
            aria-label="Follow playback"
            aria-pressed={follow}
            title={
              follow
                ? "Scroll chords under a fixed playhead"
                : "Follow playback with a fixed playhead"
            }
            onClick={() => setFollow((v) => !v)}
          >
            <LocateFixed size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out timeline"
            disabled={zoom === 0.25}
            onClick={() => setZoom((v) => Math.max(0.25, v / 2))}
          >
            <ZoomOut size={16} />
          </button>
          <select
            className="timeline-zoom"
            aria-label="Timeline zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {timelineZooms.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
          <button
            className="icon-button"
            aria-label="Zoom in timeline"
            disabled={zoom === 16}
            onClick={() => setZoom((v) => Math.min(16, v * 2))}
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div className="timeline-viewport">
        <div
          className="timeline-scroll"
          ref={viewport}
          tabIndex={0}
          aria-label="Scrollable chord timeline"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              setFollow(false);
              event.currentTarget.scrollBy({
                left:
                  (event.key === "ArrowRight" ? 1 : -1) *
                  event.currentTarget.clientWidth *
                  0.75,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              });
            }
          }}
        >
          <div
            className="time-lane"
            ref={lane}
            style={{
              width: `${axisWidth}px`,
              marginLeft: anchor,
              marginRight: viewportWidth - anchor,
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => {
              drag.current = null;
              setSelection(null);
            }}
          >
            <div className="time-ruler">
              {Array.from(
                {
                  length:
                    Math.min(
                      1000,
                      Math.ceil(
                        duration /
                          Math.max(1, Math.ceil(100 / pixelsPerSecond)),
                      ),
                    ) + 1,
                },
                (_, i) => {
                  const t = Math.min(
                    duration,
                    i * Math.max(1, Math.ceil(100 / pixelsPerSecond)),
                  );
                  return (
                    <span key={i} style={{ left: `${percent(t)}%` }}>
                      {formatTime(t)}
                    </span>
                  );
                },
              )}
            </div>
            <div className="chord-lane">
              {chords.map((chord) => (
                <button
                  key={chord.id}
                  className={`time-chord ${currentTimeSeconds >= chord.startSeconds && currentTimeSeconds < chord.endSeconds ? "is-current" : ""}`}
                  style={{
                    left: `${percent(chord.startSeconds)}%`,
                    width: `${((chord.endSeconds - chord.startSeconds) / duration) * 100}%`,
                  }}
                  aria-label={`Seek ${chord.label} at ${formatTime(chord.startSeconds)}`}
                  title={`${chord.label} · ${formatTime(chord.startSeconds)}–${formatTime(chord.endSeconds)}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSeek(chord.startSeconds);
                    }
                  }}
                >
                  <strong>{chord.label}</strong>
                </button>
              ))}
            </div>
            {shownLoop && (
              <div
                className="loop-overlay"
                style={{
                  left: `${percent(shownLoop.startSeconds)}%`,
                  width: `${((shownLoop.endSeconds - shownLoop.startSeconds) / duration) * 100}%`,
                }}
              />
            )}
            {!follow && (
              <div
                ref={movingPlayhead}
                className="time-playhead"
                style={{ left: `${percent(currentTimeSeconds)}%` }}
              >
                <i />
              </div>
            )}
            {!chords.length && (
              <span className="timeline-empty">
                Your analyzed chords will appear here
              </span>
            )}
          </div>
        </div>
        {follow && (
          <div
            className="time-playhead time-playhead--fixed"
            style={{ left: anchor }}
            aria-label="Fixed playhead"
          >
            <i />
          </div>
        )}
      </div>
      <div className="timeline-map" aria-label="Song overview">
        <input
          aria-label="Timeline seek"
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={Math.min(duration, currentTimeSeconds)}
          onChange={(e) => onSeek(+e.target.value)}
        />
        <span>
          {formatTime(currentTimeSeconds)} / {formatTime(durationSeconds)}
        </span>
      </div>
    </section>
  );
}

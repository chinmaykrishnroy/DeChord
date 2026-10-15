import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { centeredLyricScroll } from "../../utils/lyricsScroll";
import { useAlbumPalette } from "./useAlbumPalette";
import { FileText, Search } from "lucide-react";
import type { useBackendWorkspace } from "./useBackendWorkspace";
import { formatTime } from "../../utils/time";
import { usePracticePreferences } from "./usePracticeSession";
export function LyricsWidget({
  backend,
  time,
  onSeek,
}: {
  backend: ReturnType<typeof useBackendWorkspace>;
  time: number;
  onSeek: (n: number) => void;
}) {
  const [title, setTitle] = useState(""),
    [artist, setArtist] = useState(""),
    [follow, setFollow] = useState(true),
    [lyricHeight, setLyricHeight] = useState(0),
    [lyricWidth, setLyricWidth] = useState(0);
  const { lyricOffset: offset, setLyricOffset: setOffset } =
    usePracticePreferences();
  const input = useRef<HTMLInputElement>(null),
    activeLine = useRef<HTMLButtonElement>(null),
    linesViewport = useRef<HTMLDivElement>(null);
  const centered = useRef(false);
  const palette = useAlbumPalette(backend.albumArtUrl);
  useEffect(() => {
    setTitle(backend.song?.title ?? "");
    setArtist("");
    setFollow(true);
    centered.current = false;
  }, [backend.song?.id]);
  const timed = useMemo(
    () =>
      backend.lyrics.lines
        .filter((l) => l.timeSeconds !== null)
        .sort((a, b) => a.timeSeconds! - b.timeSeconds!),
    [backend.lyrics.lines],
  );
  const index = timed.reduce(
    (last, line, i) => (line.timeSeconds! <= time + offset ? i : last),
    -1,
  );
  const currentId = timed[index]?.id;
  useLayoutEffect(() => {
    const line = activeLine.current,
      container = linesViewport.current;
    if (!follow || !line || !container || container.clientHeight <= 0) return;
    const nextTop = centeredLyricScroll(
      container.scrollTop,
      container.getBoundingClientRect().top,
      container.clientHeight,
      line.getBoundingClientRect().top,
      line.getBoundingClientRect().height,
    );
    const immediate =
      !centered.current ||
      Math.abs(nextTop - container.scrollTop) > container.clientHeight ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: nextTop,
      behavior: immediate ? "instant" : "smooth",
    });
    centered.current = true;
  }, [currentId, follow, lyricHeight, lyricWidth]);
  useEffect(() => {
    const el = linesViewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setLyricHeight(el.clientHeight);
      setLyricWidth(el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [backend.lyrics.lines.length]);
  return (
    <div className="lyrics-widget" style={palette}>
      <div className="lyrics-options">
        <label>
          <input
            type="checkbox"
            checked={backend.autoLyrics}
            onChange={(e) => backend.setAutoLyrics(e.target.checked)}
          />
          Auto-fetch synced lyrics
        </label>
        <button
          className="icon-button"
          aria-label="Import lyrics file"
          onClick={() => input.current?.click()}
        >
          <FileText size={17} />
        </button>
        <input
          type="file"
          accept=".lrc,.txt"
          className="sr-only"
          ref={input}
          onChange={(e) => {
            if (e.target.files?.[0])
              void backend.importLyricsFile(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      <details className="lyrics-search">
        <summary>Find lyrics for this song</summary>
        <label>
          Song title
          <input
            aria-label="Lyrics song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Artist
          <input
            aria-label="Lyrics artist"
            placeholder="Artist name"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </label>
        <button
          disabled={!backend.song || backend.lyrics.status === "loading"}
          onClick={() => void backend.downloadLyrics(title, artist)}
        >
          <Search size={14} /> Find synced lyrics
        </button>
        <small>
          Search sends title, artist and duration to LRCLIB. Audio stays local.
        </small>
      </details>
      {backend.lyrics.status === "loading" && (
        <p className="loading-note" role="status">
          Finding lyrics…
        </p>
      )}
      {backend.lyrics.error && (
        <p className="inline-error" role="status">
          {backend.lyrics.error}
        </p>
      )}
      {!backend.lyrics.lines.length && backend.lyrics.status !== "loading" ? (
        <div className="empty-state lyric-empty">
          <FileText size={30} />
          <strong>Every word, in time.</strong>
          <p>
            Import a song to find synced lyrics, or drop in your own .lrc file.
          </p>
          <button onClick={() => input.current?.click()}>Import lyrics</button>
        </div>
      ) : (
        <div
          className={`lyrics-lines ${backend.lyrics.synced ? "is-synced" : ""}`}
          ref={linesViewport}
          style={{
            paddingBlock: backend.lyrics.synced
              ? Math.max(18, lyricHeight / 2 - 20)
              : 20,
          }}
          onWheel={() => setFollow(false)}
          onTouchMove={() => setFollow(false)}
          aria-label="Song lyrics"
        >
          {(backend.lyrics.synced ? timed : backend.lyrics.lines).map(
            (line) => (
              <button
                ref={line.id === currentId ? activeLine : undefined}
                key={line.id}
                className={line.id === currentId ? "is-active" : ""}
                aria-current={line.id === currentId ? "true" : undefined}
                disabled={line.timeSeconds === null}
                onClick={() => onSeek(Math.max(0, line.timeSeconds! - offset))}
              >
                {line.text.trim() || "♪"}
              </button>
            ),
          )}
        </div>
      )}
      <div className="lyrics-bottom">
        <span>
          {backend.lyrics.synced
            ? "Synced lyrics"
            : backend.lyrics.lines.length
              ? "Plain lyrics"
              : "Lyrics"}
        </span>
        {backend.lyrics.synced && (
          <>
            <label>
              Offset{" "}
              <input
                aria-label="Lyrics offset seconds"
                type="number"
                step="0.25"
                min="-30"
                max="30"
                value={offset}
                onChange={(e) => setOffset(+e.target.value)}
              />{" "}
              s
            </label>
            <button
              className="text-button"
              aria-pressed={follow}
              onClick={() => setFollow((v) => !v)}
            >
              {follow ? "Following" : "Follow"}
            </button>
          </>
        )}
        <small>{formatTime(time)}</small>
      </div>
    </div>
  );
}

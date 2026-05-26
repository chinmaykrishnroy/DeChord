import type { LyricsLine, LyricsState } from "../types/music";

const timeTagPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?]/g;
const metadataTagPattern = /^\[(?:ar|al|ti|au|by|re|ve|id|length|offset):.*]$/i;
const bracketTagPattern = /\[[^\]]+]/g;
const unusableLyricsPattern = /^(?:not\s*found|no\s+lyrics?\s+found|lyrics?\s+unavailable|unavailable)$/i;

function parseTime(minutes: string, seconds: string, fraction = "0") {
  const normalizedFraction = fraction.padEnd(3, "0").slice(0, 3);
  return Number(minutes) * 60 + Number(seconds) + Number(normalizedFraction) / 1000;
}

export function hasUsableLyricsText(text: string) {
  const body = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(bracketTagPattern, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return body.length > 0 && !unusableLyricsPattern.test(body);
}

export function parseLyrics(text: string, source: LyricsState["source"]): LyricsState {
  const lines: LyricsLine[] = [];
  if (!hasUsableLyricsText(text)) {
    return {
      status: "empty",
      source,
      synced: false,
      text: "",
      lines,
      error: null,
    };
  }

  const rawLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  rawLines.forEach((line, index) => {
    if (metadataTagPattern.test(line)) {
      return;
    }

    const matches = Array.from(line.matchAll(timeTagPattern));
    if (matches.length === 0) {
      lines.push({
        id: `line-${index}`,
        timeSeconds: null,
        text: line.replace(/^\[[^\]]+]\s*/, ""),
      });
      return;
    }

    const lastMatch = matches[matches.length - 1];
    const body = line.slice((lastMatch.index ?? 0) + lastMatch[0].length).trim();
    matches.forEach((match, matchIndex) => {
      lines.push({
        id: `line-${index}-${matchIndex}-${match[1]}-${match[2]}-${match[3] ?? "0"}`,
        timeSeconds: parseTime(match[1], match[2], match[3]),
        text: body || " ",
      });
    });
  });

  return {
    status: lines.length > 0 ? "ready" : "empty",
    source,
    synced: lines.some((line) => line.timeSeconds !== null),
    text,
    lines,
    error: null,
  };
}

export const emptyLyrics: LyricsState = {
  status: "empty",
  source: "none",
  synced: false,
  text: "",
  lines: [],
  error: null,
};

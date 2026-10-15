"""Synced-lyrics provider matching, independent of HTTP routes and audio analysis."""
from __future__ import annotations
import json
import re
import time
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen

def _looks_synced_lyrics(text: str) -> bool:
    return any(line.startswith("[") and ":" in line[:12] for line in text.splitlines())


_LOCAL_ARTISTS = {"", "local file", "local demo", "unknown artist"}


def _clean_lyric_lookup_text(value: str | None) -> str:
    text = (value or "").strip()
    text = re.sub(r"\.[A-Za-z0-9]{2,5}$", "", text)
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(
        r"\s*(?:\(|\[)\s*(?:official|lyrics?|lyric video|audio|video|hd|4k).*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text.strip(" -_")


def _split_artist_title(title: str, artist: str | None) -> tuple[str, str | None]:
    clean_title = _clean_lyric_lookup_text(title)
    clean_artist = _clean_lyric_lookup_text(artist)

    if clean_artist.lower() in _LOCAL_ARTISTS:
        clean_artist = ""

    if not clean_artist:
        parts = re.split(r"\s+[-–—]\s+", clean_title, maxsplit=1)
        if len(parts) == 2 and all(parts):
            clean_artist, clean_title = parts[0].strip(), parts[1].strip()

    return clean_title, clean_artist or None


def _lrclib_queries(title: str, artist: str | None, duration: float | None) -> list[dict[str, str]]:
    clean_title, clean_artist = _split_artist_title(title, artist)
    original_title = _clean_lyric_lookup_text(title)
    rounded_duration = str(round(duration)) if duration else None
    raw_queries: list[dict[str, str]] = []

    if clean_title:
        base = {"track_name": clean_title}
        if clean_artist:
            base["artist_name"] = clean_artist
        raw_queries.append({**base, **({"duration": rounded_duration} if rounded_duration else {})})
        raw_queries.append(base)

    if original_title and original_title != clean_title:
        raw_queries.append({"track_name": original_title})

    seen: set[tuple[tuple[str, str], ...]] = set()
    queries: list[dict[str, str]] = []
    for query in raw_queries:
        key = tuple(sorted(query.items()))
        if query.get("track_name") and key not in seen:
            seen.add(key)
            queries.append(query)
    return queries


def _pick_lrclib_result(payload: Any, duration: float | None, title: str | None = None, artist: str | None = None) -> dict[str, Any] | None:
    if not isinstance(payload, list) or not payload:
        return None

    with_lyrics = [
        item for item in payload
        if isinstance(item, dict) and (item.get("syncedLyrics") or item.get("plainLyrics"))
    ]
    if not with_lyrics:
        return None

    def normalized(text):
        return re.sub(r"[^\w]+", " ", str(text).casefold()).strip()
    if title:
        with_lyrics = [item for item in with_lyrics if SequenceMatcher(None, normalized(item.get("trackName", "")), normalized(title)).ratio() >= .65]
    if artist:
        with_lyrics = [item for item in with_lyrics if SequenceMatcher(None, normalized(item.get("artistName", "")), normalized(artist)).ratio() >= .5]
    if not with_lyrics:
        return None

    synced = [item for item in with_lyrics if item.get("syncedLyrics")]
    if duration:
        close_synced = [item for item in synced if abs(float(item.get("duration") or 0) - duration) <= 8]
        if close_synced:
            with_lyrics = close_synced
        return min(
            with_lyrics,
            key=lambda item: abs(float(item.get("duration") or duration) - duration),
        )

    return with_lyrics[0]


def _download_lrclib_lyrics(title: str, artist: str | None, duration: float | None) -> tuple[str, bool] | None:
    last_error: Exception | None = None
    clean_title, clean_artist = _split_artist_title(title, artist)
    queries = [("search", query) for query in _lrclib_queries(title, artist, duration)[:2]]
    if clean_artist:
        queries.insert(0, ("get", {"track_name": clean_title, "artist_name": clean_artist, **({"duration": str(round(duration))} if duration else {})}))
    deadline = time.monotonic() + 15
    for endpoint, query in queries:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        url = f"https://lrclib.net/api/{endpoint}?{urlencode(query)}"
        request = UrlRequest(url, headers={"User-Agent": "DeChord/0.1 local-desktop"})
        try:
            with urlopen(request, timeout=min(6, remaining)) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last_error = exc
            continue

        best = _pick_lrclib_result([payload] if isinstance(payload, dict) else payload, duration, clean_title, clean_artist)
        if best is None:
            continue

        synced = best.get("syncedLyrics")
        plain = best.get("plainLyrics")
        if synced:
            return str(synced), True
        if plain:
            return str(plain), False
    if last_error is not None:
        raise last_error
    return None

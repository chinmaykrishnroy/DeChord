import { useEffect, useState, useMemo, type CSSProperties } from "react";
import {
  extractLyricsPalette,
  getFallbackLyricsPalette,
  type LyricsPalette,
} from "../../utils/colorPalette";

const cache = new Map<string, Promise<LyricsPalette>>();
export function useAlbumPalette(url: string | null): CSSProperties {
  const [palette, setPalette] = useState<LyricsPalette>(
    getFallbackLyricsPalette,
  );
  useEffect(() => {
    let disposed = false;
    if (!url) {
      setPalette(getFallbackLyricsPalette());
      return;
    }
    let pending = cache.get(url);
    if (!pending) {
      if (cache.size >= 16) cache.clear();
      pending = extractLyricsPalette(url).catch(() =>
        getFallbackLyricsPalette(),
      );
      cache.set(url, pending);
    }
    void pending.then((value) => {
      if (!disposed) setPalette(value);
    });
    return () => {
      disposed = true;
    };
  }, [url]);
  return useMemo(
    () =>
      ({
        "--lyrics-bg": palette.background,
        "--lyrics-fg": palette.foreground === "#11130f" ? "#11130f" : "#ffffff",
        "--lyrics-muted":
          palette.foreground === "#11130f"
            ? "rgba(17,19,15,.76)"
            : "rgba(255,255,255,.76)",
        "--lyrics-accent": palette.accent,
        "--lyrics-shadow": palette.shadow,
      }) as CSSProperties,
    [palette],
  );
}

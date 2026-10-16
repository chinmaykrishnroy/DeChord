import { useState } from "react";
import { Music2 } from "lucide-react";
import { songArtworkUrl } from "../../services/backendClient";

export function SongCover({ songId }: { songId: string }) {
  const src = songArtworkUrl(songId);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span className="mini-cover" aria-hidden="true">
      {failedSrc === src ? (
        <Music2 size={17} />
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}

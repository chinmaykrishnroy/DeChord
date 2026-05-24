import { FileMusic, Headphones, Settings, SlidersHorizontal } from "lucide-react";

interface SideRailProps {
  onOpenSettings: () => void;
}

export function SideRail({ onOpenSettings }: SideRailProps) {
  return (
    <aside className="side-rail" aria-label="Primary app tools">
      <button className="side-rail__button side-rail__button--active" type="button" aria-label="Song workspace">
        <FileMusic size={22} />
      </button>
      <button className="side-rail__button" type="button" aria-label="Practice monitor">
        <Headphones size={21} />
      </button>
      <button className="side-rail__button" type="button" aria-label="Audio controls">
        <SlidersHorizontal size={21} />
      </button>
      <div className="side-rail__spacer" />
      <button className="side-rail__button" type="button" aria-label="Settings" onClick={onOpenSettings}>
        <Settings size={20} />
      </button>
    </aside>
  );
}

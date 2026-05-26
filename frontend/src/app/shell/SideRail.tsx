import { AudioLines, ListMusic, ScrollText, Settings, SlidersHorizontal } from "lucide-react";

import type { WorkspacePanel } from "../../types/music";

interface SideRailProps {
  activePanel: WorkspacePanel;
  onPanelChange: (panel: WorkspacePanel) => void;
  onOpenSettings: () => void;
}

export function SideRail({ activePanel, onPanelChange, onOpenSettings }: SideRailProps) {
  return (
    <aside className="side-rail" aria-label="Primary app tools">
      <button
        className={activePanel === "studio" ? "side-rail__button side-rail__button--active" : "side-rail__button"}
        onClick={() => onPanelChange("studio")}
        type="button"
        aria-label="Studio"
      >
        <AudioLines size={20} />
      </button>
      <button
        className={activePanel === "lyrics" ? "side-rail__button side-rail__button--active" : "side-rail__button"}
        onClick={() => onPanelChange("lyrics")}
        type="button"
        aria-label="Lyrics"
      >
        <ScrollText size={20} />
      </button>
      <button
        className={activePanel === "analysis" ? "side-rail__button side-rail__button--active" : "side-rail__button"}
        onClick={() => onPanelChange("analysis")}
        type="button"
        aria-label="Analysis controls"
      >
        <SlidersHorizontal size={21} />
      </button>
      <button
        className={activePanel === "practice" ? "side-rail__button side-rail__button--active" : "side-rail__button"}
        onClick={() => onPanelChange("practice")}
        type="button"
        aria-label="Practice tools"
      >
        <ListMusic size={20} />
      </button>
      <div className="side-rail__spacer" />
      <button className="side-rail__button" type="button" aria-label="Settings" onClick={onOpenSettings}>
        <Settings size={20} />
      </button>
    </aside>
  );
}

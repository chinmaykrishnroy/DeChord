import { Minus, Square, X } from "lucide-react";
import { AppLogo } from "./AppLogo";

async function runWindowAction(action: "minimize" | "maximize" | "close") {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = getCurrentWindow();

    if (action === "minimize") {
      await currentWindow.minimize();
    } else if (action === "maximize") {
      await currentWindow.toggleMaximize();
    } else {
      await currentWindow.close();
    }
  } catch {
    if (action === "close") {
      window.close();
    }
  }
}

export function TitleBar() {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar__brand" data-tauri-drag-region>
        <div className="brand-mark" aria-hidden="true">
          <AppLogo />
        </div>
        <div data-tauri-drag-region>
          <strong>DeChord</strong>
          <span>Practice workstation</span>
        </div>
      </div>

      <div className="window-controls">
        <button aria-label="Minimize window" type="button" onClick={() => runWindowAction("minimize")}>
          <Minus size={15} />
        </button>
        <button aria-label="Maximize window" type="button" onClick={() => runWindowAction("maximize")}>
          <Square size={13} />
        </button>
        <button
          aria-label="Close window"
          className="window-controls__close"
          type="button"
          onClick={() => runWindowAction("close")}
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { configureDesktopEngine } from "./services/backendClient";
import "./styles/studio.css";
import "./styles/workspace-polish.css";

async function start() {
  if (isTauri()) {
    const connection = await invoke<{ url: string; token: string }>(
      "backend_connection",
    );
    configureDesktopEngine(connection);
  }
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start().catch((error) => {
  const root = document.getElementById("root")!;
  root.textContent = `DeChord could not start its local engine: ${String(error)}. See engine.log in the app data folder.`;
});

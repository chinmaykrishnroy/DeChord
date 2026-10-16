import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { configureDesktopEngine } from "./services/backendClient";
import "./styles/studio.css";
import "./styles/workspace-polish.css";
import "./styles/startup.css";
import mark from "./assets/dechord-mark.svg";

function startupPanel(title: string, message: string) {
  const panel = document.createElement("section");
  panel.className = "startup-panel";
  panel.setAttribute("role", "status");
  const logo = document.createElement("img");
  logo.src = mark;
  logo.alt = "";
  const heading = document.createElement("h1");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  const elapsed = document.createElement("small");
  panel.append(logo, heading, detail, elapsed);
  document.getElementById("root")!.replaceChildren(panel);
  return elapsed;
}

async function start() {
  if (isTauri()) {
    const elapsed = startupPanel(
      "Starting DeChord",
      "Preparing your local analysis engine. First launch can take a few minutes on a busy computer.",
    );
    const started = Date.now();
    const timer = window.setInterval(() => {
      elapsed.textContent = `Starting locally · ${Math.floor((Date.now() - started) / 1000)}s`;
    }, 1000);
    try {
      const connection = await invoke<{ url: string; token: string }>(
        "backend_connection",
      );
      configureDesktopEngine(connection);
    } finally {
      window.clearInterval(timer);
    }
  }
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start().catch((error) => {
  startupPanel("DeChord could not start", String(error));
});

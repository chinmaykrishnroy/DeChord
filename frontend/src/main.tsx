import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { configureDesktopEngine } from "./services/backendClient";
import "./styles/studio.css";
import "./styles/workspace-polish.css";
import "./styles/startup.css";
import mark from "./assets/dechord-mark.svg";
import { TitleBar } from "./app/shell/TitleBar";

const root = createRoot(document.getElementById("root") as HTMLElement);

function StartupScreen({
  title,
  message,
  waiting = false,
}: {
  title: string;
  message: string;
  waiting?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);
  return (
    <>
      <TitleBar />
      <section className="startup-panel" role="status">
        <img src={mark} alt="" />
        <h1>{title}</h1>
        <p>{message}</p>
        {waiting && (
          <small aria-hidden="true">Starting locally · {elapsed}s</small>
        )}
      </section>
    </>
  );
}

async function start() {
  if (isTauri()) {
    root.render(
      <StartupScreen
        title="Starting DeChord"
        message="Preparing your local analysis engine. First launch can take a few minutes on a busy computer."
        waiting
      />,
    );
    const connection = await invoke<{ url: string; token: string }>(
      "backend_connection",
    );
    configureDesktopEngine(connection);
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start().catch((error) => {
  root.render(
    <StartupScreen title="DeChord could not start" message={String(error)} />,
  );
});

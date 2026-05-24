import { Moon, Sun } from "lucide-react";
import type { CSSProperties } from "react";

import type { ThemeSettings } from "../../types/music";

interface SettingsPanelProps {
  open: boolean;
  settings: ThemeSettings;
  onChange: (settings: ThemeSettings) => void;
  onClose: () => void;
}

const huePresets = [
  { label: "Amber", value: 15 },
  { label: "Purple", value: 260 },
  { label: "Blue", value: 224 },
  { label: "Pink", value: 340 },
  { label: "Green", value: 145 },
];

export function SettingsPanel({ open, settings, onChange, onClose }: SettingsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className="settings-panel" aria-label="Theme settings">
      <div className="settings-panel__header">
        <div>
          <span>Settings</span>
          <strong>Theme studio</strong>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="settings-section">
        <span>Appearance</span>
        <div className="segmented-control segmented-control--wide" role="group" aria-label="Theme mode">
          <button
            className={settings.mode === "dark" ? "active" : ""}
            onClick={() => onChange({ ...settings, mode: "dark" })}
            type="button"
          >
            <Moon size={16} /> Dark
          </button>
          <button
            className={settings.mode === "light" ? "active" : ""}
            onClick={() => onChange({ ...settings, mode: "light" })}
            type="button"
          >
            <Sun size={16} /> Light
          </button>
        </div>
      </div>

      <div className="settings-section">
        <span>Hue</span>
        <input
          aria-label="Theme hue"
          max={360}
          min={0}
          onChange={(event) => onChange({ ...settings, hue: Number(event.target.value) })}
          type="range"
          value={settings.hue}
        />
        <div className="hue-value">{settings.hue} deg</div>
        <div className="hue-presets">
          {huePresets.map((preset) => (
            <button
              className={settings.hue === preset.value ? "active" : ""}
              key={preset.value}
              onClick={() => onChange({ ...settings, hue: preset.value })}
              style={{ "--preset-hue": preset.value } as CSSProperties}
              type="button"
            >
              <span />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <span>Instrument sound</span>
        <label className="settings-toggle">
          <input
            checked={settings.instrumentSoundsEnabled}
            onChange={(event) =>
              onChange({ ...settings, instrumentSoundsEnabled: event.target.checked })
            }
            type="checkbox"
          />
          Play sampled guitar/piano notes and synced chords
        </label>
      </div>
    </aside>
  );
}

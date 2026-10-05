"use client";

import { useState } from "react";
import Dialog from "@/components/Dialog";
import { FONTS, THEMES } from "@/lib/types";
import type { FontId, Theme } from "@/lib/types";

/**
 * Settings: the default typeface, every theme, and the reset that puts the
 * welcome note back. Device + Inter is the default pair.
 */
export default function SettingsDialog({
  font,
  theme,
  noteCount,
  onFont,
  onTheme,
  onResetVault,
  onClose,
}: {
  font: FontId;
  theme: Theme;
  noteCount: number;
  onFont: (font: FontId) => void;
  onTheme: (theme: Theme) => void;
  onResetVault: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isDefault = font === "inter" && theme === "system";

  if (confirming) {
    return (
      <Dialog title="Reset Glyph" onClose={() => setConfirming(false)} width={360}>
        <p className="dialog-copy">
          Every note in this browser is replaced by the welcome note. There is no
          cloud copy yet, so this cannot be undone.
        </p>
        <footer className="dialog-actions">
          <button className="ghost-btn" onClick={() => setConfirming(false)}>
            Keep my notes
          </button>
          <button
            className="danger-btn"
            onClick={() => {
              onResetVault();
              setConfirming(false);
              onClose();
            }}
          >
            Erase {noteCount === 1 ? "the note" : `${noteCount} notes`}
          </button>
        </footer>
      </Dialog>
    );
  }

  return (
    <Dialog title="Settings" onClose={onClose} width={480}>
      <section className="settings-section">
        <header className="settings-head">
          <TypeIcon />
          <div>
            <h3>Typeface</h3>
            <p>The font Glyph writes and reads in.</p>
          </div>
        </header>
        <div className="option-list" role="radiogroup" aria-label="Default font">
          {FONTS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={f.id === font}
              className={`option-row ${f.id === font ? "is-on" : ""}`}
              style={{ fontFamily: `var(--f-${f.id})` }}
              onClick={() => onFont(f.id)}
            >
              <span className="option-preview">Aa</span>
              <span className="option-label">{f.name}</span>
              <span className="option-note">{f.note}</span>
              {f.id === font && <CheckIcon />}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <header className="settings-head">
          <PaletteIcon />
          <div>
            <h3>Appearance</h3>
            <p>Device follows whatever your computer is set to.</p>
          </div>
        </header>
        <div className="option-grid" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={t.id === theme}
              className={`theme-card ${t.id === theme ? "is-on" : ""}`}
              onClick={() => onTheme(t.id)}
            >
              <Swatch theme={t.id} />
              <span className="theme-name">{t.name}</span>
              {t.id === theme && (
                <span className="theme-tick">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <footer className="dialog-actions">
        <div className="dialog-actions-left">
          <button
            className="ghost-btn"
            disabled={isDefault}
            onClick={() => {
              onFont("inter");
              onTheme("system");
            }}
          >
            Reset appearance
          </button>
          <button className="ghost-btn danger" onClick={() => setConfirming(true)}>
            Reset notes
          </button>
        </div>
        <button className="primary-btn" onClick={onClose}>
          Done
        </button>
      </footer>
    </Dialog>
  );
}

/** Three colour chips so each theme is recognisable in the grid. */
function Swatch({ theme }: { theme: Theme }) {
  const palettes: Record<Theme, [string, string, string]> = {
    system: ["#f2f2f6", "#1a1a1f", "#8b8b96"],
    light: ["#ffffff", "#ececf3", "#4b3bc4"],
    dark: ["#17161c", "#2c2b35", "#b3a6ff"],
    aluminium: ["#14161a", "#2f343c", "#d4dae4"],
    blue: ["#0b141d", "#1f3341", "#8ec8ff"],
    red: ["#170f11", "#332326", "#ff9f8f"],
    yellow: ["#17140c", "#332d1c", "#f0c674"],
    catppuccin: ["#1e1e2e", "#45475a", "#cba6f7"],
    amoled: ["#000000", "#1e2129", "#d3d8e4"],
  };
  const [bg, mid, accent] = palettes[theme] ?? palettes.system;
  return (
    <span className="swatch" aria-hidden>
      <i style={{ background: bg }} />
      <i style={{ background: mid }} />
      <i style={{ background: accent }} />
    </span>
  );
}

function TypeIcon() {
  return (
    <span className="settings-icon" aria-hidden>
      <svg viewBox="0 0 16 16">
        <path d="M2.5 12.5L6 3.5l3.5 9M3.6 9.5h4.8M11 12.5V6M11 6c0-1.2 2.5-1.6 2.5 0" />
      </svg>
    </span>
  );
}

function PaletteIcon() {
  return (
    <span className="settings-icon" aria-hidden>
      <svg viewBox="0 0 16 16">
        <path d="M8 1.9a6.1 6.1 0 000 12.2c.9 0 1.4-.6 1.4-1.3 0-.8-.6-1.1-.6-1.8 0-.6.5-1.1 1.2-1.1h1.3a3.8 3.8 0 003.8-3.8C15 4 11.9 1.9 8 1.9z" />
        <circle cx="5.3" cy="7" r=".9" />
        <circle cx="8" cy="4.9" r=".9" />
        <circle cx="11.2" cy="6.1" r=".9" />
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="menu-check">
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  );
}

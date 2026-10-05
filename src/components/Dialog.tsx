"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Modal shell: centred, focus-trapped enough for a personal tool, Esc to close. */
export default function Dialog({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const first = panel.current?.querySelector<HTMLElement>("input, button, [tabindex]");
    first?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="scrim" onMouseDown={onClose}>
      <div
        className="dialog"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Our own text prompt, so nothing leaves the app for a folder name.
 */
export function PromptDialog({
  title,
  label,
  placeholder,
  initial = "",
  confirmLabel = "Create",
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);

  const submit = () => {
    const clean = value.trim();
    if (clean) onConfirm(clean);
    else onClose();
  };

  return (
    <Dialog title={title} onClose={onClose} width={380}>
      <form
        className="prompt-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field-label" htmlFor="prompt-input">
          {label}
        </label>
        <input
          id="prompt-input"
          className="field"
          value={value}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
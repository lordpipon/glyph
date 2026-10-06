"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Modal shell built on the shadcn/ui Dialog (Base UI underneath): centred,
 * Esc and backdrop to close, focus kept inside, entrance and exit animated —
 * the caller unmounts only after the closing animation has played. The
 * stylesheet owns the sizing via the `--dialog-w` variable so every dialog
 * becomes a full-width sheet on small screens.
 */
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
  const [open, setOpen] = useState(true);
  const closing = useRef(false);

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    // Base UI plays the closing animation on the popup; hand control back to
    // the caller once it has finished so the unmount is never a snap.
    window.setTimeout(onClose, 180);
  };

  return (
    <DialogRoot open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="dialog"
        showCloseButton={false}
        style={{ "--dialog-w": `${width}px` } as CSSProperties}
      >
        <header className="dialog-head">
          <DialogTitle className="dialog-heading">{title}</DialogTitle>
          <button className="icon-btn" onClick={requestClose} title="Close">
            <X />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </DialogContent>
    </DialogRoot>
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
"use client";

import Dialog from "@/components/Dialog";
import { Button } from "@/components/ui/button";

/**
 * A destructive/action confirmation with two full-width actions, used by the
 * sidebar note/folder menus and the Ctrl+X shortcut. Both actions are stacked
 * and full width, matching the rest of the dialogs.
 */
export default function ConfirmDialog({
  title,
  note,
  cancelLabel = "Cancel",
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  note: string;
  cancelLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose} width={360}>
      <p className="dialog-copy">{note}</p>
      <footer className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "destructive" : "default"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}
"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type MenuEntry =
  | { kind: "item"; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { kind: "separator" };

/**
 * A menu rendered in a portal at fixed coordinates. Living outside the sidebar
 * means it is never clipped by the tree's own scrolling, and it can be opened
 * from a right click anywhere on a row.
 */
export default function Menu({
  x,
  y,
  entries,
  onClose,
}: {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Flip the menu back inside the viewport when it would overflow.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, x), window.innerWidth - width - 8);
    const top =
      y + height > window.innerHeight - 8 ? Math.max(8, y - height) : Math.min(y, window.innerHeight - height - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y, entries]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div className="ctx-menu" ref={ref} role="menu">
      {entries.map((entry, i) =>
        entry.kind === "separator" ? (
          <span key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={[entry.danger ? "danger" : "", entry.disabled ? "is-disabled" : ""]
              .filter(Boolean)
              .join(" ") || undefined}
            aria-disabled={entry.disabled || undefined}
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
          >
            {entry.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
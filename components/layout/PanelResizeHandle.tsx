"use client";

import { Box } from "@mantine/core";
import { useCallback, useRef } from "react";

type PanelResizeHandleProps = {
  onDrag: (deltaX: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  "aria-label": string;
};

export function PanelResizeHandle({
  onDrag,
  onDragStart,
  onDragEnd,
  "aria-label": ariaLabel
}: PanelResizeHandleProps) {
  const lastX = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      lastX.current = e.clientX;
      onDragStart?.();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [onDragStart]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (lastX.current == null) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (dx !== 0) onDrag(dx);
    },
    [onDrag]
  );

  const finish = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (lastX.current == null) return;
      lastX.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      onDragEnd?.();
    },
    [onDragEnd]
  );

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{
        flexShrink: 0,
        width: 6,
        cursor: "col-resize",
        alignSelf: "stretch",
        touchAction: "none",
        background: "var(--mantine-color-gray-2)",
        opacity: 0.65,
        transition: "opacity 120ms ease"
      }}
      onMouseEnter={(ev) => {
        ev.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(ev) => {
        if (lastX.current == null) ev.currentTarget.style.opacity = "0.65";
      }}
    />
  );
}

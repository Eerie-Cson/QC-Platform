import { useState, useCallback } from "react";

export interface HoverRect {
  top: number;
  left: number;
  width: number;
}

export function useHoverSummary() {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<HoverRect | null>(null);

  const handleRowEnter = useCallback(
    (sessionId: string, e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredRowId(sessionId);
      setHoverRect({ top: rect.top, left: rect.left, width: rect.width });
    },
    [],
  );

  const handleRowLeave = useCallback(() => {
    setHoveredRowId(null);
    setHoverRect(null);
  }, []);

  return { hoveredRowId, hoverRect, handleRowEnter, handleRowLeave };
}

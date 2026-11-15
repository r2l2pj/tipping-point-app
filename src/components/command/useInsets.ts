"use client";

import { useEffect, useState, type RefObject } from "react";

export interface Insets {
  left: number;
  right: number;
  bottom: number;
}

const ZERO: Insets = { left: 0, right: 0, bottom: 0 };
const WIDE = "(min-width: 900px)";

// Space of the map that the floating cards cover (Layers column on the left,
// right panel, timeline at the bottom), measured from the stage edges. The
// map chips, the map tools and the camera padding use it, so nothing sits
// under a card. Zero on narrow screens, where the cards do not float.
export function useInsets(
  stage: RefObject<HTMLElement | null>,
  left: RefObject<HTMLElement | null>,
  right: RefObject<HTMLElement | null>,
  bottom: RefObject<HTMLElement | null>
): Insets {
  const [insets, setInsets] = useState<Insets>(ZERO);
  useEffect(() => {
    const measure = () => {
      const s = stage.current?.getBoundingClientRect();
      if (!s || !window.matchMedia(WIDE).matches) return setInsets(ZERO);
      const edge = (el: HTMLElement | null) => {
        const r = el?.getBoundingClientRect();
        return r && r.width > 0 && r.height > 0 ? r : undefined;
      };
      const l = edge(left.current);
      const r = edge(right.current);
      const b = edge(bottom.current);
      const next = {
        left: l ? Math.max(0, Math.round(l.right - s.left)) : 0,
        right: r ? Math.max(0, Math.round(s.right - r.left)) : 0,
        bottom: b ? Math.max(0, Math.round(s.bottom - b.top)) : 0,
      };
      setInsets((prev) =>
        prev.left === next.left && prev.right === next.right && prev.bottom === next.bottom ? prev : next
      );
    };
    const observer = new ResizeObserver(measure);
    for (const ref of [stage, left, right, bottom]) if (ref.current) observer.observe(ref.current);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [stage, left, right, bottom]);
  return insets;
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` on change.
 *
 * Renders through React state rather than a framer-motion MotionValue: the
 * MotionValue approach wrote text imperatively and stopped updating under
 * React 19, leaving every stat tile stuck at 0.
 */
export function AnimatedCounter({ value, duration = 500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;

    if (from === to) {
      setDisplay(to);
      return;
    }

    // Skip the animation when it can't run or isn't wanted: rAF is paused in
    // hidden/background tabs, which would otherwise leave the number stuck at
    // its old value until the tab is focused.
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0 || (typeof document !== "undefined" && document.hidden)) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Safety net: if frames never arrive (tab hidden mid-animation), snap to
    // the target so the displayed number is never wrong.
    const settle = setTimeout(() => {
      fromRef.current = to;
      setDisplay(to);
    }, duration + 150);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(settle);
      fromRef.current = to;
    };
  }, [value, duration]);

  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>;
}

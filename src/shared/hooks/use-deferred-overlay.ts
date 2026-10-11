"use client";

import { useState } from "react";

/**
 * Header menus, sheets and dialogs ship their Radix code only once the user reaches for them (FRONTEND_PROMPT §9:
 * inbox ≤ 170 KB). Hover/focus warms the chunk; the first click mounts the real overlay already open.
 * Render a look-alike trigger with `triggerProps` until `mounted`, then the lazy component with `defaultOpen`.
 */
export function useDeferredOverlay(load: () => Promise<unknown>) {
  const [mounted, setMounted] = useState(false);
  const prefetch = () => void load();
  return {
    mounted,
    mount: () => setMounted(true),
    triggerProps: { onPointerEnter: prefetch, onFocus: prefetch, onClick: () => setMounted(true) },
  };
}

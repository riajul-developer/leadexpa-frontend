"use client";

import { useState } from "react";

/** Render a look-alike trigger until `mounted`, then the lazy overlay with `defaultOpen`. */
export function useDeferredOverlay(load: () => Promise<unknown>) {
  const [mounted, setMounted] = useState(false);
  const prefetch = () => void load();
  return {
    mounted,
    mount: () => setMounted(true),
    triggerProps: { onPointerEnter: prefetch, onFocus: prefetch, onClick: () => setMounted(true) },
  };
}

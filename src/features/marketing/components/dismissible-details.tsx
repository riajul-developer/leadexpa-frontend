"use client";

import { useEffect, useRef } from "react";

/** DismissibleDetails is a <details> that closes on an outside click, Escape or a link click. */
export function DismissibleDetails({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => el.removeAttribute("open");
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        close();
        el.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    el.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      el.removeEventListener("click", onClick);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}

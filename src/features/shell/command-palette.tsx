"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog").then((m) => m.CommandPaletteDialog));

/** ⌘K / Ctrl+K: jump to a page or a lead (name, phone in any BD format, email). Loads on first use. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return loaded ? <CommandPaletteDialog open={open} onOpenChange={setOpen} /> : null;
}

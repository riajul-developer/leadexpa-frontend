"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog").then((m) => m.CommandPaletteDialog));

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

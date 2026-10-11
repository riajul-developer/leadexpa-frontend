"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { DialogModal } from "./dialog";
import type { SheetModal } from "./sheet";

/*
 * Controlled sheet/dialog whose Radix code loads the first time it opens (FRONTEND_PROMPT §9: the inbox ships
 * ≤ 170 KB). Once opened it stays mounted, so closing animates and focus returns as usual.
 */
const SheetModalLazy = dynamic(() => import("./sheet").then((m) => m.SheetModal));
const DialogModalLazy = dynamic(() => import("./dialog").then((m) => m.DialogModal));

function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened;
}

export function LazySheet(props: React.ComponentProps<typeof SheetModal>) {
  return useOpenedOnce(props.open) ? <SheetModalLazy {...props} /> : null;
}

export function LazyDialog(props: React.ComponentProps<typeof DialogModal>) {
  return useOpenedOnce(props.open) ? <DialogModalLazy {...props} /> : null;
}

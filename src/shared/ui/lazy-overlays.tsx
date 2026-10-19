"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { DialogModal } from "./dialog";
import type { SheetModal } from "./sheet";

/* Stays mounted once opened, so closing animates and focus returns. */
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

"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useCan } from "@/shared/lib/session";
import { Button } from "@/shared/ui/button";
import { LazyDialog } from "@/shared/ui/lazy-overlays";
import { Skeleton } from "@/shared/ui/primitives";

const QuickAddForm = dynamic(() => import("./quick-add-form").then((m) => m.QuickAddForm), {
  loading: () => <Skeleton className="h-64 w-full" />,
});

/** Floating "+ Lead" on phones, a header button and the `n` shortcut on desktop. */
export function QuickAddLead() {
  const t = useTranslations("quickAdd");
  const canAdd = useCan("activity.create");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !el.closest("input,textarea,select,[contenteditable=true],[role=dialog]")
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!canAdd) return null;
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="hidden sm:inline-flex"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="n"
        aria-label={t("title")}
      >
        <Plus aria-hidden />
        {t("button")}
      </Button>
      {/* Portaled to <body>: the header has backdrop-blur, and a backdrop-filter ancestor becomes the containing
          block for position:fixed children, which put this button above the viewport on phones. */}
      {mounted &&
        createPortal(
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-primary text-primary-fg shadow-pop fixed end-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full sm:hidden"
            aria-label={t("title")}
          >
            <Plus className="size-6" aria-hidden />
          </button>,
          document.body,
        )}
      <LazyDialog open={open} onOpenChange={setOpen} title={t("title")} description={t("description")}>
        {open && <QuickAddForm onDone={() => setOpen(false)} />}
      </LazyDialog>
    </>
  );
}

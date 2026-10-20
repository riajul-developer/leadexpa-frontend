"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "../lib/cn";

import { ScreenClose, screenClass } from "./dialog";

const overlayClass =
  "fixed inset-0 z-40 bg-[rgb(24_22_34/0.45)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  side = "right",
  hideTitle,
  actions,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  side?: "right" | "bottom" | "center";
  hideTitle?: boolean;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("common");
  if (side === "center") {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content aria-describedby={undefined} className={screenClass} {...props}>
          <ScreenClose />
          <div
            className={cn(
              "border-border bg-surface shadow-pop group-data-[state=open]:animate-dialog-in relative flex max-h-[90dvh] w-full max-w-xl flex-col rounded-md border",
              className,
            )}
          >
            <div className={cn("border-border border-b px-4 py-3", hideTitle && "sr-only")}>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {actions}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "bg-surface shadow-pop fixed z-50 flex flex-col",
          side === "right"
            ? "border-border data-[state=open]:animate-sheet-in-end data-[state=closed]:animate-sheet-out-end inset-y-0 end-0 h-dvh w-full border-s sm:max-w-xl"
            : "border-border data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom inset-x-0 bottom-0 max-h-[92dvh] rounded-t-md border-t pb-[env(safe-area-inset-bottom)]",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "border-border flex items-center justify-between gap-3 border-b px-4 py-3",
            hideTitle && "sr-only",
          )}
        >
          <DialogPrimitive.Title className="truncate text-base font-semibold">{title}</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <DialogPrimitive.Close
              className="text-muted hover:bg-surface-2 hover:text-text rounded-md p-1 transition-colors"
              aria-label={t("close")}
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetModal({
  open,
  onOpenChange,
  ...content
}: React.ComponentProps<typeof SheetContent> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent {...content} />
    </Sheet>
  );
}

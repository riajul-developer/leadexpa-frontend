"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "../lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlayClass =
  "fixed inset-0 z-40 bg-[rgb(42_22_19/0.45)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content className={screenClass} {...props}>
        <ScreenClose />
        <div
          className={cn(
            "border-border bg-surface shadow-pop group-data-[state=open]:animate-dialog-in relative grid max-h-[90dvh] w-full max-w-lg gap-4 overflow-y-auto rounded-md border p-5",
            className,
          )}
        >
          <div className="grid gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-muted text-sm">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Full-screen Content keeps the corner close button inside the focus trap. */
export const screenClass =
  "group data-[state=closed]:animate-fade-out fixed inset-0 z-50 flex items-center justify-center p-4 pt-16 sm:pt-4";

export function ScreenClose() {
  const t = useTranslations("common");
  return (
    <>
      <DialogPrimitive.Close tabIndex={-1} aria-hidden className="absolute inset-0 cursor-default" />
      <DialogPrimitive.Close
        className="fixed end-4 top-4 z-10 rounded-full bg-[rgb(255_255_255/0.15)] p-2 text-white transition-colors hover:bg-[rgb(255_255_255/0.3)]"
        aria-label={t("close")}
      >
        <X className="size-6" />
      </DialogPrimitive.Close>
    </>
  );
}

export function DialogModal({
  open,
  onOpenChange,
  ...content
}: React.ComponentProps<typeof DialogContent> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent {...content} />
    </Dialog>
  );
}

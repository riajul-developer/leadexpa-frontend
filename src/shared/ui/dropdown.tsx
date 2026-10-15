"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import { cn } from "../lib/cn";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuLabel = ({
  className,
  ...p
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) => (
  <DropdownPrimitive.Label className={cn("text-muted px-2 py-1.5 text-xs font-medium", className)} {...p} />
);
export const DropdownMenuSeparator = () => <DropdownPrimitive.Separator className="bg-border my-1 h-px" />;

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={6}
        className={cn(
          "border-border bg-surface shadow-pop data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-lg border p-1",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "data-[highlighted]:bg-surface-2 data-[highlighted]:[&_svg]:text-text [&_svg]:text-muted flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-100 outline-none select-none data-[disabled]:opacity-50 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

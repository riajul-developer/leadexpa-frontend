import * as React from "react";

import { cn } from "../lib/cn";

import { PasswordInput } from "./password-input";

// Fields: a warm hairline border that darkens on hover; on focus a bronze border (3:1 against the surface) with a
// soft halo. Invalid fields keep the danger border and get a danger halo when focused.
export const inputClass =
  "flex h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text shadow-[0_1px_0_rgb(74_32_18/0.03)] placeholder:text-muted transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[color-mix(in_srgb,var(--c-accent)_40%,var(--c-border))] focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-accent)_22%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--c-danger)_18%,transparent)]";

/** A text field. type="password" adds an eye button that shows or hides the value (PasswordInput). */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) =>
    type === "password" ? (
      <PasswordInput ref={ref} fieldClass={inputClass} className={className} {...props} />
    ) : (
      <input
        ref={ref}
        type={type}
        // Date/time fields: as flex boxes Chrome sizes the inner editor to the text and the picker icon sits right
        // after it; as blocks the editor fills the field and the icon goes to the end.
        className={cn(inputClass, type && DATE_TYPES.has(type) && "block", className)}
        {...props}
      />
    ),
);
Input.displayName = "Input";

const DATE_TYPES = new Set(["date", "datetime-local", "month", "week", "time"]);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** A native select with the app's own chevron (globals.css .select-chevron), so every dropdown looks the same. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(inputClass, "select-chevron truncate pe-8", className)} {...props} />
  ),
);
NativeSelect.displayName = "NativeSelect";

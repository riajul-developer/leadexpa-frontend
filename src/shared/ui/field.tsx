import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "../lib/cn";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-text text-sm font-medium", className)} {...props} />
));
Label.displayName = "Label";

type ControlProps = { id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

/** Label + control + hint/error, wired for screen readers (aria-describedby, aria-invalid). */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  id,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactElement<ControlProps>;
  className?: string;
  id?: string;
}) {
  const auto = React.useId();
  const controlId = id ?? auto;
  const describedBy = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  return (
    // content-start: a field stretched to a taller neighbour (one with a hint) keeps label and control at the top, so
    // controls in the same row line up.
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {React.cloneElement(children, { id: controlId, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${controlId}-error`} className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${controlId}-hint`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

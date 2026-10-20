import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium tracking-[0.005em] transition-[background-color,border-color,color,box-shadow,opacity,translate] duration-150 ease-out active:translate-y-px focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(100_21_47/0.35)] hover:bg-primary-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_2px_6px_-1px_rgb(100_21_47/0.4)]",
        secondary:
          "border border-border bg-surface text-text shadow-card hover:border-[color-mix(in_srgb,var(--c-accent)_40%,var(--c-border))] hover:bg-surface-2 active:bg-[color-mix(in_srgb,var(--c-surface-2)_70%,var(--c-border))]",
        ghost: "text-text hover:bg-surface-2 active:bg-[color-mix(in_srgb,var(--c-surface-2)_70%,var(--c-border))]",
        danger:
          "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(120_20_12/0.3)] hover:bg-[color-mix(in_srgb,var(--c-danger)_88%,black)]",
        success:
          "bg-success text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_60_30/0.3)] hover:bg-[color-mix(in_srgb,var(--c-success)_88%,black)]",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

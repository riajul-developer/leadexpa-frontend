import { BRAND } from "../config/brand";
import { cn } from "../lib/cn";

/* Plain <img>: small static PNGs (public/brand, built by scripts/gen-assets.mjs) need no image optimizer. */

/** The full lockup: mark, LEADEXPA and the tagline. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/leadexpa-logo.png"
      alt={`${BRAND.name}: ${BRAND.tagline}`}
      width={720}
      height={211}
      className={cn("h-auto w-56 select-none", className)}
      draggable={false}
    />
  );
}

/** The mark alone (rising bars and arrow in a gold ring). Decorative unless given a label. */
export function BrandMark({ className, label }: { className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/leadexpa-mark.png"
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={160}
      height={146}
      className={cn("size-9 shrink-0 object-contain select-none", className)}
      draggable={false}
    />
  );
}

/** Mark + wordmark in brand type: for headers where the full lockup is too tall. */
export function BrandWordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark className={size === "sm" ? "size-7" : "size-9"} />
      <span
        className={cn(
          "text-primary font-extrabold tracking-[0.22em] [text-shadow:1.5px_1.5px_0_var(--c-gold)]",
          size === "sm" ? "text-sm" : "text-base",
        )}
      >
        {BRAND.name.toUpperCase()}
      </span>
    </span>
  );
}

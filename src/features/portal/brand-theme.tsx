"use client";

import type { Schemas } from "@/shared/lib/api/client";

export type Brand = Schemas["Brand"];

// Mirrors backend branding/domain.Fonts.
const FONTS: Record<string, { family: string; google?: string }> = {
  system: { family: "" },
  inter: { family: "Inter", google: "Inter:wght@400;500;600" },
  poppins: { family: "Poppins", google: "Poppins:wght@400;500;600" },
  hind_siliguri: { family: "Hind Siliguri", google: "Hind+Siliguri:wght@400;500;600" },
  noto_sans: { family: "Noto Sans", google: "Noto+Sans:wght@400;500;600" },
  noto_sans_arabic: { family: "Noto Sans Arabic", google: "Noto+Sans+Arabic:wght@400;500;600" },
  roboto: { family: "Roboto", google: "Roboto:wght@400;500;700" },
};

function mix(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

/** Sets both --c-* and Tailwind's --color-* (the latter resolve where defined). */
export function BrandTheme({
  brand,
  children,
  className = "min-h-dvh",
}: {
  brand: Brand | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const style: Record<string, string> = {};
  if (brand?.primary_color) {
    const p = brand.primary_color;
    const fg = brand.primary_text || "#ffffff";
    Object.assign(style, {
      "--c-primary": p,
      "--color-primary": p,
      "--c-primary-hover": p,
      "--color-primary-hover": p,
      "--c-primary-fg": fg,
      "--color-primary-fg": fg,
      "--c-primary-soft": mix(p, "14"),
      "--color-primary-soft": mix(p, "14"),
    });
  }
  if (brand?.accent_color) {
    const a = brand.accent_color;
    Object.assign(style, {
      "--c-accent": a,
      "--color-accent": a,
      "--c-accent-strong": a,
      "--color-accent-strong": a,
      "--c-accent-soft": mix(a, "1f"),
      "--color-accent-soft": mix(a, "1f"),
      "--brand-rule": `linear-gradient(90deg, ${brand.primary_color || a} 0%, ${a} 100%)`,
    });
  }
  const font = FONTS[brand?.font ?? "system"] ?? FONTS.system!;
  if (font.family) style.fontFamily = `"${font.family}", var(--font-sans, system-ui), sans-serif`;
  return (
    <div style={style} className={className} data-brand={brand?.slug}>
      {font.google && (
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${font.google}&display=swap`} />
      )}
      {children}
    </div>
  );
}

export function BrandMarkOf({ brand, className }: { brand: Brand; className?: string }) {
  if (brand.logo_url)
    // eslint-disable-next-line @next/next/no-img-element -- an uploaded image on the API's origin
    return <img src={brand.logo_url} alt={brand.display_name} className={className ?? "h-10 w-auto"} />;
  return <span className="text-primary text-xl font-semibold">{brand.display_name}</span>;
}

export function BrandHeader({ brand }: { brand: Brand }) {
  return (
    <div className="grid gap-3" data-testid="brand-header">
      <BrandMarkOf brand={brand} className="h-10 w-auto max-w-56 object-contain" />
      <div aria-hidden className="h-1 rounded-full [background:var(--brand-rule,var(--c-primary))]" />
    </div>
  );
}

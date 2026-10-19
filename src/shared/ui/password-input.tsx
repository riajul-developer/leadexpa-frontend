"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "../lib/cn";

/** Out of the tab order and never steals focus; state via aria-pressed. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { fieldClass: string }
>(({ className, fieldClass, disabled, ...props }, ref) => {
  const t = useTranslations("common");
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn(fieldClass, "pe-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={t("showPassword")}
        aria-pressed={visible}
        title={visible ? t("hidePassword") : t("showPassword")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        className="text-muted hover:text-text hover:bg-surface-2 absolute inset-y-0 end-1 my-auto flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4"
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

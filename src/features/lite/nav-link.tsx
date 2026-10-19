"use client";

import { useRouter } from "next/navigation";

/** Plain anchor: next/link adds ~3 KB the lite app doesn't need. */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}

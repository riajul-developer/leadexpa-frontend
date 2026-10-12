"use client";

import { useRouter } from "next/navigation";

/**
 * A plain anchor that navigates client-side. next/link adds ~3 KB (prefetching, link status) that the lite app
 * doesn't need on a cheap phone; the router itself is already loaded.
 */
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

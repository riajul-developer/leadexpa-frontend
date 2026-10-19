"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/shared/ui/primitives";

const SIZE = 184;

/** Always dark on white: scanners need the contrast in dark mode too. */
export function QRCode({ value, label }: { value: string; label: string }) {
  const [cells, setCells] = useState<boolean[][] | null>(null);
  useEffect(() => {
    let live = true;
    void import("uqr").then(({ encode }) => {
      if (live) setCells(encode(value, { ecc: "M", border: 2 }).data);
    });
    return () => {
      live = false;
    };
  }, [value]);
  if (!cells) return <Skeleton className="size-46 rounded-lg" />;
  const n = cells.length;
  let path = "";
  cells.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${n} ${n}`}
      width={SIZE}
      height={SIZE}
      shapeRendering="crispEdges"
      className="rounded-lg"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

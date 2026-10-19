"use client";

import { useEffect, useState } from "react";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

/** In mock mode, render only once the MSW worker can intercept the first calls. */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);
  useEffect(() => {
    if (!MOCKING) return;
    void import("@/mocks/browser").then(({ startMocking }) => startMocking()).then(() => setReady(true));
  }, []);
  return ready ? children : null;
}

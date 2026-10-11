"use client";

import { useEffect, useState } from "react";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

/**
 * In mock mode (clickable prototype) the app renders only after the MSW service worker is ready, so the
 * first API calls are already intercepted. In normal mode this is a pass-through.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!MOCKING);
  useEffect(() => {
    if (!MOCKING) return;
    void import("@/mocks/browser").then(({ startMocking }) => startMocking()).then(() => setReady(true));
  }, []);
  return ready ? children : null;
}

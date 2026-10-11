import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/** Starts the mock API in the browser (NEXT_PUBLIC_API_MOCKING=enabled). */
export async function startMocking() {
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}

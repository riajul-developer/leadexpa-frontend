import { Suspense } from "react";

import { CalendarCallback } from "@/features/appointments";

export default function Page() {
  return (
    <Suspense>
      <CalendarCallback />
    </Suspense>
  );
}

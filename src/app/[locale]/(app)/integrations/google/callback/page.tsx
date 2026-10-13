import { Suspense } from "react";

import { GoogleCallback } from "@/features/conversions";

export default function Page() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  );
}

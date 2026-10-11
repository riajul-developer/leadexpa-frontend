import { Suspense } from "react";

import { MetaCallback } from "@/features/integrations";

export default function Page() {
  return (
    <Suspense>
      <MetaCallback />
    </Suspense>
  );
}

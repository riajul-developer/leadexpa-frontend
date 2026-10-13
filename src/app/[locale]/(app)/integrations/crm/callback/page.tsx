import { Suspense } from "react";

import { CrmCallback } from "@/features/crm";

export default function Page() {
  return (
    <Suspense>
      <CrmCallback />
    </Suspense>
  );
}

"use client";

import dynamic from "next/dynamic";

/** Stage dialog loaded on demand (list pages open it rarely, never on first paint). */
export const LazyStageDialog = dynamic(() => import("./stage-dialog").then((m) => m.StageDialog));

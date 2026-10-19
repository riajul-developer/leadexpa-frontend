"use client";

import dynamic from "next/dynamic";

export const LazyStageDialog = dynamic(() => import("./stage-dialog").then((m) => m.StageDialog));

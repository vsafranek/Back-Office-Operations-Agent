"use client";

import { Suspense } from "react";
import { StorageBrowser } from "@/components/storage/StorageBrowser";

export default function StoragePage() {
  return (
    <Suspense fallback={null}>
      <StorageBrowser />
    </Suspense>
  );
}

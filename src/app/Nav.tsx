"use client";

import type { ReactNode } from "react";
import { useOrgCycle } from "./orgContext";

/** Nav links carry ?orgId=&cycleId= forward so every page keeps its context. */
export function Nav({ children }: { children?: ReactNode }) {
  const { orgId, cycleId } = useOrgCycle();
  const q = orgId && cycleId ? `?orgId=${encodeURIComponent(orgId)}&cycleId=${encodeURIComponent(cycleId)}` : "";
  return (
    <nav>
      <a href={`/${q}`}>Dashboard</a>
      <a href={`/upload${q}`}>Upload batch</a>
      {children}
    </nav>
  );
}

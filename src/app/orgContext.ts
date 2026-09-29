"use client";

import { useEffect, useState } from "react";

/**
 * v1 org/cycle selection: read from the URL (?orgId=&cycleId=) so links
 * are shareable inside a team. An org picker replaces this when a user
 * belongs to more than one org.
 */
export function orgCycleFromLocation(): { orgId: string; cycleId: string } {
  if (typeof window === "undefined") return { orgId: "", cycleId: "" };
  const p = new URLSearchParams(window.location.search);
  return { orgId: p.get("orgId") ?? "", cycleId: p.get("cycleId") ?? "" };
}

export function withOrgCycle(path: string): string {
  const { orgId, cycleId } = orgCycleFromLocation();
  return `${path}?orgId=${encodeURIComponent(orgId)}&cycleId=${encodeURIComponent(cycleId)}`;
}

/**
 * Hydration-safe variant: renders empty on the server and the first client
 * pass, then picks up the URL values after mount.
 */
export function useOrgCycle(): { orgId: string; cycleId: string; ready: boolean } {
  const [v, setV] = useState({ orgId: "", cycleId: "", ready: false });
  useEffect(() => setV({ ...orgCycleFromLocation(), ready: true }), []);
  return v;
}

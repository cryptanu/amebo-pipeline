"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrgCycle } from "./orgContext";
import { Pipeline } from "./Pipeline";

interface Stats {
  buckets: { bucket: string | null; count: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const { orgId, cycleId, ready } = useOrgCycle();

  const loadStats = useCallback(() => {
    if (!orgId || !cycleId) return;
    fetch(`/api/stats?orgId=${orgId}&cycleId=${cycleId}`)
      .then(async (r) => (r.ok ? setStats(await r.json()) : setError((await r.json()).error)))
      .catch((e) => setError(String(e)));
  }, [orgId, cycleId]);

  useEffect(loadStats, [loadStats]);

  if (!ready) return null;
  if (!orgId || !cycleId) {
    return <p>Open this page with <code>?orgId=…&cycleId=…</code> from your provisioning email.</p>;
  }

  const count = (b: string | null) => stats?.buckets.find((x) => x.bucket === b)?.count ?? 0;
  const total = stats?.buckets.reduce((n, b) => n + b.count, 0) ?? 0;
  const tiles = [
    { label: "Applications", value: total, cls: "" },
    { label: "Shortlisted", value: count("SHORTLIST"), cls: "t-SHORTLIST" },
    { label: "In review", value: count("REVIEW_QUEUE"), cls: "t-REVIEW_QUEUE" },
    { label: "Auto-filtered", value: count("AUTO_FILTERED"), cls: "t-AUTO_FILTERED" },
    { label: "Rejected", value: count("REJECTED"), cls: "t-REJECTED" },
  ];

  return (
    <>
      <h1>Cycle dashboard</h1>
      {error && <p className="error">{error}</p>}
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className={`tile ${t.cls}`}>
            <span className="tile-value">{stats ? t.value : "…"}</span>
            <span className="tile-label">{t.label}</span>
          </div>
        ))}
      </div>
      {count(null) > 0 && (
        <p className="banner">
          {count(null)} application{count(null) === 1 ? " is" : "s are"} awaiting classification.{" "}
          <a href={`/upload?orgId=${orgId}&cycleId=${cycleId}`}>Run classification from the upload page</a>.
        </p>
      )}
      <Pipeline orgId={orgId} cycleId={cycleId} onChanged={loadStats} />
    </>
  );
}

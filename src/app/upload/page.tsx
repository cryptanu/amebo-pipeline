"use client";

import { useState } from "react";
import { useOrgCycle } from "../orgContext";

interface IngestReport {
  batchId: string;
  ingested: number;
  rowErrors: { row: number; reasons: string[] }[];
  missingDecks: string[];
  orphanDecks: string[];
}

export default function UploadPage() {
  const [report, setReport] = useState<IngestReport | null>(null);
  const [status, setStatus] = useState("");
  const { orgId, cycleId, ready } = useOrgCycle();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("Uploading…");
    const form = new FormData(e.currentTarget);
    form.set("orgId", orgId);
    form.set("cycleId", cycleId);
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      setStatus("");
      setReport(null);
      setStatus(`Error: ${body.error}`);
      return;
    }
    setReport(body);
    setStatus("");
  }

  async function runClassification() {
    setStatus("Classifying — this runs the whole batch, hold on…");
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId, cycleId }),
    });
    const body = await res.json();
    setStatus(res.ok ? `Classified ${body.classified}; ${body.failedToQueue} routed to queue on failure.` : `Error: ${body.error}`);
  }

  return (
    <>
      <h1>Upload intake batch</h1>
      <p>Google Forms CSV export plus the deck files it references. Admin only.</p>
      <form onSubmit={handleSubmit}>
        <label>Intake CSV<input name="csv" type="file" accept=".csv" required /></label>
        <label>Deck files<input name="decks" type="file" multiple accept=".pdf" /></label>
        <button type="submit">Ingest</button>
      </form>
      {status && <p>{status}</p>}
      {report && (
        <>
          <h2>Ingest report</h2>
          <p>
            Ingested <strong>{report.ingested}</strong> applications.{" "}
            {report.rowErrors.length > 0 && <span className="error">{report.rowErrors.length} row(s) had errors.</span>}
          </p>
          {report.rowErrors.length > 0 && (
            <table>
              <thead><tr><th>Row</th><th>Problems</th></tr></thead>
              <tbody>
                {report.rowErrors.map((e) => (
                  <tr key={e.row}><td>{e.row}</td><td>{e.reasons.join("; ")}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {report.missingDecks.length > 0 && (
            <p className="error">Referenced but not uploaded: {report.missingDecks.join(", ")}</p>
          )}
          {report.orphanDecks.length > 0 && <p>Uploaded but unreferenced: {report.orphanDecks.join(", ")}</p>}
          <button onClick={runClassification}>Run classification</button>
        </>
      )}
    </>
  );
}

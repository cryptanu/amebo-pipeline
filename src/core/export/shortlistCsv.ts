import { stringify } from "csv-stringify/sync";
import type { EvidenceLink, Label } from "@/core/classify/types";

export interface ShortlistRow {
  startupName: string;
  founder: string;
  email: string;
  country: string;
  sector: string;
  label: Label;
  confidence: number;
  rationale: string;
  evidence: EvidenceLink[];
}

const HEADER = ["Startup", "Founder", "Email", "Country", "Sector", "Label", "Confidence", "Rationale", "Evidence"];

export function buildShortlistCsv(rows: ShortlistRow[]): string {
  const records = rows.map((r) => [
    r.startupName,
    r.founder,
    r.email,
    r.country,
    r.sector,
    r.label,
    r.confidence.toFixed(2),
    r.rationale,
    r.evidence.map((e) => `${e.source}: ${e.excerpt}`).join(" | "),
  ]);
  return stringify([HEADER, ...records]);
}

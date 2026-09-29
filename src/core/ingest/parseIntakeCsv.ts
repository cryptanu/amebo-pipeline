import { parse } from "csv-parse/sync";
import { parseMoney, normalizeRecurring, normalizeStage, type Money, type Recurring, type Stage } from "./normalize";

export interface IntakeApplication {
  row: number; // 1-indexed position in the file, header included
  submittedAt: string;
  email: string;
  startupName: string;
  founder: string;
  country: string;
  sector: string;
  stage: Stage;
  description: string;
  revenue: Money;
  recurring: Recurring;
  teamSize: number | null;
  externalFunding: string;
  scalability: string;
  deckFile: string | null;
  decision: string | null;
}

export interface RowError {
  row: number;
  reasons: string[];
}

export interface IntakeParseResult {
  applications: IntakeApplication[];
  errors: RowError[];
}

const REQUIRED_COLUMNS = [
  "Timestamp",
  "Email Address",
  "Startup name",
  "Founder full name",
  "Country of operation",
  "Sector",
  "Stage",
  "Describe what your company does",
  "Monthly revenue (USD)",
  "Is your revenue recurring?",
  "Team size",
  "Have you raised external funding?",
  "What makes your business scalable?",
  "Pitch deck file",
  "Decision",
] as const;

/**
 * Parse a Google Forms-style intake export. Bad rows become errors;
 * good rows still ingest. Only a broken header aborts the batch.
 */
export function parseIntakeCsv(csvText: string): IntakeParseResult {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: false,
    relax_column_count: true,
  });

  const header = records.length > 0 ? Object.keys(records[0]!) : headerOf(csvText);
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(`Intake CSV is missing required column: "${col}"`);
    }
  }

  const applications: IntakeApplication[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  records.forEach((rec, i) => {
    const row = i + 2; // header is row 1
    const reasons: string[] = [];

    const email = (rec["Email Address"] ?? "").trim();
    const startupName = (rec["Startup name"] ?? "").trim();
    const founder = (rec["Founder full name"] ?? "").trim();

    if (!email) reasons.push("missing email address");
    if (!startupName) reasons.push("missing startup name");
    if (!founder) reasons.push("missing founder name");

    const dupKey = `${email.toLowerCase()}::${startupName.toLowerCase()}`;
    if (email && startupName && seen.has(dupKey)) {
      reasons.push(`duplicate of an earlier row (${email} / ${startupName})`);
    }

    if (reasons.length > 0) {
      errors.push({ row, reasons });
      return;
    }
    seen.add(dupKey);

    const teamSizeRaw = (rec["Team size"] ?? "").trim();
    const teamSize = /^\d+$/.test(teamSizeRaw) ? Number(teamSizeRaw) : null;
    const deckRaw = (rec["Pitch deck file"] ?? "").trim();
    const decisionRaw = (rec["Decision"] ?? "").trim();

    applications.push({
      row,
      submittedAt: (rec["Timestamp"] ?? "").trim(),
      email,
      startupName,
      founder,
      country: (rec["Country of operation"] ?? "").trim(),
      sector: (rec["Sector"] ?? "").trim(),
      stage: normalizeStage(rec["Stage"] ?? ""),
      description: (rec["Describe what your company does"] ?? "").trim(),
      revenue: parseMoney(rec["Monthly revenue (USD)"] ?? ""),
      recurring: normalizeRecurring(rec["Is your revenue recurring?"] ?? ""),
      teamSize,
      externalFunding: (rec["Have you raised external funding?"] ?? "").trim(),
      scalability: (rec["What makes your business scalable?"] ?? "").trim(),
      deckFile: deckRaw === "" ? null : deckRaw,
      decision: decisionRaw === "" ? null : decisionRaw,
    });
  });

  return { applications, errors };
}

function headerOf(csvText: string): string[] {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const parsed: string[][] = parse(firstLine);
  return parsed[0] ?? [];
}

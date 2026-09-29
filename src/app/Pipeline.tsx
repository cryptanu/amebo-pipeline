"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Bucket = "SHORTLIST" | "REVIEW_QUEUE" | "AUTO_FILTERED" | "REJECTED";
type Label = "venture_scalable" | "sme_lifestyle" | "out_of_mandate" | "needs_review";
type ActionType = "accept" | "reject" | "relabel" | "reopen";
type ColumnKey = Bucket | "PENDING";

export interface AppRow {
  id: string;
  startupName: string;
  founder: string;
  email: string;
  country: string;
  sector: string;
  stage: string;
  description: string;
  revenueAmount: number | null;
  revenueCurrency: string | null;
  revenueRaw: string;
  recurring: string;
  teamSize: number | null;
  externalFunding: string;
  scalability: string;
  hasDeck: boolean;
  label: Label | null;
  confidence: number | null;
  rationale: string | null;
  evidence: { source: string; excerpt: string }[] | null;
  bucket: Bucket | null;
  reviewNote: string | null;
}

const COLUMNS: { key: ColumnKey; title: string; hint: string }[] = [
  { key: "PENDING", title: "Awaiting classification", hint: "Ingested, not yet screened" },
  { key: "REVIEW_QUEUE", title: "Review queue", hint: "Needs a human decision" },
  { key: "SHORTLIST", title: "Shortlisted", hint: "In the exported shortlist" },
  { key: "AUTO_FILTERED", title: "Auto-filtered", hint: "Confident rejection by the model" },
  { key: "REJECTED", title: "Rejected", hint: "Rejected by a reviewer (final)" },
];

const LABEL_NAMES: Record<Label, string> = {
  venture_scalable: "Venture-scalable",
  sme_lifestyle: "SME / lifestyle",
  out_of_mandate: "Out of mandate",
  needs_review: "Needs review",
};

const STAGE_NAMES: Record<string, string> = { idea: "Idea", pre_seed: "Pre-seed", seed: "Seed", revenue: "Revenue", other: "Other" };

/**
 * Moves the review state machine allows (src/core/review/transitions.ts),
 * expressed as board drops. Anything not listed is not a valid drop.
 */
const MOVES: Partial<Record<ColumnKey, Partial<Record<ColumnKey, ActionType>>>> = {
  REVIEW_QUEUE: { SHORTLIST: "accept", REJECTED: "reject" },
  SHORTLIST: { REJECTED: "reject" },
  AUTO_FILTERED: { REVIEW_QUEUE: "reopen" },
};

const colOf = (a: AppRow): ColumnKey => a.bucket ?? "PENDING";

function moveFor(from: ColumnKey, to: ColumnKey, role: string): ActionType | null {
  const action = MOVES[from]?.[to] ?? null;
  if (action === "reopen" && role !== "admin") return null;
  return action;
}

const ACTION_VERB: Record<ActionType, string> = {
  accept: "Shortlist",
  reject: "Reject",
  relabel: "Relabel",
  reopen: "Reopen for review",
};

function money(a: AppRow): string {
  if (a.revenueAmount === null) return a.revenueRaw || "—";
  const sym = a.revenueCurrency === "NGN" ? "₦" : "$";
  return `${sym}${a.revenueAmount.toLocaleString()}/mo`;
}

function Confidence({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  const pct = Math.round(value * 100);
  return (
    <span className="conf" title={`Model confidence ${pct}%`}>
      <span className="conf-bar"><span style={{ width: `${pct}%` }} /></span>
      {pct}%
    </span>
  );
}

function LabelTag({ label }: { label: Label | null }) {
  if (!label) return null;
  return <span className={`tag tag-${label}`}>{LABEL_NAMES[label]}</span>;
}

type ViewKind = "board" | "table";
const VIEW_KEY = "amebo.pipelineView";

export function Pipeline({ orgId, cycleId, onChanged }: { orgId: string; cycleId: string; onChanged?: () => void }) {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [role, setRole] = useState("reviewer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewKind>("board");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ app: AppRow; action: ActionType } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "table") setView(saved);
    } catch {}
  }, []);

  function chooseView(v: ViewKind) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/applications?orgId=${orgId}&cycleId=${cycleId}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setApps(body.applications);
      setRole(body.role);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) =>
      [a.startupName, a.founder, a.sector, a.country, a.email, a.label ? LABEL_NAMES[a.label] : ""].some((f) => f.toLowerCase().includes(q)),
    );
  }, [apps, query]);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  async function perform(app: AppRow, action: ActionType, extra: { note?: string; newLabel?: Label } = {}) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId, applicationId: app.id, type: action, ...extra }),
    });
    if (!res.ok) setError((await res.json()).error);
    await load();
    onChanged?.();
  }

  /** Accept and reject ask for an optional note first; the rest run immediately. */
  function request(app: AppRow, action: ActionType) {
    if (action === "accept" || action === "reject") setPending({ app, action });
    else perform(app, action);
  }

  return (
    <section className="pipeline">
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === "board"} className={view === "board" ? "on" : ""} onClick={() => chooseView("board")}>
            Board
          </button>
          <button role="tab" aria-selected={view === "table"} className={view === "table" ? "on" : ""} onClick={() => chooseView("table")}>
            Table
          </button>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Search startup, founder, sector, country…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <a className="button" href={`/api/export?orgId=${orgId}&cycleId=${cycleId}`}>
          Download shortlist CSV
        </a>
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading pipeline…</p>
      ) : apps.length === 0 ? (
        <div className="empty">
          <p>No applications in this cycle yet.</p>
          <a className="button" href={`/upload?orgId=${orgId}&cycleId=${cycleId}`}>Upload an intake batch</a>
        </div>
      ) : view === "board" ? (
        <Board apps={visible} role={role} onOpen={setSelectedId} onAction={request} />
      ) : (
        <Table apps={visible} onOpen={setSelectedId} />
      )}

      {selected && (
        <Details
          app={selected}
          role={role}
          onClose={() => setSelectedId(null)}
          onAction={(action, extra) => (action === "relabel" ? perform(selected, action, extra) : request(selected, action))}
        />
      )}

      {pending && (
        <NoteDialog
          app={pending.app}
          action={pending.action}
          onCancel={() => setPending(null)}
          onConfirm={(note) => {
            const p = pending;
            setPending(null);
            perform(p.app, p.action, { note: note || undefined });
          }}
        />
      )}
    </section>
  );
}

function Board({
  apps,
  role,
  onOpen,
  onAction,
}: {
  apps: AppRow[];
  role: string;
  onOpen: (id: string) => void;
  onAction: (app: AppRow, action: ActionType) => void;
}) {
  const [dragging, setDragging] = useState<AppRow | null>(null);
  const [over, setOver] = useState<ColumnKey | null>(null);
  const hasPending = apps.some((a) => a.bucket === null);
  const cols = COLUMNS.filter((c) => c.key !== "PENDING" || hasPending);

  return (
    <div className="board">
      {cols.map((col) => {
        const items = apps.filter((a) => colOf(a) === col.key);
        const dropAction = dragging ? moveFor(colOf(dragging), col.key, role) : null;
        return (
          <div
            key={col.key}
            className={`column col-${col.key}${dragging && dropAction ? " can-drop" : ""}${over === col.key && dropAction ? " over" : ""}`}
            onDragOver={(e) => {
              if (dropAction) {
                e.preventDefault();
                setOver(col.key);
              }
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && dropAction) onAction(dragging, dropAction);
              setDragging(null);
              setOver(null);
            }}
          >
            <header>
              <h3>{col.title}</h3>
              <span className="count">{items.length}</span>
            </header>
            <p className="hint">{dragging && dropAction ? `Drop to ${ACTION_VERB[dropAction].toLowerCase()}` : col.hint}</p>
            <div className="cards">
              {items.map((a) => (
                <Card
                  key={a.id}
                  app={a}
                  role={role}
                  onOpen={() => onOpen(a.id)}
                  onAction={(action) => onAction(a, action)}
                  onDragStart={() => setDragging(a)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              ))}
              {items.length === 0 && <p className="muted small">Nothing here</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function quickActions(a: AppRow, role: string): ActionType[] {
  switch (a.bucket) {
    case "REVIEW_QUEUE":
      return ["accept", "reject"];
    case "SHORTLIST":
      return ["reject"];
    case "AUTO_FILTERED":
      return role === "admin" ? ["reopen"] : [];
    default:
      return [];
  }
}

function Card({
  app,
  role,
  onOpen,
  onAction,
  onDragStart,
  onDragEnd,
}: {
  app: AppRow;
  role: string;
  onOpen: () => void;
  onAction: (a: ActionType) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const actions = quickActions(app, role);
  return (
    <article
      className="card"
      draggable={actions.length > 0}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", app.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <button className="card-body" onClick={onOpen} aria-label={`Open ${app.startupName}`}>
        <div className="card-top">
          <strong>{app.startupName}</strong>
          {app.hasDeck && <span className="deck" title="Pitch deck received">PDF</span>}
        </div>
        <div className="meta">
          {app.sector} · {app.country} · {STAGE_NAMES[app.stage] ?? app.stage}
        </div>
        <div className="card-row">
          <LabelTag label={app.label} />
          <Confidence value={app.confidence} />
        </div>
        {app.rationale && <p className="rationale">{app.rationale}</p>}
      </button>
      {actions.length > 0 && (
        <div className="card-actions">
          {actions.map((act) => (
            <button key={act} className={act === "reject" ? "ghost danger" : "ghost"} onClick={() => onAction(act)}>
              {ACTION_VERB[act]}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

type SortKey = "startupName" | "status" | "label" | "confidence" | "sector" | "country";

function Table({ apps, onOpen }: { apps: AppRow[]; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "status", dir: 1 });
  const [status, setStatus] = useState<ColumnKey | "ALL">("ALL");
  const order = COLUMNS.map((c) => c.key);

  const rows = useMemo(() => {
    const filtered = status === "ALL" ? apps : apps.filter((a) => colOf(a) === status);
    const val = (a: AppRow): string | number => {
      switch (sort.key) {
        case "status":
          return order.indexOf(colOf(a));
        case "confidence":
          return a.confidence ?? -1;
        case "label":
          return a.label ? LABEL_NAMES[a.label] : "";
        default:
          return a[sort.key].toLowerCase();
      }
    };
    return [...filtered].sort((x, y) => (val(x) < val(y) ? -sort.dir : val(x) > val(y) ? sort.dir : 0));
  }, [apps, sort, status, order]);

  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="chips" role="group" aria-label="Filter by status">
        <button className={status === "ALL" ? "chip on" : "chip"} onClick={() => setStatus("ALL")}>
          All <span>{apps.length}</span>
        </button>
        {COLUMNS.map((c) => {
          const n = apps.filter((a) => colOf(a) === c.key).length;
          if (n === 0 && c.key === "PENDING") return null;
          return (
            <button key={c.key} className={status === c.key ? "chip on" : "chip"} onClick={() => setStatus(c.key)}>
              {c.title} <span>{n}</span>
            </button>
          );
        })}
      </div>
      <div className="table-wrap">
        <table className="apps">
          <thead>
            <tr>
              {th("startupName", "Startup")}
              {th("status", "Status")}
              {th("label", "Model label")}
              {th("confidence", "Confidence")}
              {th("sector", "Sector")}
              {th("country", "Country")}
              <th>Stage</th>
              <th>Revenue</th>
              <th>Deck</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="clickable">
                <td>
                  <strong>{a.startupName}</strong>
                  <div className="muted small">{a.founder}</div>
                </td>
                <td><StatusPill col={colOf(a)} /></td>
                <td><LabelTag label={a.label} /></td>
                <td><Confidence value={a.confidence} /></td>
                <td>{a.sector}</td>
                <td>{a.country}</td>
                <td>{STAGE_NAMES[a.stage] ?? a.stage}</td>
                <td className="num">{money(a)}</td>
                <td>{a.hasDeck ? "✓" : <span className="muted">—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="muted">No applications match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusPill({ col }: { col: ColumnKey }) {
  const title = COLUMNS.find((c) => c.key === col)?.title ?? col;
  return <span className={`pill pill-${col}`}>{title}</span>;
}

function Details({
  app,
  role,
  onClose,
  onAction,
}: {
  app: AppRow;
  role: string;
  onClose: () => void;
  onAction: (action: ActionType, extra?: { newLabel?: Label }) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const actions = quickActions(app, role);
  const field = (k: string, v: React.ReactNode) => (
    <div className="field">
      <dt>{k}</dt>
      <dd>{v || <span className="muted">—</span>}</dd>
    </div>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label={app.startupName} onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2>{app.startupName}</h2>
            <StatusPill col={colOf(app)} />
          </div>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <section>
          <h4>Screening</h4>
          <div className="card-row">
            <LabelTag label={app.label} />
            <Confidence value={app.confidence} />
          </div>
          {app.rationale && <p>{app.rationale}</p>}
          {app.evidence && app.evidence.length > 0 && (
            <ul className="evidence">
              {app.evidence.map((ev, i) => (
                <li key={i}>
                  <span className="muted small">{ev.source.replace(/^csv:/, "")}</span>
                  <q>{ev.excerpt}</q>
                </li>
              ))}
            </ul>
          )}
          {app.reviewNote && <p className="note"><strong>Reviewer note:</strong> {app.reviewNote}</p>}
        </section>

        {(actions.length > 0 || app.bucket === "REVIEW_QUEUE") && (
          <section className="drawer-actions">
            {actions.map((act) => (
              <button key={act} className={act === "reject" ? "danger" : ""} onClick={() => onAction(act)}>
                {ACTION_VERB[act]}
              </button>
            ))}
            {app.bucket === "REVIEW_QUEUE" && (
              <select
                defaultValue=""
                aria-label="Relabel"
                onChange={(e) => {
                  if (e.target.value) onAction("relabel", { newLabel: e.target.value as Label });
                  e.target.value = "";
                }}
              >
                <option value="" disabled>Correct the label…</option>
                {(Object.keys(LABEL_NAMES) as Label[]).filter((l) => l !== app.label).map((l) => (
                  <option key={l} value={l}>{LABEL_NAMES[l]}</option>
                ))}
              </select>
            )}
          </section>
        )}

        <section>
          <h4>Application</h4>
          <dl>
            {field("Founder", app.founder)}
            {field("Email", <a href={`mailto:${app.email}`}>{app.email}</a>)}
            {field("Sector", app.sector)}
            {field("Country", app.country)}
            {field("Stage", STAGE_NAMES[app.stage] ?? app.stage)}
            {field("Monthly revenue", money(app))}
            {field("Recurring revenue", app.recurring)}
            {field("Team size", app.teamSize)}
            {field("External funding", app.externalFunding)}
            {field("Pitch deck", app.hasDeck ? "Received" : "Not received")}
          </dl>
          <h4>What they do</h4>
          <p>{app.description}</p>
          <h4>Why it scales</h4>
          <p>{app.scalability || <span className="muted">—</span>}</p>
        </section>
      </aside>
    </div>
  );
}

function NoteDialog({
  app,
  action,
  onCancel,
  onConfirm,
}: {
  app: AppRow;
  action: ActionType;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const final = action === "reject";
  return (
    <div className="scrim center" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-label={`${ACTION_VERB[action]} ${app.startupName}`} onClick={(e) => e.stopPropagation()}>
        <h3>
          {ACTION_VERB[action]} {app.startupName}?
        </h3>
        {final && <p className="muted small">Rejection is final: it can't be undone from the board.</p>}
        <label>
          Note for the team (optional)
          <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button className={final ? "danger" : ""} onClick={() => onConfirm(note)}>
            {ACTION_VERB[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

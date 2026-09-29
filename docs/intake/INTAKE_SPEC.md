# Amebo intake: Google Form and CSV schema (v1)

Files in this folder:

| File | Purpose |
|---|---|
| `create_form.gs` | Apps Script that builds the Google Form with question titles that match the CSV columns |
| `intake-schema.json` | JSON Schema for one CSV row, mirroring the app's parser |
| `INTAKE_SPEC.md` | This document |

## The one rule that matters

**Question titles become CSV column headers, and Amebo aborts the whole batch
if any of the 15 required headers is missing or spelled differently.** Once the
form is live, edit help text freely, but never rename a question.

## Form: question by question

| # | Question title (exact) | Form type | Required | Validation / choices | Becomes in Amebo |
|---|---|---|---|---|---|
| — | `Timestamp` | automatic | — | — | text, not parsed |
| — | `Email Address` | form setting "Collect email addresses" | yes | — | required; duplicate key with startup name |
| 1 | `Startup name` | Short answer | yes | — | required |
| 2 | `Founder full name` | Short answer | yes | — | required |
| 3 | `Country of operation` | Multiple choice + Other | yes | mandate countries | free text, judged by classifier |
| 4 | `Sector` | Multiple choice + Other | yes | mandate sectors | free text, judged by classifier |
| 5 | `Stage` | Multiple choice | yes | Idea / Pre-seed / Seed / Revenue | `idea` `pre_seed` `seed` `revenue` (anything else becomes `other`) |
| 6 | `Describe what your company does` | Paragraph | yes | ≥ 40 characters | main classifier evidence |
| 7 | `Monthly revenue (USD)` | Short answer | yes | regex: number, optional `$` or `₦` prefix | amount + currency (USD default, NGN with `₦`) |
| 8 | `Is your revenue recurring?` | Multiple choice | yes | Yes / No / Partially | `yes` `no` `partial` |
| 9 | `Team size` | Short answer | yes | whole number | integer |
| 10 | `Have you raised external funding?` | Short answer | yes | — | free text |
| 11 | `What makes your business scalable?` | Paragraph | yes | — | key evidence for SME-vs-startup |
| 12 | `Pitch deck file` | File upload (**add by hand**) | recommended | PDF, 1 file, 10 MB | matched to uploaded PDFs by file name |
| — | `Decision` | **not a form question**; add as a Sheet column | — | blank for new cycles | past-cycle label only |

Why the form's validation is stricter than the parser: the parser never
rejects a row for a badly formatted revenue or team size. It silently stores
`null`, and the classifier then has less to go on. The form's validation
prevents those nulls at the source.

## Setup steps

1. Paste `create_form.gs` into a new project at script.google.com, set
   `CONFIG` to the cycle's mandate, and run `createAmeboIntakeForm()`.
2. Open the form's edit URL and add a **File upload** question titled exactly
   `Pitch deck file` (Apps Script cannot create file-upload questions).
   Respondents must sign in to Google to use it.
3. **Responses → Link to Sheets.** In the Sheet, add a column headed exactly
   `Decision`.
4. To ingest, export from the **Sheet** (File → Download → CSV), not from the
   form's "Download responses". The form's own export has no `Decision`
   column and will be rejected.

## ⚠ Known gap: deck matching with Google Forms uploads

Amebo matches decks by file name: it takes the text after the last `/` in
`Pitch deck file` and looks for an uploaded PDF with that exact name. A Google
Forms file-upload answer is a Drive link such as
`https://drive.google.com/open?id=1AbC…`, so the name Amebo looks for is
`open?id=1AbC…`. Drive also renames the stored file to
`<original name> - <respondent name>.pdf`. **With a real form export, no deck
will match, and every deck will appear under "missing decks".**

Options, in order of effort:

1. **Workaround, no code:** before export, replace each `Pitch deck file` cell
   with the file's Drive name (a Sheets formula or small Apps Script can look
   it up by ID). Then download the Drive upload folder and upload those PDFs
   with the CSV.
2. **Small app change:** when the cell is a Drive URL, match on the Drive file
   ID instead of the name, and accept decks named by ID.
3. **Proper fix:** the app fetches decks straight from Drive using the ID,
   which needs Drive API access.

Since deck text is not yet read by the classifier (a documented v1 gap), a
missing-deck report does not change any classification result today.

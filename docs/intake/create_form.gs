/**
 * Amebo intake form builder (Google Apps Script).
 *
 * Creates a Google Form whose response export matches the Amebo intake CSV
 * schema exactly. Question TITLES become CSV column headers, and Amebo rejects
 * the whole batch if any required header is missing or renamed, so do not
 * edit titles after creating the form. Help text (descriptions) is safe to edit.
 *
 * How to run:
 *   1. Go to https://script.google.com, then New project, and paste this file.
 *   2. Adjust CONFIG below to your program's mandate.
 *   3. Run createAmeboIntakeForm() and approve the permissions prompt.
 *   4. Open the logged edit URL and do the two manual steps printed in the log.
 */

const CONFIG = {
  programName: 'Catapult 2027',
  // Offered as choices, plus "Other". Keep these in line with the cycle's mandate_config.
  countries: ['Nigeria', 'Ghana', 'Kenya'],
  sectors: ['Fintech', 'Healthtech', 'Agritech', 'Logistics', 'Design/Software'],
  // Titles must stay exactly as-is: Amebo normalises these four values.
  stages: ['Idea', 'Pre-seed', 'Seed', 'Revenue'],
  recurring: ['Yes', 'No', 'Partially'],
};

// Every question title below must match a column in Amebo's REQUIRED_COLUMNS.
const T = {
  startup: 'Startup name',
  founder: 'Founder full name',
  country: 'Country of operation',
  sector: 'Sector',
  stage: 'Stage',
  description: 'Describe what your company does',
  revenue: 'Monthly revenue (USD)',
  recurring: 'Is your revenue recurring?',
  team: 'Team size',
  funding: 'Have you raised external funding?',
  scalable: 'What makes your business scalable?',
};

function createAmeboIntakeForm() {
  const form = FormApp.create(`${CONFIG.programName} — Application`);
  form
    .setDescription(
      `Apply to ${CONFIG.programName}. Takes about 10 minutes. ` +
      'Answer in plain language — reviewers read every application the screening flags as uncertain.'
    )
    .setCollectEmail(true) // produces the "Email Address" column
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setProgressBar(true);

  // ── Section 1: About you ──────────────────────────────────────────
  form.addTextItem().setTitle(T.startup).setRequired(true);
  form.addTextItem().setTitle(T.founder).setRequired(true)
    .setHelpText('Lead founder, as it appears on official ID.');

  const country = form.addMultipleChoiceItem().setTitle(T.country).setRequired(true)
    .setHelpText('Where the company primarily operates today (not where it is registered).');
  country.setChoices(CONFIG.countries.map((c) => country.createChoice(c))).showOtherOption(true);

  const sector = form.addMultipleChoiceItem().setTitle(T.sector).setRequired(true);
  sector.setChoices(CONFIG.sectors.map((s) => sector.createChoice(s))).showOtherOption(true);

  const stage = form.addMultipleChoiceItem().setTitle(T.stage).setRequired(true)
    .setHelpText('Idea = no product yet · Pre-seed = product, early users · Seed = traction, raising a seed round · Revenue = established, self-sustaining revenue.');
  stage.setChoices(CONFIG.stages.map((s) => stage.createChoice(s)));

  // ── Section 2: The business ───────────────────────────────────────
  form.addPageBreakItem().setTitle('Your business');

  form.addParagraphTextItem().setTitle(T.description).setRequired(true)
    .setHelpText('What you sell, to whom, and your best traction number. 2–5 sentences.')
    .setValidation(FormApp.createParagraphTextValidation()
      .requireTextLengthGreaterThanOrEqualTo(40)
      .setHelpText('Please write at least a couple of sentences.').build());

  form.addTextItem().setTitle(T.revenue).setRequired(true)
    .setHelpText('Average monthly revenue over the last 3 months, as a number. Enter 0 if pre-revenue. ' +
      'USD by default (e.g. 4200 or $4,200); for Naira prefix with ₦ (e.g. ₦2,500,000).')
    .setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('^[₦N$]?[0-9][0-9,]*(\\.[0-9]+)?$')
      .setHelpText('Numbers only, optionally starting with $ or ₦. No words like "k" or "million".').build());

  const recurring = form.addMultipleChoiceItem().setTitle(T.recurring).setRequired(true)
    .setHelpText('Recurring = subscriptions, contracts, or repeat usage fees that renew without a new sale.');
  recurring.setChoices(CONFIG.recurring.map((r) => recurring.createChoice(r)));

  form.addTextItem().setTitle(T.team).setRequired(true)
    .setHelpText('Full-time people including founders. Whole number.')
    .setValidation(FormApp.createTextValidation()
      .requireWholeNumber()
      .setHelpText('Enter a whole number, e.g. 5.').build());

  form.addTextItem().setTitle(T.funding).setRequired(true)
    .setHelpText('"No", or amount and type, e.g. "Yes - $150k angel" or "Yes - ₦20m grant".');

  form.addParagraphTextItem().setTitle(T.scalable).setRequired(true)
    .setHelpText('How does revenue grow faster than your headcount or physical footprint?');

  Logger.log('Form created.');
  Logger.log('Edit URL:      ' + form.getEditUrl());
  Logger.log('Responder URL: ' + form.getPublishedUrl());
  Logger.log('MANUAL STEP 1: add a "File upload" question titled exactly "Pitch deck file" ' +
    '(PDF only, 1 file, max 10 MB) at the end of the "Your business" section. ' +
    'Apps Script cannot create file-upload questions.');
  Logger.log('MANUAL STEP 2: Responses tab, then Link to Sheets. In that Sheet add a column headed exactly "Decision" ' +
    '(leave blank for new cycles). Export from the Sheet: File, Download, CSV.');
}

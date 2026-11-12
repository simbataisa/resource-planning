// @vitest-environment jsdom
/**
 * Step 1.5 exit criterion: "a user reproduces the prototype's example with identical numbers".
 * Runs the HTML prototype (SIT_Sizing_Model.html) in jsdom with the same scope, assumptions and
 * language as the app, then checks that every number and sentence the prototype shows also
 * appears in the app's editor and results, in both English and Vietnamese.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  blankInputs,
  DEFAULT_ASSUMPTIONS,
  EXAMPLE_INPUTS,
  fromPrototypeProfile,
} from '@sit/engine';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { NextIntlClientProvider } from 'next-intl';
import { ResultsPanels } from '@/components/features/results/results-panels';
import { DetailScopeTab } from '@/components/features/estimate-editor/detail-scope-tab';
import { EvidenceTab } from '@/components/features/estimate-editor/evidence-tab';
import {
  prototypeProfileJson,
  useQbrSummary,
} from '@/components/features/estimate-editor/export-panel';
import { RoughScopeTab } from '@/components/features/estimate-editor/rough-scope-tab';
import { EditorProvider } from '@/components/features/estimate-editor/store';
import { SummaryCards } from '@/components/features/estimate-editor/summary-cards';
import { TeamTab } from '@/components/features/estimate-editor/team-tab';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import { loadPrototype, norm } from '@/tests/support/prototype';

const clone = <T,>(v: T): T => structuredClone(v);
const DEFAULTS = DEFAULT_ASSUMPTIONS as Assumptions;

/** A second scenario that moves every switch away from the example. Synthetic values only. */
function changedScenario(): { inputs: EstimateInputs; assumptions: Assumptions } {
  const inputs = clone(EXAMPLE_INPUTS) as EstimateInputs;
  Object.assign(inputs.evidence, {
    mutation: 40,
    valBE: 60,
    valFE: 30,
    mapCov: 100,
    ruleCov: 0,
    feUnit: 50,
    feMut: 70,
    iosUnit: 90,
    androidUnit: 20,
    dqCov: 100,
    contractCov: 60,
    goldenReuse: 30,
    evalCI: false,
    ptCI: true,
    apm: false,
    ptReuse: 50,
  });
  Object.assign(inputs.team, { weeks: 10, env: 3, automation: 40, ai: 2, aiIters: 6, aiSmes: 3 });
  inputs.team.mix = { junior: 50, mid: 30, senior: 30 };
  inputs.includeL4 = false;
  inputs.channels.web2 = true;
  inputs.a11y = false;
  inputs.detail.reqFields = 120;
  inputs.detail.fieldTypes.text = 40;
  inputs.detail.fieldTypes.date = 12;
  inputs.detail.fieldTypes.currency = 8;
  inputs.detail.languages = 3;
  const assumptions = clone(DEFAULTS);
  assumptions.overhead = 0.2;
  assumptions.band.rough = 0.5;
  assumptions.cases.api = [5, 7, 11];
  return { inputs, assumptions };
}

const SCENARIOS: {
  name: string;
  inputs: EstimateInputs;
  assumptions: Assumptions;
  langs: ('en' | 'vi')[];
  /** The prototype raises an error for this scenario (see the note below). */
  prototypeFails?: boolean;
}[] = [
  {
    name: 'worked example',
    inputs: clone(EXAMPLE_INPUTS) as EstimateInputs,
    assumptions: clone(DEFAULTS),
    langs: ['en', 'vi'],
  },
  {
    name: 'changed scope, evidence, team and assumptions',
    ...changedScenario(),
    langs: ['en', 'vi'],
  },
  // The prototype stops with an error on a blank scope (renderTornado reads the first row of
  // an empty list) before it switches language, so only English is compared. The app shows
  // "No assumption changes the estimate." instead (docs/engine-findings.md, UI note U1).
  {
    name: 'blank scope',
    inputs: blankInputs() as EstimateInputs,
    assumptions: clone(DEFAULTS),
    langs: ['en'],
    prototypeFails: true,
  },
];

function QbrProbe() {
  return <pre data-testid="qbr">{useQbrSummary('')}</pre>;
}

function renderApp(inputs: EstimateInputs, assumptions: Assumptions, locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'vi' ? vi : en} timeZone="UTC">
      <EditorProvider initial={{ inputs, assumptions, rowVersion: 1 }} editable={false}>
        <SummaryCards />
        <RoughScopeTab />
        <DetailScopeTab />
        <TeamTab />
        <EvidenceTab />
        <ResultsPanels />
        <QbrProbe />
      </EditorProvider>
    </NextIntlClientProvider>,
  );
}

/** Every piece of text the prototype shows for the results and live notes. */
function prototypeFragments(d: Document): string[] {
  const all = (sel: string) => Array.from(d.querySelectorAll(sel)).map((e) => norm(e.textContent));
  const one = (sel: string) => norm(d.querySelector(sel)?.textContent);
  const fragments = [
    ...all('#summary .k, #summary .rng, #summary .sub'),
    ...Array.from(d.querySelectorAll('#summary .big')).map((e) => norm(e.firstChild?.textContent)),
    ...all('[id^="dsb-"]'),
    ...all('[id^="f-exp-"]'),
    ...[
      '#detRoughCmp',
      '#apiFieldsNote',
      '#ftNote',
      '#ftAvg',
      '#mixNote',
      '#envNote',
      '#aiNote',
      '#calNote',
      '#t-hpf',
      '#t-blend',
      '#gapCallout',
      '#tornHint',
      '#scenCallout',
    ].map(one),
    ...all('#guideTrace li'),
    ...all('#derTable tbody td'),
    ...all('#gapTable tbody td, #gapTable tfoot td'),
    ...all('#lvlTable tbody td'),
    ...all('.eff'),
    ...all('.trow > div:first-child, .trow .tval'),
    ...all('.srow .lbl, .srow .small, .srow .tval b'),
    ...all('.icost'),
  ];
  return fragments.filter((f) => f !== '');
}

describe.each(SCENARIOS)(
  'prototype parity: $name',
  ({ inputs, assumptions, langs, prototypeFails }) => {
    it.each(langs)('shows every prototype number and sentence (%s)', async (lang) => {
      const proto = await loadPrototype({ inputs, assumptions, lang });
      expect(proto.errors.length > 0).toBe(Boolean(prototypeFails));
      const { container, unmount } = renderApp(inputs, assumptions, lang);
      const ours = norm(container.textContent);
      const missing = prototypeFragments(proto.document).filter((f) => !ours.includes(f));
      expect(missing).toEqual([]);

      // Tornado order: the same assumptions in the same order.
      const protoRows = Array.from(proto.document.querySelectorAll('.trow > div:first-child')).map(
        (e) => norm(e.textContent),
      );
      const ourRows = Array.from(
        container.querySelectorAll('ul[aria-label] > li > span:first-child'),
      )
        .map((e) => norm(e.textContent))
        .filter((s) => protoRows.includes(s));
      expect(ourRows).toEqual(protoRows);

      // The QBR summary is the same text, line for line.
      await proto.click('copySummary');
      expect(norm(screen.getByTestId('qbr').textContent)).toBe(norm(proto.copied()));

      // The profile export round-trips: importing our file and the prototype's file gives the
      // same scope and assumptions (the prototype fills feature defaults on import, as we do).
      await proto.click('exportBtn');
      const theirs = JSON.parse(proto.copied()) as Record<string, unknown>;
      const mine = JSON.parse(
        prototypeProfileJson('', inputs, assumptions, 0, new Date(0)),
      ) as Record<string, unknown>;
      expect(mine.tool).toBe(theirs.tool);
      expect(mine.version).toBe(theirs.version);
      const [a, b] = [fromPrototypeProfile(mine), fromPrototypeProfile(theirs)];
      expect(a.assumptions).toEqual(b.assumptions);
      expect(a.inputs).toEqual(b.inputs);

      unmount();
      proto.close();
    });
  },
);

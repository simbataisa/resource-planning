'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ClipboardCopy, Download, FileSpreadsheet, Upload } from 'lucide-react';
import {
  assumptionPaths,
  fromPrototypeProfile,
  PrototypeImportError,
  SIZES,
  topGap,
} from '@sit/engine';
import { Assumptions, EstimateInputs } from '@sit/schemas';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Eyebrow } from '@/components/patterns/eyebrow';
import { Field } from '@/components/patterns/field';
import { formatFte as f1, formatInt as fmt } from '@/lib/format';
import { useEditor } from './store';
import { useCalendarText } from './use-calendar-text';

/** File name safe slug: "Synthetic · R3" → "synthetic-r3". */
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .slice(0, 60) || 'estimate';

/** Saves text as a file in the browser. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The prototype's export format, so files move between the HTML tool and this app. */
export function prototypeProfileJson(
  profile: string,
  inputs: EstimateInputs,
  assumptions: Assumptions,
  uncalibrated: number,
  savedAt: Date,
): string {
  const total = assumptionPaths(assumptions).length;
  return JSON.stringify(
    {
      tool: 'sit-sizing-model',
      version: 1,
      profile,
      savedAt: savedAt.toISOString(),
      calibrated: `${total - uncalibrated} of ${total}`,
      assumptions,
      scope: inputs,
    },
    null,
    2,
  );
}

/**
 * "Profile and actuals" (prototype `#calib`, X-01): export the profile JSON, copy the QBR
 * summary, and import a profile exported from the HTML tool or this app into the draft.
 */
export function ExportPanel({
  estimateId,
  estimateName,
  versionNumber,
}: {
  estimateId: string;
  estimateName: string;
  versionNumber: number;
}) {
  const t = useTranslations('exportPanel');
  const locale = useLocale();
  const [csvTable, setCsvTable] = useState<(typeof CSV_TABLES)[number]>('gap');
  const exportUrl = (q: string) =>
    `/api/v1/estimates/${estimateId}/versions/${versionNumber}/export?${q}&lang=${locale}`;
  const { state, uncalibrated, editable, dispatch } = useEditor();
  const summary = useQbrSummary(estimateName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setShown(null);
      setMessage({ ok: true, text: t('copied') });
    } catch {
      setShown(summary);
      setMessage({ ok: false, text: t('copyFailed') });
    }
  }

  function exportProfile() {
    download(
      `sit-sizing-${slug(estimateName)}-v${versionNumber}.json`,
      prototypeProfileJson(estimateName, state.inputs, state.assumptions, uncalibrated, new Date()),
    );
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const fail = (reason: string) =>
      setMessage({ ok: false, text: t('importError', { e: reason }) });
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      return fail(t('notJson'));
    }
    try {
      // A file has the ten built-in sizes: it cannot replace an estimate's own sizes, which
      // change only by applying a profile (ADR-0021).
      const own = state.assumptions.sizes;
      if (own.length !== SIZES.length || own.some((s, i) => s !== SIZES[i]))
        return fail(t('ownSizes'));
      const imported = fromPrototypeProfile(obj);
      const assumptions = Assumptions.safeParse(imported.assumptions);
      const inputs = EstimateInputs.safeParse(imported.inputs ?? state.inputs);
      if (!assumptions.success || !inputs.success) return fail(t('invalid'));
      dispatch({ type: 'replace', inputs: inputs.data, assumptions: assumptions.data });
      setMessage({
        ok: true,
        text: imported.profile ? t('imported', { p: imported.profile }) : t('importedNoName'),
      });
    } catch (err) {
      if (err instanceof PrototypeImportError)
        return fail(t(err.code === 'NO_ASSUMPTIONS' ? 'noAssumptions' : 'notProfile'));
      throw err;
    }
  }

  return (
    <section
      data-tour="export-panel"
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <header className="grid gap-1.5">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h2 className="text-[1.6rem] font-light">{t('title')}</h2>
      </header>
      <p className="max-w-3xl text-sm text-muted-foreground">{t('hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportProfile}>
          <Download aria-hidden="true" />
          {t('exportBtn')}
        </Button>
        <Button variant="outline" onClick={() => void copySummary()}>
          <ClipboardCopy aria-hidden="true" />
          {t('copySummary')}
        </Button>
        {editable ? (
          <>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden="true" />
              {t('importFile')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => void onFile(e)}
            />
          </>
        ) : null}
      </div>
      {editable ? <p className="text-xs text-muted-foreground">{t('importHint')}</p> : null}
      <div className="grid gap-2 border-t pt-4">
        <h3 className="text-base font-semibold">{t('sheets.title')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <SheetLink href={exportUrl('format=xlsx')} waiting={state.dirty}>
            <FileSpreadsheet aria-hidden="true" />
            {t('sheets.xlsx')}
          </SheetLink>
          <Field label={t('sheets.csvTable')}>
            {(c) => (
              <NativeSelect
                {...c}
                value={csvTable}
                onChange={(e) => setCsvTable(e.target.value as typeof csvTable)}
              >
                {CSV_TABLES.map((x) => (
                  <option key={x} value={x}>
                    {t(`sheets.tables.${x}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <SheetLink href={exportUrl(`format=csv&table=${csvTable}`)} waiting={state.dirty}>
            <Download aria-hidden="true" />
            {t('sheets.csv')}
          </SheetLink>
        </div>
        <p className="text-xs text-muted-foreground">
          {state.dirty ? t('sheets.waiting') : t('sheets.hint')}
        </p>
      </div>
      {message ? (
        <Alert variant={message.ok ? 'default' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
      {shown ? (
        <Textarea
          aria-label={t('summaryLabel')}
          readOnly
          rows={10}
          value={shown}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </section>
  );
}

const CSV_TABLES = ['gap', 'drivers', 'assumptions', 'inputs', 'summary'] as const;

/** A file download from the server; held back while autosave has not caught up. */
function SheetLink({
  href,
  waiting,
  children,
}: {
  href: string;
  waiting: boolean;
  children: React.ReactNode;
}) {
  return waiting ? (
    <Button variant="outline" disabled>
      {children}
    </Button>
  ) : (
    <Button asChild variant="outline">
      <a href={href} download>
        {children}
      </a>
    </Button>
  );
}

/** The QBR summary text (prototype `#copySummary`). */
export function useQbrSummary(profile: string): string {
  const t = useTranslations('exportPanel.summary');
  const tc = useTranslations('catalogue');
  const tg = useTranslations('catalogue.groups');
  const tw = useTranslations('detailTab');
  const { state, results, uncalibrated } = useEditor();
  const calendar = useCalendarText();
  const { rough: R, detailed: D } = results;
  const { team, evidence: E } = state.inputs;
  const top = topGap(results);
  const channels = [
    tw('summary.web'),
    ...(['web2', 'ios', 'android'] as const)
      .filter((k) => D.counts.ch[k])
      .map((k) => tc(`channels.${k}`)),
  ].join(', ');
  const any = (k: 'dOn' | 'aOn' | 'ptOn') => D.explain[k] || R.explain[k];
  const scope = [
    tc('featureTypes.app'),
    ...(any('dOn') ? [tc('featureTypes.data')] : []),
    ...(any('aOn') ? [tc('featureTypes.ai')] : []),
    ...(any('ptOn') ? [tw('sections.pt')] : []),
  ].join(', ');
  const hasCalendar = any('dOn') || any('aOn') || any('ptOn');
  let gapDriver = '';
  if (top) {
    const label = tg(top.group);
    gapDriver = t(/s$/.test(label) ? 'gapMany' : 'gapOne', { label, p: top.share });
  }
  return [
    t('head') + (profile ? t('profile', { p: profile }) : ''),
    t('rough', { lo: f1(R.lo), hi: f1(R.hi), m: f1(R.fte), c: fmt(R.cases), h: fmt(R.hours) }),
    t('detailed', { lo: f1(D.lo), hi: f1(D.hi), m: f1(D.fte), c: fmt(D.cases), h: fmt(D.hours) }),
    t('gap', { s: D.fte >= R.fte ? '+' : '−', n: f1(Math.abs(D.fte - R.fte)) }) + gapDriver,
    t('window', { w: team.weeks, j: team.mix.junior, m: team.mix.mid, s: team.mix.senior }),
    t('env', {
      e: tc(`env.${D.envI}`),
      a: Math.round(D.auto * 100),
      c: channels,
      l: D.counts.languages,
    }),
    t('ai', { a: tc(`aiLevels.${D.aiI}`), p: Math.round(D.aiCut * 100) }),
    t('scope', { p: scope }) + (hasCalendar && calendar ? ` · ${calendar}` : ''),
    t('evidence', {
      r: E.ruleCov,
      m: E.mutation,
      b: E.valBE,
      f: E.valFE,
      p: E.mapCov,
      u: E.feUnit,
      s: E.feMut,
    }),
    t('calibration', { u: uncalibrated, t: assumptionPaths(state.assumptions).length }),
  ].join('\n');
}

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DEFAULT_ASSUMPTIONS } from '@sit/engine';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CollapsibleSection } from '@/components/patterns/collapsible-section';
import { PageHeader } from '@/components/patterns/page-header';
import { CopyText } from './copy-text';
import { DEFAULT_TONES, REF_LINKS } from './content-data';

/**
 * Guide, method and standards pages (C-02), ported from the HTML prototype's panels.
 * Text lives in messages (`content.*`) as rich text; numbers of the prototype defaults are
 * part of the wording, as in the prototype. No 'use client': these render on the server.
 */

const keys = (n: number) => Array.from({ length: n }, (_, i) => String(i));

/** Tags used in content messages: bold, italic, footnote references and numbered links. */
function tags(links: readonly string[] = []) {
  const external = (i: number) =>
    function ExternalLink(chunks: ReactNode) {
      return (
        <a
          href={links[i]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {chunks}
        </a>
      );
    };
  return {
    b: (c: ReactNode) => <b className="font-semibold">{c}</b>,
    i: (c: ReactNode) => <i>{c}</i>,
    sup: (c: ReactNode) => <sup>{c}</sup>,
    ref: (c: ReactNode) => (
      <sup>
        <a href={`#ref-${String(c)}`} className="text-primary">
          {c}
        </a>
      </sup>
    ),
    a1: external(0),
    a2: external(1),
    a3: external(2),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="pt-1.5 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, r) => (
            <TableRow key={r}>
              {cells.map((c, i) => (
                <TableCell key={i} className="align-top whitespace-normal">
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function GuidePage() {
  const t = useTranslations('content.guide');
  const tp = useTranslations('content.guidePage');
  const rich = (key: string) => t.rich(key, tags());
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('note')} />
      <ol className="ml-5 grid list-decimal gap-2 text-sm leading-relaxed">
        {keys(7).map((k) => (
          <li key={k}>{rich(`steps.${k}`)}</li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{tp('workedExampleNote')}</p>
      <CollapsibleSection title={t('where.title')} defaultOpen>
        <SimpleTable
          head={keys(3).map((k) => t(`where.head.${k}`))}
          rows={keys(13).map((r) => keys(3).map((c) => rich(`where.rows.${r}.${c}`)))}
        />
      </CollapsibleSection>
      <CollapsibleSection title={t('read.title')}>
        <ul className="ml-5 grid list-disc gap-2 text-sm">
          {keys(6).map((k) => (
            <li key={k}>{rich(`read.items.${k}`)}</li>
          ))}
        </ul>
      </CollapsibleSection>
      <CollapsibleSection title={t('calibrate.title')}>
        <ul className="ml-5 grid list-disc gap-2 text-sm">
          {keys(9).map((k) => (
            <li key={k}>{rich(`calibrate.items.${k}`)}</li>
          ))}
        </ul>
      </CollapsibleSection>
      <CollapsibleSection title={t('faq.title')}>
        <dl className="grid gap-4 text-sm">
          {keys(9).map((k) => (
            <div key={k} className="grid gap-1">
              <dt className="font-semibold">{rich(`faq.items.${k}.q`)}</dt>
              <dd className="text-muted-foreground">{rich(`faq.items.${k}.a`)}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleSection>
    </div>
  );
}

export function MethodPage() {
  const t = useTranslations('content.method');
  const rich = (key: string) => t.rich(key, tags());
  return (
    <div className="grid max-w-4xl gap-6">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} />
      <pre className="overflow-x-auto rounded-lg border bg-muted px-3.5 py-3 font-mono text-[0.86rem] leading-[1.7]">
        {t('formula')}
      </pre>
      <ol className="ml-5 grid list-decimal gap-2 text-sm leading-relaxed">
        {keys(10).map((k) => (
          <li key={k}>{rich(`steps.${k}`)}</li>
        ))}
      </ol>
    </div>
  );
}

const TONE_BADGE = { warn: 'warn', bad: 'bad', team: 'good' } as const;

export function StandardsPage() {
  const t = useTranslations('content.standards');
  const rich = (key: string, links?: readonly string[]) => t.rich(key, tags(links));
  const tc = useTranslations('content.cone');
  const tt = useTranslations('content');
  const r = Math.round(DEFAULT_ASSUMPTIONS.band.rough * 100);
  const d = Math.round(DEFAULT_ASSUMPTIONS.band.detailed * 100);
  const tight = [...(r < 100 ? [tc('rough')] : []), ...(d < 50 ? [tc('detailed')] : [])];
  const coneNote = tight.length
    ? `${tc(tight.length > 1 ? 'many' : 'one', { w: tight.join(tc('and')) })} ${tc('symmetric')}`
    : tc('wide');

  return (
    <div className="grid max-w-5xl gap-8">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        actions={<Badge variant="unc">{t('chip')}</Badge>}
      />
      <p className="text-sm text-muted-foreground">{rich('intro')}</p>
      <Section title={t('headings.0')}>
        <SimpleTable
          head={keys(3).map((k) => t(`techniques.head.${k}`))}
          rows={keys(10).map((row) => keys(3).map((c) => rich(`techniques.rows.${row}.${c}`)))}
        />
      </Section>
      <Section title={t('headings.1')}>
        <SimpleTable
          head={keys(3).map((k) => t(`defaults.head.${k}`))}
          rows={DEFAULT_TONES.map((tone, i) => [
            rich(`defaults.rows.${i}.value`),
            rich(`defaults.rows.${i}.derivation`),
            <Badge key="b" variant={TONE_BADGE[tone]}>
              {t(`defaults.rows.${i}.basis`)}
            </Badge>,
          ])}
        />
      </Section>
      <Section title={t('headings.2')}>
        <SimpleTable
          head={keys(3).map((k) => t(`cone.head.${k}`))}
          rows={[
            [t('cone.rows.0.stage'), t('cone.rows.0.range'), `±${r}%`],
            [t('cone.rows.1.stage'), t('cone.rows.1.range'), `±${d}%`],
          ]}
        />
        <p className="text-sm text-muted-foreground">{coneNote}</p>
        <p className="text-xs text-muted-foreground">{tc('defaultsNote')}</p>
      </Section>
      <Section title={t('headings.3')}>
        <ol className="ml-5 grid list-decimal gap-2 text-sm">
          {keys(4).map((k) => (
            <li key={k}>{rich(`calibrate.${k}`)}</li>
          ))}
        </ol>
      </Section>
      <Section title={t('headings.4')}>
        <p className="rounded-r-lg border-l-4 border-detailed bg-detailed-soft px-3.5 py-2.5 text-[0.98rem]">
          {t('wording')}
        </p>
        <CopyText
          text={t('wording')}
          label={t('copyWording')}
          copied={tt('copied')}
          failed={tt('copyFailed')}
        />
      </Section>
      <Section title={t('headings.5')}>
        <ol className="ml-5 grid list-decimal gap-2 text-xs text-muted-foreground">
          {REF_LINKS.map((links, i) => (
            <li key={i} id={`ref-${i + 1}`} className="scroll-mt-4">
              {rich(`refs.${i}`, links)}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

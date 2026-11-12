'use client';

import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import type { Assumptions } from '@sit/schemas';
import type { Feature } from '@sit/schemas';
import { SIZES } from '@sit/engine';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NumberField } from '@/components/patterns/number-field';
import { NumberInput } from '@/components/patterns/number-input';
import { atLeast0, atLeast1Int } from '@/lib/clamp';
import { ChannelsFieldset } from './channels-fieldset';
import { useEditor } from './store';

const TYPES = ['app', 'data', 'ai'] as const;

/** Tab 1 (prototype `#p-rough`): features with T-shirt sizes, channels, roles and languages. */
export function RoughScopeTab() {
  const t = useTranslations('editor.rough');
  const tc = useTranslations('catalogue');
  const { state, editInputs, editable } = useEditor();
  const { inputs, assumptions } = state;
  const edit = (i: number, recipe: (f: Feature) => void) =>
    editInputs((d) => recipe(d.features[i]!));

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">{t('hint')}</p>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">{t('feature')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead>{t('size')}</TableHead>
              <TableHead>{t('complexity')}</TableHead>
              <TableHead className="text-right">{t('qty')}</TableHead>
              <TableHead className="text-center">{t('perfCritical')}</TableHead>
              <TableHead>{t('expands')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('remove', { n: '' })}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inputs.features.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : null}
            {inputs.features.map((f, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    aria-label={t('featureName')}
                    value={f.name}
                    maxLength={200}
                    disabled={!editable}
                    onChange={(e) => edit(i, (x) => void (x.name = e.target.value))}
                  />
                </TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={t('type')}
                    className="min-w-36"
                    value={f.type ?? 'app'}
                    disabled={!editable}
                    onChange={(e) =>
                      edit(i, (x) => void (x.type = e.target.value as Feature['type']))
                    }
                  >
                    {TYPES.map((k) => (
                      <option key={k} value={k}>
                        {tc(`featureTypes.${k}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={t('size')}
                    className="min-w-20"
                    value={f.size}
                    disabled={!editable}
                    onChange={(e) =>
                      edit(i, (x) => void (x.size = e.target.value as Feature['size']))
                    }
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={t('complexity')}
                    className="min-w-32"
                    value={String(f.cx)}
                    disabled={!editable}
                    onChange={(e) =>
                      edit(i, (x) => void (x.cx = Number(e.target.value) as Feature['cx']))
                    }
                  >
                    {[0, 1, 2].map((b) => (
                      <option key={b} value={b}>
                        {tc(`complexity.${b}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-right">
                  <NumberInput
                    aria-label={t('quantity')}
                    value={f.qty}
                    min={0}
                    normalize={atLeast0}
                    disabled={!editable}
                    className="w-20"
                    onValueChange={(v) => edit(i, (x) => void (x.qty = v))}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    aria-label={t('perfCriticalLong')}
                    checked={Boolean(f.pt)}
                    disabled={!editable}
                    onCheckedChange={(v) => edit(i, (x) => void (x.pt = v === true))}
                  />
                </TableCell>
                <TableCell className="min-w-64 text-xs text-muted-foreground">
                  <Expansion feature={f} assumptions={assumptions} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('remove', { n: f.name })}
                    disabled={!editable}
                    onClick={() => editInputs((d) => void d.features.splice(i, 1))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ChannelsFieldset legend={t('channels')} />
      <div className="flex flex-wrap items-end gap-6">
        <Button
          variant="outline"
          disabled={!editable}
          onClick={() =>
            editInputs(
              (d) =>
                void d.features.push({
                  name: t('newFeature'),
                  type: 'app',
                  size: 'M',
                  cx: 1,
                  qty: 1,
                }),
            )
          }
        >
          <Plus aria-hidden="true" />
          {t('addFeature')}
        </Button>
        <NumberField
          label={t('roles')}
          value={inputs.roughRoles}
          min={0}
          normalize={atLeast0}
          disabled={!editable}
          onChange={(v) => editInputs((d) => void (d.roughRoles = v))}
        />
        <NumberField
          label={t('languages')}
          value={inputs.roughLanguages}
          min={1}
          normalize={atLeast1Int}
          disabled={!editable}
          onChange={(v) => editInputs((d) => void (d.roughLanguages = v))}
        />
        <NumberField
          label={t('variants')}
          value={inputs.roughVariants}
          min={1}
          normalize={atLeast1Int}
          disabled={!editable}
          onChange={(v) => editInputs((d) => void (d.roughVariants = v))}
        />
      </div>
    </div>
  );
}

/** What one feature expands into, from the size proxies under Assumptions (prototype f-exp). */
function Expansion({ feature: f, assumptions: A }: { feature: Feature; assumptions: Assumptions }) {
  const t = useTranslations('editor.rough');
  const q = Number(f.qty) || 0;
  const type = f.type ?? 'app';
  let text = '';
  if (type === 'data') {
    const p = A.dproxies[f.size];
    text = t('expandData', {
      a: p.feed * q,
      b: p.pipe * q,
      c: p.table * q,
      d: p.columns * q,
      e: p.dq * q,
      f: p.report * q,
    });
  } else if (type === 'ai') {
    const p = A.aproxies[f.size];
    // Guardrails are not multiplied by quantity in the prototype (engine finding 3).
    text = t('expandAi', {
      a: p.intent * q,
      b: p.ocr * q,
      c: p.rag * q,
      d: p.tools * q,
      e: p.guard,
      f: p.hitl * q,
    });
  } else {
    const p = A.proxies[f.size];
    text = t('expandApp', {
      a: p.screen * q,
      b: p.field * q,
      c: p.api * q,
      d: p.integration * q,
      e: p.rule * q,
      f: p.batch * q,
      g: p.event * q,
      h: p.workflow * q,
    });
  }
  return (
    <>
      {text}
      {f.pt ? (
        <span className="mt-1 block font-medium text-foreground">
          {t('ptScen', { n: (A.ptRoughScen[f.size] || 0) * q })}
        </span>
      ) : null}
    </>
  );
}

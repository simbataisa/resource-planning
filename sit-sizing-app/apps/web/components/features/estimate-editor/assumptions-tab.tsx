'use client';

import { useTranslations } from 'next-intl';
import { DEFAULT_ASSUMPTIONS, isDefaultRow } from '@sit/engine';
import type { Assumptions } from '@sit/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { NumberInput } from '@/components/patterns/number-input';
import { getPath, setPath } from '@/lib/path';
import { cn } from '@/lib/utils';
import { ASSUMPTION_META, type MetaLabel, type MetaRow } from './assumption-meta';
import { useEditor } from './store';

const DEFAULTS = DEFAULT_ASSUMPTIONS as Assumptions;

/** Tab 5 (prototype `#p-asm`): every assumption, its calibration state and a reset. */
export function AssumptionsTab() {
  const t = useTranslations('assumptionsTab');
  const tr = useTranslations();
  const { state, uncalibrated, editAssumptions, editable } = useEditor();
  const A = state.assumptions;
  const label = (l: MetaLabel) => tr(l.key, l.values);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="min-w-0 flex-1 basis-80 text-sm text-muted-foreground">{t('hint')}</p>
        <Badge variant="unc">{tr('editor.tabs.uncalibrated', { n: uncalibrated })}</Badge>
      </div>
      {ASSUMPTION_META.map((g) => (
        <section key={g.group} className="grid gap-2">
          <h3 className="pt-1.5 text-base font-semibold">{t(`groups.${g.group}`)}</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableBody>
                {g.rows.map((r) => {
                  const isDefault = isDefaultRow(A, DEFAULTS, r.path);
                  const name = label(r.label);
                  return (
                    <TableRow
                      key={r.path}
                      className={cn(
                        !isDefault && '[&>td:first-child]:shadow-[inset_3px_0_0_var(--good)]',
                      )}
                    >
                      <TableCell className="w-2/5 align-top whitespace-normal">{name}</TableCell>
                      <TableCell>
                        <RowInputs
                          row={r}
                          name={name}
                          A={A}
                          disabled={!editable}
                          onSet={(value) => editAssumptions((d) => setPath(d, r.path, value))}
                        />
                      </TableCell>
                      <TableCell className="w-32 align-top">
                        <Badge variant={isDefault ? 'unc' : 'team'}>
                          {isDefault ? t('uncalibrated') : t('teamValue')}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-24 align-top">
                        {!isDefault ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            aria-label={t('resetLabel', { label: name })}
                            disabled={!editable}
                            onClick={() =>
                              editAssumptions((d) =>
                                setPath(d, r.path, structuredClone(getPath(DEFAULTS, r.path))),
                              )
                            }
                          >
                            {t('reset')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  );
}

/** The inputs of one row; values below 0 are ignored, as in the prototype. */
function RowInputs({
  row,
  name,
  A,
  disabled,
  onSet,
}: {
  row: MetaRow;
  name: string;
  A: Assumptions;
  disabled: boolean;
  onSet: (value: unknown) => void;
}) {
  const t = useTranslations('assumptionsTab');
  const tr = useTranslations();
  const v = getPath(A, row.path);
  const keyLabel = (ref: string) => (ref.startsWith('=') ? ref.slice(1) : tr(ref));

  if (row.kind === 'pct') {
    return (
      <span className="flex items-center gap-1.5">
        <NumberInput
          aria-label={name}
          value={Number(((v as number) * 100).toFixed(2))}
          min={0}
          step="any"
          disabled={disabled}
          onValueChange={(x) => onSet(x / 100)}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </span>
    );
  }
  if (row.kind === 'scalar') {
    return (
      <span className="flex items-center gap-1.5">
        <NumberInput
          aria-label={name}
          value={v as number}
          min={0}
          step="any"
          disabled={disabled}
          onValueChange={(x) => onSet(x)}
        />
        <span className="text-xs text-muted-foreground">{t(`units.${row.unit}`)}</span>
      </span>
    );
  }
  if (row.kind === 'cols') {
    const arr = v as number[];
    return (
      <span className="flex flex-wrap items-end gap-2">
        {row.cols.map((c, b) => (
          <label key={c} className="grid gap-1 text-xs text-muted-foreground">
            {tr(c)}
            <NumberInput
              aria-label={`${name} · ${tr(c)}`}
              value={arr[b]!}
              min={0}
              step="any"
              disabled={disabled}
              className="w-20"
              onValueChange={(x) => {
                const next = arr.slice();
                next[b] = x;
                onSet(next);
              }}
            />
          </label>
        ))}
        <span className="pb-2 text-xs text-muted-foreground">{t(`units.${row.unit}`)}</span>
      </span>
    );
  }
  const obj = v as Record<string, number>;
  return (
    <span className="flex flex-wrap items-end gap-2">
      {row.keys.map(([k, ref]) => (
        <label key={k} className="grid gap-1 text-xs text-muted-foreground">
          {keyLabel(ref)}
          <NumberInput
            aria-label={`${name} · ${keyLabel(ref)}`}
            value={obj[k]!}
            min={0}
            step="any"
            disabled={disabled}
            className="w-[4.6rem]"
            onValueChange={(x) => onSet({ ...obj, [k]: x })}
          />
        </label>
      ))}
    </span>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { CheckboxField } from '@/components/patterns/checkbox-field';
import { useEditor } from './store';

const KEYS = ['web2', 'ios', 'android', 'a11y'] as const;

/** Channels in scope. Shared by the rough and detailed tabs: both edit the same values. */
export function ChannelsFieldset({ legend }: { legend: string }) {
  const t = useTranslations('catalogue.channels');
  const { state, editInputs, editable } = useEditor();
  const value = (k: (typeof KEYS)[number]) =>
    k === 'a11y' ? state.inputs.a11y : state.inputs.channels[k];
  return (
    <fieldset className="grid gap-2 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <CheckboxField label={t('web')} checked disabled />
        {KEYS.map((k) => (
          <CheckboxField
            key={k}
            label={t(k)}
            checked={value(k)}
            disabled={!editable}
            onCheckedChange={(on) =>
              editInputs((d) => {
                if (k === 'a11y') d.a11y = on;
                else d.channels[k] = on;
              })
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

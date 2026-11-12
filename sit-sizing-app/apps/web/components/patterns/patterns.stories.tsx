import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxField } from './checkbox-field';
import { CollapsibleSection } from './collapsible-section';
import { ComparisonBars } from './comparison-bars';
import { EmptyState } from './empty-state';
import { LangSwitch } from './lang-switch';
import { NumberField } from './number-field';
import { NumberInput } from './number-input';
import { PageHeader } from './page-header';
import { QueryState } from './query-state';
import { StatCard } from './stat-card';
import { StatusChip } from './status-chip';
import { TornadoChart } from './tornado-chart';

const meta: Meta = { title: 'Layer 3 · Patterns' };
export default meta;

export const SummaryCards: StoryObj = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        label="Rough · no FSD"
        value={20.4643}
        unit="FTE"
        tone="rough"
        range="range 12.3 – 28.7 FTE (±40%)"
        detail="3,511 cases · 3,499 h · 6 weeks"
      />
      <StatCard
        label="Detailed · with FSD"
        value={21.5253}
        unit="FTE"
        tone="detailed"
        range="range 18.3 – 24.8 FTE (±15%)"
        detail="4,047 cases · 3,681 h · 6 weeks"
      />
    </div>
  ),
};

export const Header: StoryObj = {
  render: () => (
    <PageHeader
      title="Synthetic · Mobile onboarding R3"
      description="DEMO · draft version 3"
      actions={<Button>Save version</Button>}
    />
  ),
};

export const Fields: StoryObj = {
  render: function Render() {
    const [weeks, setWeeks] = useState(6);
    return (
      <div className="grid max-w-sm gap-4">
        <NumberField
          label="SIT window"
          value={weeks}
          onChange={setWeeks}
          min={1}
          max={52}
          unit="weeks"
          hint="Calendar weeks of SIT execution"
        />
        <NumberField
          label="Mutation score"
          value={62}
          onChange={() => {}}
          min={0}
          max={100}
          unit="%"
          error="Below the 70% gate"
        />
      </div>
    );
  },
};

export const Sections: StoryObj = {
  render: () => (
    <div className="grid gap-2">
      <CollapsibleSection
        title="Application"
        summary="34 APIs · 16 screens · 9 integrations"
        defaultOpen
      >
        Application drivers go here.
      </CollapsibleSection>
      <CollapsibleSection title="Data platform" summary="Not in scope" empty>
        Data drivers go here.
      </CollapsibleSection>
    </div>
  ),
};

export const StatusAndBars: StoryObj = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusChip tone="good">Gate met</StatusChip>
        <StatusChip tone="warn">50–99% · partial</StatusChip>
        <StatusChip tone="bad">Below 50%</StatusChip>
        <StatusChip tone="neutral">Not in scope</StatusChip>
      </div>
      <ComparisonBars
        label="API endpoints: rough 176, detailed 196 cases"
        rough={176}
        detailed={196}
        max={400}
      />
      <EmptyState
        title="No estimates yet"
        description="Create one from the example or a blank scope."
        action={<Button>New estimate</Button>}
      />
    </div>
  ),
};

export const Step15Patterns: StoryObj = {
  render: function Render() {
    const [lang, setLang] = useState('en');
    const [qty, setQty] = useState(2);
    const [on, setOn] = useState(true);
    return (
      <div className="grid max-w-2xl gap-6">
        <LangSwitch
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: 'EN', title: 'English' },
            { value: 'vi', label: 'VI', title: 'Tiếng Việt' },
          ]}
        />
        <NumberInput aria-label="Quantity" value={qty} min={0} onValueChange={setQty} />
        <CheckboxField label="iOS (Swift)" checked={on} onCheckedChange={setOn} />
        <TornadoChart
          label="What moves the number"
          base={21.5}
          rows={[
            {
              key: 'a',
              label: 'Cases per integration',
              lo: 19.9,
              hi: 23.1,
              valueText: '19.9 – 23.1 FTE',
            },
            {
              key: 'b',
              label: 'Execution minutes per case',
              lo: 20.6,
              hi: 22.4,
              valueText: '20.6 – 22.4 FTE',
            },
            { key: 'c', label: 'SIT cycles', lo: 21.1, hi: 21.9, valueText: '21.1 – 21.9 FTE' },
          ]}
        />
        <QueryState
          status="error"
          labels={{
            loading: 'Loading…',
            errorTitle: 'Something went wrong',
            errorBody: 'The request failed. Try again.',
            retry: 'Try again',
            notFoundTitle: 'Not found',
            notFoundBody: 'It does not exist or you do not have access to it.',
          }}
          onRetry={() => {}}
        >
          content
        </QueryState>
      </div>
    );
  },
};

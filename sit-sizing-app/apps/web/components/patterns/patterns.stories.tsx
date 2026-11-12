import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from './collapsible-section';
import { ComparisonBars } from './comparison-bars';
import { EmptyState } from './empty-state';
import { NumberField } from './number-field';
import { PageHeader } from './page-header';
import { StatCard } from './stat-card';
import { StatusChip } from './status-chip';

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

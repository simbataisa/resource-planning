// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { CollapsibleSection } from './collapsible-section';
import { ComparisonBars } from './comparison-bars';
import { EmptyState } from './empty-state';
import { Field } from './field';
import { NumberField } from './number-field';
import { PageHeader } from './page-header';
import { StatCard } from './stat-card';
import { StatusChip } from './status-chip';

describe('patterns (layer 3)', () => {
  it('Field wires label, hint and error to the control', async () => {
    const { container } = render(
      <Field label="Team size" hint="People testing in SIT" error="Must be at least 1">
        {(control) => <Input {...control} defaultValue="0" />}
      </Field>,
    );
    const input = screen.getByLabelText('Team size');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('People testing in SIT Must be at least 1');
    await expectNoAxeViolations(container);
  });

  it('NumberField reports only valid numbers within range', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Harness() {
      const [v, setV] = useState(6);
      return (
        <NumberField
          label="Weeks"
          value={v}
          min={1}
          max={52}
          unit="weeks"
          onChange={(n) => {
            onChange(n);
            setV(n);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Weeks');
    await user.clear(input);
    expect(onChange).not.toHaveBeenCalled(); // empty box: nothing reported
    await user.type(input, '12');
    expect(onChange).toHaveBeenLastCalledWith(12);
    await user.clear(input);
    await user.type(input, '99');
    expect(onChange).not.toHaveBeenCalledWith(99); // above max
  });

  it('StatCard announces the final value even while it animates', async () => {
    const { container } = render(
      <StatCard
        label="Detailed · with FSD"
        value={21.5253}
        unit="FTE"
        tone="detailed"
        range="range 18.3 – 24.8 FTE (±15%)"
      />,
    );
    expect(screen.getByText('21.5', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('range 18.3 – 24.8 FTE (±15%)')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('CollapsibleSection opens and closes from its summary', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { container } = render(
      <CollapsibleSection title="Application" summary="34 APIs · 16 screens" onToggle={onToggle}>
        Section body
      </CollapsibleSection>,
    );
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    await user.click(screen.getByText('Application'));
    expect(details.open).toBe(true);
    await expectNoAxeViolations(container);
  });

  it('StatusChip, EmptyState, PageHeader and ComparisonBars render accessibly', async () => {
    const { container } = render(
      <div>
        <PageHeader title="Estimates" description="Synthetic project" />
        <StatusChip tone="bad">Below 50%</StatusChip>
        <StatusChip tone="good">Gate met</StatusChip>
        <EmptyState title="No estimates yet" description="Create one from the example." />
        <ComparisonBars
          label="API endpoints: rough 176, detailed 196 cases"
          rough={176}
          detailed={196}
          max={400}
        />
      </div>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Estimates' })).toBeInTheDocument();
    expect(screen.getByText('Below 50%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /rough 176, detailed 196/ })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('optional parts render only when given', async () => {
    const { container } = render(
      <div>
        <PageHeader title="Projects" actions={<button type="button">New</button>} />
        <StatusChip tone="warn">50–99% · partial</StatusChip>
        <StatusChip tone="neutral">Not measured</StatusChip>
        <EmptyState
          title="Nothing here"
          icon={<svg aria-hidden="true" />}
          action={<a href="#x">Add</a>}
        />
        <StatCard label="Rough" value={12} tone="rough" detail="3,511 cases" />
        <StatCard label="Plain" value={3} />
        <ComparisonBars label="no scale" rough={5} detailed={-1} max={0} />
        <CollapsibleSection title="Data" index={5} empty defaultOpen>
          Body
        </CollapsibleSection>
        <CollapsibleSection variant="box" title="Fields by type">
          Box body
        </CollapsibleSection>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('3,511 cases')).toBeInTheDocument();
    expect(container.querySelector('details')!.open).toBe(true);
    // Nothing in scope: the section number turns grey instead of red (prototype .dsec.empty).
    expect(screen.getByText('5').className).toContain('bg-border-strong');
    expect(container.querySelectorAll('details')[1]!.className).toContain('bg-muted');
    const bars = screen.getByRole('img', { name: 'no scale' }).querySelectorAll('span');
    expect((bars[0] as HTMLElement).style.width).toBe('0%');
    await expectNoAxeViolations(container);
  });

  it('NumberField ignores below-min and non-numeric input and follows outside resets', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<NumberField label="Rate" value={5} min={1} onChange={onChange} />);
    const input = screen.getByLabelText('Rate');
    await user.clear(input);
    await user.type(input, '0');
    expect(onChange).not.toHaveBeenCalled();
    rerender(<NumberField label="Rate" value={8} min={1} onChange={onChange} />);
    expect(input).toHaveValue(8);
    rerender(<NumberField label="Rate" value={8} min={1} onChange={onChange} />);
    expect(input).toHaveValue(8);
  });
});

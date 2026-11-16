// @vitest-environment jsdom
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/tests/support/intl';
import { AssumptionsTab } from './assumptions-tab';
import { RoughScopeTab } from './rough-scope-tab';
import { EditorProvider, useEditor } from './store';

vi.mock(
  '@/i18n/navigation',
  async () => (await import('@/tests/support/navigation-mock')).navigationMock,
);

/** Screens follow the estimate's own sizes (ADR-0021). Synthetic data only. */
function withXS2(): Assumptions {
  const a = structuredClone(DEFAULT_ASSUMPTIONS) as Assumptions;
  for (const t of ['proxies', 'dproxies', 'aproxies', 'ptRoughScen'] as const) {
    const table = a[t] as Record<string, unknown>;
    table.XS2 = structuredClone(table.S);
    delete table.XXL;
  }
  a.sizes = [...a.sizes.filter((s) => s !== 'XXL'), 'XS2'];
  return a;
}

const render = (ui: React.ReactNode, assumptions = withXS2()) =>
  renderWithIntl(
    <EditorProvider
      initial={{
        inputs: structuredClone(EXAMPLE_INPUTS) as EstimateInputs,
        assumptions,
        rowVersion: 1,
      }}
      editable
    >
      {ui}
    </EditorProvider>,
  );

describe('custom sizes on the estimate screens (ADR-0021)', () => {
  it('offers the estimate sizes in the rough-scope picker', () => {
    render(<RoughScopeTab />);
    const picker = screen.getAllByRole('combobox', { name: /Size/ })[0]!;
    const options = within(picker)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('XS2');
    expect(options).not.toContain('XXL');
  });

  it('lists a row per size and counts custom rows uncalibrated', () => {
    const { container } = render(<AssumptionsTab />);
    expect(container.querySelectorAll('tr').length).toBe(160);
    expect(screen.getAllByText('Size XS2').length).toBe(3);
    expect(screen.queryByText('Size XXL')).toBeNull();
    expect(screen.getAllByText('160 uncalibrated').length).toBeGreaterThan(0);
  });
});

/** Shows the keys of the performance-scenario table, to check what a reset leaves. */
function ScenarioKeys() {
  const { state } = useEditor();
  return (
    <output aria-label="scenario keys">
      {Object.keys(state.assumptions.ptRoughScen).sort().join(',')}
    </output>
  );
}

describe('reset with custom sizes (ADR-0021)', () => {
  const ROW = 'Scenarios per performance-critical feature, rough mode';

  it('offers no reset on the scenarios row while its built-in sizes are at the default', () => {
    render(<AssumptionsTab />);
    expect(screen.queryByRole('button', { name: `Reset ${ROW} to the default` })).toBeNull();
  });

  it('resets only the built-in sizes and keeps the custom ones', () => {
    const a = withXS2();
    (a.ptRoughScen as Record<string, number>).M = 9;
    render(
      <>
        <AssumptionsTab />
        <ScenarioKeys />
      </>,
      a,
    );
    fireEvent.click(screen.getByRole('button', { name: `Reset ${ROW} to the default` }));
    expect(screen.getByLabelText('scenario keys').textContent).toBe([...a.sizes].sort().join(','));
    expect(screen.queryByRole('button', { name: `Reset ${ROW} to the default` })).toBeNull();
  });
});

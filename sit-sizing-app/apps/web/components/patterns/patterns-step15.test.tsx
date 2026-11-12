// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { CheckboxField } from './checkbox-field';
import { LangSwitch } from './lang-switch';
import { NumberInput } from './number-input';
import { QueryState } from './query-state';
import { TornadoChart } from './tornado-chart';

const labels = {
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  errorBody: 'Try again',
  retry: 'Retry',
  notFoundTitle: 'Not found',
  notFoundBody: 'Gone',
};

describe('patterns added in step 1.5', () => {
  it('LangSwitch marks the active language and reports a change', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <LangSwitch
        label="Language"
        value="en"
        options={[
          { value: 'en', label: 'EN', title: 'English' },
          { value: 'vi', label: 'VI', title: 'Tiếng Việt' },
        ]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    expect(onChange).toHaveBeenCalledWith('vi');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoAxeViolations(container);
  });

  it('QueryState shows loading, not found, errors with retry, and content', async () => {
    const retry = vi.fn();
    const { rerender } = render(
      <QueryState status="pending" labels={labels}>
        ok
      </QueryState>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    rerender(
      <QueryState status="error" errorStatus={404} labels={labels}>
        ok
      </QueryState>,
    );
    expect(screen.getByText('Not found')).toBeInTheDocument();
    rerender(
      <QueryState status="error" errorStatus={500} labels={labels} onRetry={retry}>
        ok
      </QueryState>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalled();
    rerender(
      <QueryState status="error" labels={labels}>
        ok
      </QueryState>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    rerender(
      <QueryState status="success" labels={labels}>
        content
      </QueryState>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('NumberInput normalises like the prototype when asked to', async () => {
    const onValue = vi.fn();
    render(
      <NumberInput
        aria-label="Languages"
        value={2}
        min={1}
        normalize={(v) => Math.max(1, Math.round(v))}
        onValueChange={onValue}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'Languages' });
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(onValue).toHaveBeenLastCalledWith(1);
  });

  it('CheckboxField toggles from its label', async () => {
    const onChange = vi.fn();
    render(<CheckboxField label="iOS (Swift)" checked={false} onCheckedChange={onChange} />);
    await userEvent.click(screen.getByText('iOS (Swift)'));
    expect(onChange).toHaveBeenCalledWith(true);
    render(<CheckboxField label="Web" checked disabled />);
    expect(screen.getByRole('checkbox', { name: 'Web' })).toBeDisabled();
  });

  it('TornadoChart lists each row with its range as text', async () => {
    const { container } = render(
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
          { key: 'b', label: 'SIT cycles', lo: 21.5, hi: 22, valueText: '21.5 – 22.0 FTE' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'What moves the number' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('19.9 – 23.1 FTE')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

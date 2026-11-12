import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Accessibility check for component tests (design 13: axe in component tests).
 * Colour contrast is checked on the tokens instead (packages/tokens), because jsdom
 * does not compute styles; `region` does not apply to isolated components.
 */
export async function expectNoAxeViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary).toEqual([]);
}

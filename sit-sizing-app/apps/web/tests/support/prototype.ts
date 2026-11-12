import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import type { Assumptions, EstimateInputs } from '@sit/schemas';

/** The HTML prototype, kept at the TCB repository root as the reference implementation. */
function findPrototype(): string {
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    const file = join(dir, 'SIT_Sizing_Model.html');
    if (existsSync(file)) return file;
  }
  throw new Error('SIT_Sizing_Model.html not found above ' + process.cwd());
}
const PROTOTYPE = findPrototype();

export interface Prototype {
  document: Document;
  /** Text the prototype put on the clipboard (QBR summary, profile export). */
  copied: () => string;
  /** Script errors the prototype raised while running (collected, not printed). */
  errors: string[];
  click: (id: string) => Promise<void>;
  close: () => void;
}

/**
 * Runs the prototype in its own jsdom window with a given scope, assumptions and language.
 * It restores state from localStorage on start (`sit-sizing-v1`, `sit-lang`), so we preload those.
 */
export async function loadPrototype(opts: {
  inputs: EstimateInputs;
  assumptions: Assumptions;
  lang?: 'en' | 'vi';
}): Promise<Prototype> {
  let copied = '';
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(readFileSync(PROTOTYPE, 'utf8'), {
    runScripts: 'dangerously',
    virtualConsole,
    url: 'http://localhost/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.setItem(
        'sit-sizing-v1',
        JSON.stringify({ assumptions: opts.assumptions, scope: opts.inputs, profile: '' }),
      );
      if (opts.lang === 'vi') w.localStorage.setItem('sit-lang', 'vi');
      Object.defineProperty(w.navigator, 'clipboard', {
        value: {
          writeText: (t: string) => {
            copied = t;
            return Promise.resolve();
          },
        },
      });
    },
  });
  await new Promise((r) => setTimeout(r, 0));
  const document = dom.window.document;
  return {
    document,
    copied: () => copied,
    errors,
    click: async (id) => {
      (document.getElementById(id) as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
    },
    close: () => dom.window.close(),
  };
}

/** Collapses whitespace the way a reader sees it. */
export const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

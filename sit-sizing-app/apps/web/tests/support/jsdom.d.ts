/**
 * The part of jsdom's API the prototype parity helper uses (jsdom ships no types and
 * @types/jsdom is not a dependency). Test-only.
 */
declare module 'jsdom' {
  export class VirtualConsole {
    on(event: 'jsdomError', listener: (error: Error) => void): this;
  }
  export interface ConstructorOptions {
    runScripts?: 'dangerously' | 'outside-only';
    url?: string;
    pretendToBeVisual?: boolean;
    virtualConsole?: VirtualConsole;
    beforeParse?: (window: Window & typeof globalThis) => void;
  }
  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    readonly window: Window & typeof globalThis;
  }
}

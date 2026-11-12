import type { AnchorHTMLAttributes } from 'react';
import { vi } from 'vitest';

/** Stand-in for `@/i18n/navigation` in component tests (no Next.js router in jsdom). */
export const router = { push: vi.fn(), replace: vi.fn() };
export const navigationMock = {
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
  useRouter: () => router,
  usePathname: () => '/projects',
  redirect: vi.fn(),
};

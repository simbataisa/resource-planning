import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware Link and router: `<Link href="/projects">` goes to `/vi/projects` in Vietnamese. */
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

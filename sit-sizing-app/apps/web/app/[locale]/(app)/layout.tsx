import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/features/app-shell/app-shell';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { SIDEBAR_COOKIE_NAME } from '@/lib/sidebar-cookie';
import { currentUserFromCookies } from '@/server/auth/current-user';

/** Signed-in area: sidebar navigation, language switch and account menu (U-04, ADR-0015). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const user = await currentUserFromCookies(
    Object.fromEntries(store.getAll().map((c) => [c.name, c.value])),
  );
  return (
    <AppShell
      userName={user?.displayName ?? null}
      profileLocale={user?.locale ?? null}
      localeChosen={store.has(LOCALE_COOKIE)}
      sidebarOpen={store.get(SIDEBAR_COOKIE_NAME)?.value !== 'false'}
    >
      {children}
    </AppShell>
  );
}

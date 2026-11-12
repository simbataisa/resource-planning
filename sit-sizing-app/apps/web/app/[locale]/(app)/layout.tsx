import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppShell } from '@/components/features/app-shell/app-shell';
import { currentUserFromCookies } from '@/server/auth/current-user';

/** Signed-in area: header, navigation, language switch and session menu (U-04). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const user = await currentUserFromCookies(
    Object.fromEntries(store.getAll().map((c) => [c.name, c.value])),
  );
  return <AppShell userName={user?.displayName ?? null}>{children}</AppShell>;
}

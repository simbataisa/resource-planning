'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { LanguageSwitch } from './language-switch';

export interface AppShellProps {
  /** Display name of the signed-in user; null shows a sign-in button. */
  userName: string | null;
  children: ReactNode;
}

/** Header, navigation, language switch and session menu around every signed-in page (U-04). */
export function AppShell({ userName, children }: AppShellProps) {
  const t = useTranslations();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-card"
      >
        {t('app.skipToContent')}
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/projects" className="grid leading-tight">
            <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
            <span className="text-lg font-semibold text-primary">{t('app.name')}</span>
          </Link>
          <nav aria-label={t('app.mainNav')} className="flex items-center gap-4 text-sm">
            <Link href="/projects" className="font-medium hover:underline">
              {t('app.projects')}
            </Link>
            <a href="/api/v1/docs" className="text-muted-foreground hover:underline">
              {t('app.apiDocs')}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitch />
            {userName ? (
              <div
                aria-label={t('app.sessionMenu')}
                role="group"
                className="flex items-center gap-2"
              >
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {t('app.signedInAs', { name: userName })}
                </span>
                <Button asChild variant="outline" size="sm">
                  <a href="/api/auth/signout">
                    <LogOut aria-hidden="true" />
                    {t('auth.signOut')}
                  </a>
                </Button>
              </div>
            ) : (
              <Button asChild size="sm">
                <a href="/api/auth/signin">{t('auth.signIn')}</a>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t py-4">
        <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground">
          {t('common.disclaimer')}
        </p>
      </footer>
    </div>
  );
}

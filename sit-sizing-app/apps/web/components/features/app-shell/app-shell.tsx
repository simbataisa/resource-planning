'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, ExternalLink, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Eyebrow } from '@/components/patterns/eyebrow';
import { usePathname } from '@/i18n/navigation';
import type { Locale } from '@/lib/i18n';
import { AdminNavGroup } from '../admin/admin-nav';
import { NotificationBell } from '../notifications/notification-bell';
import { PortfolioNavItem } from '../portfolio/portfolio-page';
import { AdoptProfileLocale, LanguageSwitch } from './language-switch';
import { NAV_ICONS, sectionFor } from './nav-items';
import { SidebarBrandLink, SidebarNavLink } from './sidebar-nav-link';
import { MobileSidebarBar, SidebarHeaderToggle } from './sidebar-toggle';

export interface AppShellProps {
  /** Display name of the signed-in user; null shows a sign-in button. */
  userName: string | null;
  /** Language saved to the user's profile. */
  profileLocale?: Locale | null;
  /** True when this browser already has a language choice (cookie). */
  localeChosen?: boolean;
  /** Sidebar expanded on first render (from the sidebar_state cookie). */
  sidebarOpen?: boolean;
  children: ReactNode;
}

/** Sidebar navigation and footer around every signed-in page (U-04, ADR-0015). */
export function AppShell({
  userName,
  profileLocale = null,
  localeChosen = true,
  sidebarOpen = true,
  children,
}: AppShellProps) {
  const t = useTranslations();
  const section = sectionFor(usePathname());
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdoptProfileLocale profileLocale={profileLocale} localeChosen={localeChosen} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-card"
      >
        {t('app.skipToContent')}
      </a>
      <Sidebar
        collapsible="icon"
        label={t('app.sidebarLabel')}
        mobileTitle={t('app.mainNav')}
        mobileCloseLabel={t('app.closeNav')}
      >
        {/* Expanded: brand, bell, toggle in a row. Collapsed to icons: toggle above the bell.
            In the phone sheet, pad the right so the bell clears the sheet's close button. */}
        <SidebarHeader className="flex-row items-center gap-1 group-data-[collapsible=icon]:flex-col-reverse in-data-[mobile=true]:pr-10">
          <SidebarBrandLink className="min-w-0 flex-1 px-2 py-1 group-data-[collapsible=icon]:hidden">
            <Eyebrow className="text-[0.7rem]">{t('app.brand')}</Eyebrow>
          </SidebarBrandLink>
          {userName ? <NotificationBell /> : null}
          <SidebarHeaderToggle label={t('app.toggleNav')} />
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label={t('app.mainNav')}>
            <SidebarGroup>
              <SidebarGroupLabel>{t('app.navGroups.work')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarNavLink
                    href="/projects"
                    label={t('app.projects')}
                    icon={NAV_ICONS.projects}
                    active={section === 'projects'}
                    tour="nav-projects"
                  />
                  <SidebarNavLink
                    href="/profiles"
                    label={t('app.profiles')}
                    icon={NAV_ICONS.profiles}
                    active={section === 'profiles'}
                    tour="nav-profiles"
                  />
                  <PortfolioNavItem active={section === 'portfolio'} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <AdminNavGroup active={section} />
            <SidebarGroup>
              <SidebarGroupLabel>{t('app.navGroups.reference')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarNavLink
                    href="/guide"
                    label={t('content.nav.guide')}
                    icon={NAV_ICONS.guide}
                    active={section === 'guide'}
                  />
                  <SidebarNavLink
                    href="/method"
                    label={t('content.nav.method')}
                    icon={NAV_ICONS.method}
                    active={section === 'method'}
                  />
                  <SidebarNavLink
                    href="/standards"
                    label={t('content.nav.standards')}
                    icon={NAV_ICONS.standards}
                    active={section === 'standards'}
                  />
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={t('app.apiDocs')}>
                      <a href="/api/v1/docs">
                        <NAV_ICONS.apiDocs aria-hidden="true" />
                        <span>{t('app.apiDocs')}</span>
                        <ExternalLink aria-hidden="true" className="ml-auto size-3" />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <div className="group-data-[collapsible=icon]:hidden">
            <LanguageSwitch saveToProfile={Boolean(userName)} />
          </div>
          {userName ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <span
                    aria-hidden="true"
                    className="grid size-4 place-items-center rounded-full bg-muted text-[0.6rem] font-semibold"
                  >
                    {userName.charAt(0)}
                  </span>
                  {/* Named by the sr-only text, which contains the visible name (WCAG 2.5.3). */}
                  <span aria-hidden="true" className="truncate">
                    {userName}
                  </span>
                  <span className="sr-only">{t('app.accountMenu', { name: userName })}</span>
                  <ChevronsUpDown aria-hidden="true" className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuItem asChild>
                  <a href="/api/auth/signout">
                    <LogOut aria-hidden="true" />
                    {t('auth.signOut')}
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="group-data-[collapsible=icon]:hidden">
              <a href="/api/auth/signin">{t('auth.signIn')}</a>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <MobileSidebarBar label={t('app.toggleNav')} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t py-4">
          <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground">
            {t('common.disclaimer')}
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

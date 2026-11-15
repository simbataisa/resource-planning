'use client';

import { useTranslations } from 'next-intl';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { principalFromMe } from '@/lib/me';
import { useMe } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';
import { NAV_ICONS, type NavSection } from '../app-shell/nav-items';
import { SidebarNavLink } from '../app-shell/sidebar-nav-link';

/**
 * The sidebar's Admin group: the audit log (QE Leads, Admins) and users (Admins).
 * Renders nothing when neither is visible. The API enforces both.
 */
export function AdminNavGroup({ active }: { active: NavSection | null }) {
  const t = useTranslations('app');
  const me = useMe();
  const principal = me.data ? principalFromMe(me.data) : null;
  if (!principal) return null;
  const isAdmin = principal.globalRole === 'ADMIN';
  const leads = Object.keys(principal.memberships).some((id) =>
    can(principal, 'audit.read.project', id),
  );
  if (!isAdmin && !leads) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('navGroups.admin')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarNavLink
            href="/audit"
            label={t('audit')}
            icon={NAV_ICONS.audit}
            active={active === 'audit'}
            tour="nav-audit"
          />
          {isAdmin ? (
            <SidebarNavLink
              href="/admin/users"
              label={t('users')}
              icon={NAV_ICONS.users}
              active={active === 'users'}
              tour="nav-users"
            />
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

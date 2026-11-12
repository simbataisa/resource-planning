'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { principalFromMe } from '@/lib/me';
import { useMe } from '@/lib/query/hooks';
import { can } from '@/lib/rbac';

/** Header links for the audit log (QE Leads, Admins) and users (Admins). The API enforces both. */
export function AdminNavLinks() {
  const t = useTranslations('app');
  const me = useMe();
  const principal = me.data ? principalFromMe(me.data) : null;
  if (!principal) return null;
  const isAdmin = principal.globalRole === 'ADMIN';
  const leads = Object.keys(principal.memberships).some((id) =>
    can(principal, 'audit.read.project', id),
  );
  return (
    <>
      {isAdmin || leads ? (
        <Link href="/audit" className="hover:underline">
          {t('audit')}
        </Link>
      ) : null}
      {isAdmin ? (
        <Link href="/admin/users" className="hover:underline">
          {t('users')}
        </Link>
      ) : null}
    </>
  );
}

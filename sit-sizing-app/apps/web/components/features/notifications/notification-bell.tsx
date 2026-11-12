'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import type { NotificationItem } from '@sit/schemas';
import { Button } from '@/components/ui/button';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/lib/format';
import { useMarkNotifications, useNotifications } from '@/lib/query/hooks';
import { cn } from '@/lib/utils';

/** In-app notices (N-01): a bell with the unread count and the newest notices. */
export function NotificationBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const q = useNotifications();
  const { read, readAll } = useMarkNotifications();
  const unread = q.data?.unread ?? 0;
  const items = q.data?.items ?? [];

  const href = (n: NotificationItem) =>
    n.kind === 'PROFILE_PUBLISHED'
      ? `/profiles/${n.payload.profileId}`
      : `/estimates/${n.payload.estimateId}`;
  const values = (n: NotificationItem) => ({
    actor: n.payload.actorName,
    estimate: n.payload.estimateName ?? '',
    version: n.payload.versionNumber ?? 0,
    profile: n.payload.profileName ?? '',
    project: n.payload.projectName ?? t('globalScope'),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={unread ? t('bellUnread', { n: unread }) : t('title')}
        >
          <Bell aria-hidden="true" />
          {unread ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-4 font-semibold text-primary-foreground"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={t('title')} className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          {unread ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              {t('markAll')}
            </Button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn(!n.readAt && 'bg-detailed-soft/60')}>
                <PopoverClose asChild>
                  <Link
                    href={href(n)}
                    onClick={() => (n.readAt ? undefined : read.mutate(n.id))}
                    className="grid gap-0.5 px-4 py-2.5 text-sm hover:bg-muted focus-visible:bg-muted"
                  >
                    <span className={cn(!n.readAt && 'font-medium')}>
                      {!n.readAt ? <span className="sr-only">{t('unreadLabel')} </span> : null}
                      {t(`body.${n.kind}`, values(n))}
                    </span>
                    {n.payload.note ? (
                      <span className="line-clamp-2 text-muted-foreground italic">
                        {n.payload.note}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(n.createdAt, locale)}
                    </span>
                  </Link>
                </PopoverClose>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

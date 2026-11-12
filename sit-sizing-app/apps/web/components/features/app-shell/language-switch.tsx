'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LangSwitch } from '@/components/patterns/lang-switch';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n';
import { useUpdateLocale } from '@/lib/query/hooks';

const OPTIONS = [
  { value: 'en', label: 'EN', title: 'English' },
  { value: 'vi', label: 'VI', title: 'Tiếng Việt' },
] as const;

const remember = (locale: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
};

/**
 * Switches the URL locale, remembers the choice in this browser and, for a signed-in user,
 * saves it to their profile (design 8.5).
 */
export function LanguageSwitch({ saveToProfile }: { saveToProfile: boolean }) {
  const t = useTranslations('app');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const update = useUpdateLocale();
  return (
    <LangSwitch
      label={t('language')}
      value={locale}
      options={OPTIONS}
      onChange={(next) => {
        if (!isLocale(next)) return;
        remember(next);
        if (saveToProfile) update.mutate(next);
        router.replace(pathname, { locale: next });
      }}
    />
  );
}

/**
 * On a browser that has not chosen a language yet, opens the app in the language saved to
 * the user's profile (for example after signing in on a new device).
 */
export function AdoptProfileLocale({
  profileLocale,
  localeChosen,
}: {
  profileLocale: Locale | null;
  localeChosen: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (localeChosen || !profileLocale) return;
    remember(profileLocale);
    if (profileLocale !== locale) router.replace(pathname, { locale: profileLocale });
  }, [localeChosen, profileLocale, locale, router, pathname]);
  return null;
}

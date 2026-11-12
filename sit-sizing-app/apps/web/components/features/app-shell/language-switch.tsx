'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LangSwitch } from '@/components/patterns/lang-switch';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n';

const OPTIONS = [
  { value: 'en', label: 'EN', title: 'English' },
  { value: 'vi', label: 'VI', title: 'Tiếng Việt' },
] as const;

/** Switches the URL locale and remembers the choice for the next visit. */
export function LanguageSwitch() {
  const t = useTranslations('app');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <LangSwitch
      label={t('language')}
      value={locale}
      options={OPTIONS}
      onChange={(next) => {
        if (!isLocale(next)) return;
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.replace(pathname, { locale: next });
      }}
    />
  );
}

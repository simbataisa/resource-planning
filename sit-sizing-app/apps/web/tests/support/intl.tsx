import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';

/** Renders a component inside the i18n provider, as the [locale] layout does. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = 'en', ...options }: { locale?: 'en' | 'vi' } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={locale === 'vi' ? vi : en} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

import { setRequestLocale } from 'next-intl/server';
import { GuidePage } from '@/components/features/content/content-pages';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  // Server pages render apart from the layout, so each one sets the locale (next-intl).
  setRequestLocale((await params).locale);
  return <GuidePage />;
}

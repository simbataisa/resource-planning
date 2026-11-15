import { setRequestLocale } from 'next-intl/server';
import { TakeTourButton } from '@/components/features/tours/tour-menu';
import { GuidePage } from '@/components/features/content/content-pages';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  // Server pages render apart from the layout, so each one sets the locale (next-intl).
  setRequestLocale((await params).locale);
  return (
    <div className="grid gap-6">
      <TakeTourButton />
      <GuidePage />
    </div>
  );
}

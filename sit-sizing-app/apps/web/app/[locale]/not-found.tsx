import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/patterns/empty-state';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <EmptyState title={t('notFoundTitle')} description={t('notFoundBody')} />
    </main>
  );
}

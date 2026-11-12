import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/patterns/page-header';

/** Public page Keycloak returns to after sign-out (registered redirect URI `/signed-out`). */
export default async function SignedOutPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        title={t('signedOutTitle')}
        description={t('signedOutBody')}
        actions={
          <Button asChild>
            <a href="/api/auth/signin">{t('signIn')}</a>
          </Button>
        }
      />
    </main>
  );
}

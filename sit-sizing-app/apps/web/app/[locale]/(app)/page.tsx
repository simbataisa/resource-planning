import { redirect } from '@/i18n/navigation';

/** The start page is the project list. */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/projects', locale });
}

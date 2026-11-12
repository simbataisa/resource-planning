import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page-header';
import messages from '@/messages/en.json';
import { currentUserFromCookies } from '@/server/auth/current-user';

/** Placeholder home page. Replaced by the estimate list in step 1.5. */
export default async function HomePage() {
  const store = await cookies();
  const user = await currentUserFromCookies(
    Object.fromEntries(store.getAll().map((c) => [c.name, c.value])),
  );
  const t = messages.home;
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        title={t.title}
        description={user ? `${messages.auth.signedInAs} ${user.displayName}` : undefined}
        actions={
          <Button asChild variant={user ? 'outline' : 'default'}>
            <a href={user ? '/api/auth/signout' : '/api/auth/signin'}>
              {user ? messages.auth.signOut : messages.auth.signIn}
            </a>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{t.status}</CardTitle>
          <CardDescription>{t.disclaimer}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="link" className="px-0">
            <a href="/api/v1/docs">{t.apiDocs}</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

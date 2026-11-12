import { cookies } from 'next/headers';
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
    <main className="shell">
      <h1>{t.title}</h1>
      {user ? (
        <p>
          {messages.auth.signedInAs} <strong>{user.displayName}</strong> ·{' '}
          <a href="/api/auth/signout">{messages.auth.signOut}</a>
        </p>
      ) : (
        <p>
          <a href="/api/auth/signin">{messages.auth.signIn}</a>
        </p>
      )}
      <p>{t.status}</p>
      <p className="muted">{t.disclaimer}</p>
    </main>
  );
}

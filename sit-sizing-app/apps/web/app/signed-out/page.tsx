import messages from '@/messages/en.json';

/** Public page Keycloak returns to after sign-out (registered post-logout redirect URI). */
export default function SignedOutPage() {
  const t = messages.auth;
  return (
    <main className="shell">
      <h1>{t.signedOutTitle}</h1>
      <p>{t.signedOutBody}</p>
      <p>
        <a href="/api/auth/signin">{t.signIn}</a>
      </p>
    </main>
  );
}

import messages from '@/messages/en.json';

/** Placeholder home page for step 1.0. Replaced by the estimate list in step 1.5. */
export default function HomePage() {
  const t = messages.home;
  return (
    <main className="shell">
      <h1>{t.title}</h1>
      <p>{t.status}</p>
      <p className="muted">{t.disclaimer}</p>
    </main>
  );
}

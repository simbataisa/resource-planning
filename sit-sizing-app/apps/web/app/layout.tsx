import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIT Sizing',
  description: 'Estimate SIT and QE effort with a versioned, auditable model.',
};

// Locale routing (`[locale]` segment, next-intl) arrives in step 1.5/1.6.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

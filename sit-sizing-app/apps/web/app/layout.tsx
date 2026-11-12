import type { ReactNode } from 'react';

/**
 * Pass-through root layout. The `<html>` element is rendered by `app/[locale]/layout.tsx`
 * so its `lang` attribute follows the locale in the URL (design 8.5).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

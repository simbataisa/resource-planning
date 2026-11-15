'use client';

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

/** The collapse toggle in the sidebar header, on desktop only (the phone sheet has its own close). */
export function SidebarHeaderToggle({ label }: { label: string }) {
  const { isMobile } = useSidebar();
  return isMobile ? null : <SidebarTrigger label={label} />;
}

/** On a phone the sidebar is hidden, so a slim bar keeps its toggle in reach (ADR-0015). */
export function MobileSidebarBar({ label }: { label: string }) {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <div className="sticky top-0 z-10 flex h-12 items-center border-b bg-card px-2">
      <SidebarTrigger label={label} />
    </div>
  );
}

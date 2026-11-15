'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { Link } from '@/i18n/navigation';

/** One sidebar link: icon, label, tooltip when collapsed; closes the mobile sheet when chosen. */
export function SidebarNavLink({
  href,
  label,
  icon: Icon,
  active,
  tour,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Guided-tour target name, rendered as `data-tour`. */
  tour?: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link href={href} data-tour={tour} onClick={() => setOpenMobile(false)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** The brand link at the top of the sidebar; like the other links, closes the mobile sheet. */
export function SidebarBrandLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link href="/projects" className={className} onClick={() => setOpenMobile(false)}>
      {children}
    </Link>
  );
}

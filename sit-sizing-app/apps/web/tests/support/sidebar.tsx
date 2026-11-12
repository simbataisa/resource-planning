import type { ReactNode } from 'react';
import { SidebarMenu, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

/** Wraps sidebar items in the providers and list the app shell gives them. */
export function InSidebar({ children, menu = false }: { children: ReactNode; menu?: boolean }) {
  return (
    <TooltipProvider>
      <SidebarProvider>{menu ? <SidebarMenu>{children}</SidebarMenu> : children}</SidebarProvider>
    </TooltipProvider>
  );
}

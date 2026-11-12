// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './sidebar';
import { TooltipProvider } from './tooltip';

const original = window.matchMedia;

afterEach(() => {
  window.matchMedia = original;
  document.cookie = 'sidebar_state=; max-age=0; path=/';
});

function mockMobile(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function Example() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar
          collapsible="icon"
          label="Sidebar"
          mobileTitle="Navigation"
          mobileCloseLabel="Close navigation"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Work</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive tooltip="Projects">
                      <a href="/x">Projects</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Profiles">
                      <a href="/y">Profiles</a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger label="Toggle sidebar" />
          <p>Page</p>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

const sidebarState = (container: HTMLElement) =>
  container.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state');

describe('Sidebar (layer 2)', () => {
  it('desktop: trigger collapses to icons and writes the cookie', async () => {
    const user = userEvent.setup();
    const { container } = render(<Example />);
    expect(sidebarState(container)).toBe('expanded');
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(sidebarState(container)).toBe('collapsed');
    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('Ctrl+B toggles the sidebar', async () => {
    const user = userEvent.setup();
    const { container } = render(<Example />);
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebarState(container)).toBe('collapsed');
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebarState(container)).toBe('expanded');
  });

  it('Ctrl+B is left alone while typing in a field', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <Example />
        <input aria-label="Count" />
      </>,
    );
    await user.click(screen.getByRole('textbox', { name: 'Count' }));
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebarState(container)).toBe('expanded');
  });

  it('active item is marked for assistive tech', () => {
    render(<Example />);
    const active = screen.getByRole('link', { name: 'Projects' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: 'Profiles' })).not.toHaveAttribute('aria-current');
  });

  it('desktop sidebar is a named complementary landmark', () => {
    render(<Example />);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('inset is not a second main landmark', () => {
    render(<Example />);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('mobile: trigger opens a titled sheet', async () => {
    mockMobile(true);
    const user = userEvent.setup();
    render(<Example />);
    expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is accessible when expanded', async () => {
    const { container } = render(<Example />);
    await expectNoAxeViolations(container);
  });
});

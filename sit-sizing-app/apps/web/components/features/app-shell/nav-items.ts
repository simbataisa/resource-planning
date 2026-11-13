import {
  BookOpen,
  Calculator,
  ChartColumn,
  FileCode2,
  FolderKanban,
  ListChecks,
  ScrollText,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** Sections of the signed-in app, one per sidebar link (ADR-0015). */
export type NavSection =
  'projects' | 'profiles' | 'portfolio' | 'audit' | 'users' | 'guide' | 'method' | 'standards';

export const NAV_ICONS: Record<NavSection | 'apiDocs', LucideIcon> = {
  projects: FolderKanban,
  profiles: SlidersHorizontal,
  portfolio: ChartColumn,
  audit: ScrollText,
  users: Users,
  guide: BookOpen,
  method: Calculator,
  standards: ListChecks,
  apiDocs: FileCode2,
};

const BY_SEGMENT: Record<string, NavSection> = {
  projects: 'projects',
  estimates: 'projects', // estimates belong to a project
  profiles: 'profiles',
  portfolio: 'portfolio',
  audit: 'audit',
  admin: 'users',
  guide: 'guide',
  method: 'method',
  standards: 'standards',
};

/** The section a path belongs to, with or without a locale prefix; null outside the sections. */
export function sectionFor(pathname: string): NavSection | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'en' || segments[0] === 'vi') segments.shift();
  const first = segments[0];
  return first ? (BY_SEGMENT[first] ?? null) : null;
}

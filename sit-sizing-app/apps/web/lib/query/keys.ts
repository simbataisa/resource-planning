/** Query keys in one place so invalidation stays consistent (design 9.3). */
export const qk = {
  me: ['me'] as const,
  projects: (q?: object) => ['projects', q ?? {}] as const,
  project: (id: string) => ['project', id] as const,
  estimates: (projectId: string, q?: object) => ['estimates', projectId, q ?? {}] as const,
  estimate: (id: string) => ['estimate', id] as const,
  version: (estimateId: string, n: number) => ['version', estimateId, n] as const,
  compare: (estimateId: string, a: number, b: number) => ['compare', estimateId, a, b] as const,
  profiles: (projectId?: string) => ['profiles', projectId ?? null] as const,
  profile: (id: string) => ['profile', id] as const,
};

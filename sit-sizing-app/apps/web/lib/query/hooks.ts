'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualsCreate,
  DraftPatch,
  EstimateCreate,
  ProfileCreate,
  ProfileDetail,
  ProfileUpdate,
} from '@sit/schemas';
import type { z } from 'zod';
import { api } from '../api';
import { ApiClientError } from '../http';
import { qk } from './keys';

/** Query hooks: the only way components talk to the API (design 9.3). */
export const useMe = () => useQuery({ queryKey: qk.me, queryFn: api.me });

/** Saves the user's language to their profile (design 8.5). */
export function useUpdateLocale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locale: 'en' | 'vi') => api.updateMe({ locale }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}
export const useProjects = () =>
  useQuery({ queryKey: qk.projects(), queryFn: () => api.projects.list() });
export const useProject = (id: string) =>
  useQuery({ queryKey: qk.project(id), queryFn: () => api.projects.get(id) });
export const useEstimates = (projectId: string) =>
  useQuery({ queryKey: qk.estimates(projectId), queryFn: () => api.estimates.list(projectId) });
export const useEstimate = (id: string) =>
  useQuery({ queryKey: qk.estimate(id), queryFn: () => api.estimates.get(id) });
export const useVersion = (estimateId: string, n: number) =>
  useQuery({
    queryKey: qk.version(estimateId, n),
    queryFn: () => api.estimates.getVersion(estimateId, n),
  });
export const useProfiles = (projectId?: string) =>
  useQuery({ queryKey: qk.profiles(projectId), queryFn: () => api.profiles.list(projectId) });

export function useCreateEstimate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof EstimateCreate>) => api.estimates.create(projectId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estimates', projectId] }),
  });
}

/** Autosave. A 409 (stale or lost lock) is not retried; the editor shows recovery options (U-09). */
export function usePatchDraft(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof DraftPatch>) => api.estimates.patchDraft(estimateId, body),
    retry: (count, err) => !(err instanceof ApiClientError && err.status < 500) && count < 2,
    onSuccess: (v) => qc.setQueryData(qk.version(estimateId, v.number), v),
  });
}

/** Take or renew the draft edit lock (also the heartbeat); `true` takes it over (QE Lead). */
export function useLockDraft(estimateId: string) {
  return useMutation({
    mutationFn: (takeover: boolean = false) => api.estimates.lock(estimateId, { takeover }),
  });
}

/** Starts a new draft from the latest version; the editor then loads it. */
export function useCreateDraft(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fromVersion?: number) =>
      api.estimates.createDraft(estimateId, fromVersion ? { fromVersion } : {}),
    onSuccess: async (v) => {
      qc.setQueryData(qk.version(estimateId, v.number), v);
      await qc.invalidateQueries({ queryKey: qk.estimate(estimateId) });
    },
  });
}

export function useSaveVersion(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => api.estimates.saveVersion(estimateId, note ? { note } : {}),
    onSuccess: async (v) => {
      qc.setQueryData(qk.version(estimateId, v.number), v);
      await qc.invalidateQueries({ queryKey: qk.estimate(estimateId) });
    },
  });
}

/** Submit, approve or return a saved version (release 2, V-01). */
export function useReviewVersion(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { number: number; action: 'submit' | 'approve' | 'return'; note?: string }) =>
      api.estimates.review(estimateId, v.number, v.action, v.note ? { note: v.note } : {}),
    onSuccess: async (v) => {
      qc.setQueryData(qk.version(estimateId, v.number), v);
      await qc.invalidateQueries({ queryKey: qk.estimate(estimateId) });
    },
  });
}

export const useProfile = (id: string) =>
  useQuery({ queryKey: qk.profile(id), queryFn: () => api.profiles.get(id) });

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: z.input<typeof ProfileCreate>) => api.profiles.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

/** Save a draft profile's changes, or publish / retire it (P-01). */
export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  const done = async (p: ProfileDetail) => {
    qc.setQueryData(qk.profile(id), p);
    await qc.invalidateQueries({ queryKey: ['profiles'] });
  };
  return {
    save: useMutation({
      mutationFn: (body: z.input<typeof ProfileUpdate>) => api.profiles.update(id, body),
      onSuccess: done,
    }),
    setStatus: useMutation({
      mutationFn: (action: 'publish' | 'retire') => api.profiles.setStatus(id, action),
      onSuccess: done,
    }),
  };
}

/** Apply a published profile to the open draft; the editor reloads from the returned draft. */
export function useApplyProfile(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { profileId: string; rowVersion: number }) =>
      api.estimates.applyProfile(estimateId, body),
    onSuccess: (v) => qc.setQueryData(qk.version(estimateId, v.number), v),
  });
}

export const useCompare = (estimateId: string, a: number, b: number) =>
  useQuery({
    queryKey: qk.compare(estimateId, a, b),
    queryFn: () => api.estimates.compare(estimateId, a, b),
  });

/** My in-app notices; refreshed every minute and when the window regains focus (N-01). */
export const useNotifications = () =>
  useQuery({
    queryKey: qk.notifications,
    queryFn: api.notifications.list,
    refetchInterval: 60_000,
  });

export function useMarkNotifications() {
  const qc = useQueryClient();
  const done = (list: Awaited<ReturnType<typeof api.notifications.list>>) =>
    qc.setQueryData(qk.notifications, list);
  return {
    read: useMutation({ mutationFn: (id: string) => api.notifications.read(id), onSuccess: done }),
    readAll: useMutation({ mutationFn: () => api.notifications.readAll(), onSuccess: done }),
  };
}

/** SIT cycles recorded against a version, with their variance (P-02). */
export const useActuals = (estimateId: string, n: number) =>
  useQuery({
    queryKey: qk.actuals(estimateId, n),
    queryFn: () => api.estimates.actuals(estimateId, n),
  });

export function useRecordActuals(estimateId: string, n: number) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.actuals(estimateId, n) });
  return {
    record: useMutation({
      mutationFn: (body: z.input<typeof ActualsCreate>) =>
        api.estimates.recordActuals(estimateId, n, body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.estimates.deleteActuals(estimateId, n, id),
      onSuccess: refresh,
    }),
  };
}

/** Portfolio roll-up (R-01). */
export const usePortfolio = (q: { projectIds?: string[]; status: 'approved' | 'latest' }) =>
  useQuery({ queryKey: qk.portfolio(q), queryFn: () => api.portfolio(q) });

/** Audit events, newest first, a page at a time (H-01). */
export const useAudit = (q: Record<string, string | undefined>) =>
  useInfiniteQuery({
    queryKey: qk.audit(q),
    queryFn: ({ pageParam }) => api.audit({ ...q, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Everyone who has signed in (Admin), a page at a time. */
export const useUsers = (search: string) =>
  useInfiniteQuery({
    queryKey: qk.users({ search }),
    queryFn: ({ pageParam }) => api.users.list({ q: search || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) => api.users.setActive(v.id, v.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

/** Replace a project's members (existing PUT /projects/{id}/members). */
export function usePutMembers(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (members: { email: string; role: 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD' }[]) =>
      api.projects.putMembers(projectId, { members }),
    onSuccess: (p) => qc.setQueryData(qk.project(projectId), p),
  });
}

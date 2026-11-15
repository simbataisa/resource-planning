'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActualsCreate,
  DraftPatch,
  EstimateCreate,
  Me,
  ProfileCreate,
  ProfileDetail,
  ProfileUpdate,
  TourState,
  TourUpdate,
} from '@sit/schemas';
import type { z } from 'zod';
import { api } from '../api';
import { ApiClientError } from '../http';
import { forgetLockToken, lockTokenFor, rememberLockToken } from '../lock-tokens';
import { writeLocal } from '../tours/storage';
import { qk } from './keys';

/** Query hooks: the only way components talk to the API (design 9.3). */
export const useMe = (enabled = true) => useQuery({ queryKey: qk.me, queryFn: api.me, enabled });

/** Saves the user's language to their profile (design 8.5). */
export function useUpdateLocale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locale: 'en' | 'vi') => api.updateMe({ locale }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

const TOURS_KEY = ['me', 'tours'] as const;

/**
 * Applies a tour PATCH response. While another tour save is still in flight, the response may
 * predate an optimistic entry, so the cached entries win and nothing is rolled back.
 */
function applyToursResponse(qc: ReturnType<typeof useQueryClient>, me: Me) {
  const cached = qc.getQueryData<Me>(qk.me);
  const othersPending = qc.isMutating({ mutationKey: TOURS_KEY }) > 1;
  qc.setQueryData<Me>(
    qk.me,
    othersPending && cached ? { ...me, tours: { ...me.tours, ...cached.tours } } : me,
  );
}

/**
 * Records how guided tours were closed, optimistically (guided-tours spec 6.3): the `['me']` cache
 * and the browser copy change first, then `PATCH /me` runs. A failed save is never rolled back, so
 * a tour the user closed does not come back; the browser copy is resent on the next load.
 */
export function useSaveTours() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: TOURS_KEY,
    mutationFn: (update: TourUpdate) => api.updateMe({ tours: update }),
    onMutate: (update: TourUpdate) => {
      const at = new Date().toISOString();
      const me = qc.getQueryData<Me>(qk.me);
      if (!me) return;
      const tours: TourState = { ...me.tours };
      for (const [id, entry] of Object.entries(update)) {
        if (entry === null) {
          delete tours[id];
        } else {
          tours[id] = { status: entry.status, at };
          writeLocal(me.id, id, entry.status, at);
        }
      }
      qc.setQueryData<Me>(qk.me, { ...me, tours });
    },
    onSuccess: (me) => applyToursResponse(qc, me),
    // No onError: the cache and the browser copy keep the closed state (no rollback).
  });
}

/** Resends browser-copy tour entries the server lacks, without touching the browser copy. */
export function useSyncTours() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: TOURS_KEY,
    mutationFn: (update: TourUpdate) => api.updateMe({ tours: update }),
    onSuccess: (me) => applyToursResponse(qc, me),
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
    onSuccess: (e) => {
      // Draft 1 is locked to this tab; the editor renews with this token.
      rememberLockToken(e.id, e.lockToken);
      return qc.invalidateQueries({ queryKey: ['estimates', projectId] });
    },
  });
}

/** A call that uses the draft lock carries this tab's lock token (draft lock token design). */
type WithLockToken = { lockToken?: string };

/** Autosave. A 409 (stale or lost lock) is not retried; the editor shows recovery options (U-09). */
export function usePatchDraft(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lockToken, ...body }: z.input<typeof DraftPatch> & WithLockToken) =>
      api.estimates.patchDraft(estimateId, body, lockToken),
    retry: (count, err) => !(err instanceof ApiClientError && err.status < 500) && count < 2,
    onSuccess: (v) => qc.setQueryData(qk.version(estimateId, v.number), v),
  });
}

/**
 * Take or renew the draft edit lock (also the heartbeat). `takeover` takes it from someone else
 * (QE Lead) or from another tab of mine. A newly taken lock comes back with `lockToken`.
 */
export function useLockDraft(estimateId: string) {
  return useMutation({
    mutationFn: ({ takeover = false, lockToken }: { takeover?: boolean } & WithLockToken) =>
      api.estimates.lock(estimateId, { takeover }, lockToken),
  });
}

/**
 * While mounted, releases this tab's draft lock when the page is hidden (refresh, close,
 * navigate away), so the same tab renews on reload. Sends nothing without a token, or while
 * `busy()` says an autosave is pending or in flight (releasing would get that save refused).
 */
export function useReleaseLockOnPageHide(estimateId: string, busy?: () => boolean) {
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  });
  useEffect(() => {
    const onHide = () => {
      if (busyRef.current?.()) return;
      const token = lockTokenFor(estimateId);
      if (token) api.estimates.releaseOnPageHide(estimateId, token);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [estimateId]);
}

/** Starts a new draft from the latest version; the editor then loads it. */
export function useCreateDraft(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fromVersion?: number) =>
      api.estimates.createDraft(estimateId, fromVersion ? { fromVersion } : {}),
    onSuccess: async (v) => {
      // The new draft is locked to this tab; the editor renews with this token.
      rememberLockToken(estimateId, v.lockToken);
      qc.setQueryData(qk.version(estimateId, v.number), v);
      await qc.invalidateQueries({ queryKey: qk.estimate(estimateId) });
    },
  });
}

export function useSaveVersion(estimateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ note, lockToken }: { note?: string } & WithLockToken = {}) =>
      api.estimates.saveVersion(estimateId, note ? { note } : {}, lockToken),
    onSuccess: async (v) => {
      // Saving freezes the draft and clears its lock, so the token has no further use.
      forgetLockToken(estimateId);
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
    mutationFn: ({
      lockToken,
      ...body
    }: { profileId: string; rowVersion: number } & WithLockToken) =>
      api.estimates.applyProfile(estimateId, body, lockToken),
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

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DraftPatch, EstimateCreate } from '@sit/schemas';
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
    mutationFn: () => api.estimates.createDraft(estimateId),
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

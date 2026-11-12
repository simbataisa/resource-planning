import {
  Estimate,
  EstimateDetail,
  Me,
  page,
  Profile,
  ProfileDetail,
  Project,
  ProjectDetail,
  Version,
  VersionCompare,
  type DraftCreate,
  type DraftPatch,
  type EstimateCreate,
  type LockRequest,
  type MeUpdate,
  type MembersPut,
  type PageQuery,
  type ReturnRequest,
  type ReviewNote,
  type ProjectCreate,
  type ProjectUpdate,
  type VersionSave,
} from '@sit/schemas';
import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { http as defaultHttp } from '../http';
import { getParsed, sendParsed } from './client';

type In<S extends z.ZodType> = z.input<S>;
const ProjectPage = page(Project);
const EstimatePage = page(Estimate);
const ProfileList = z.object({ items: z.array(Profile) });

/** Typed endpoint functions (design 9.3). Build with a custom Axios instance in tests. */
export function createApi(http: AxiosInstance = defaultHttp) {
  return {
    me: () => getParsed(http, '/me', Me),
    updateMe: (body: In<typeof MeUpdate>) => sendParsed(http, 'patch', '/me', body, Me),
    projects: {
      list: (q?: Partial<PageQuery>) => getParsed(http, '/projects', ProjectPage, q),
      get: (projectId: string) => getParsed(http, `/projects/${projectId}`, ProjectDetail),
      create: (body: In<typeof ProjectCreate>) =>
        sendParsed(http, 'post', '/projects', body, Project),
      update: (projectId: string, body: In<typeof ProjectUpdate>) =>
        sendParsed(http, 'patch', `/projects/${projectId}`, body, Project),
      putMembers: (projectId: string, body: In<typeof MembersPut>) =>
        sendParsed(http, 'put', `/projects/${projectId}/members`, body, ProjectDetail),
    },
    estimates: {
      list: (projectId: string, q?: Partial<PageQuery>) =>
        getParsed(http, `/projects/${projectId}/estimates`, EstimatePage, q),
      create: (projectId: string, body: In<typeof EstimateCreate>) =>
        sendParsed(http, 'post', `/projects/${projectId}/estimates`, body, Estimate),
      get: (estimateId: string) => getParsed(http, `/estimates/${estimateId}`, EstimateDetail),
      getVersion: (estimateId: string, n: number) =>
        getParsed(http, `/estimates/${estimateId}/versions/${n}`, Version),
      createDraft: (estimateId: string, body: In<typeof DraftCreate> = {}) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/draft`, body, Version),
      patchDraft: (estimateId: string, body: In<typeof DraftPatch>) =>
        sendParsed(http, 'patch', `/estimates/${estimateId}/draft`, body, Version),
      lock: (estimateId: string, body: In<typeof LockRequest> = {}) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/draft/lock`, body, Version),
      unlock: async (estimateId: string) => {
        await http.delete(`/estimates/${estimateId}/draft/lock`);
      },
      saveVersion: (estimateId: string, body: In<typeof VersionSave> = {}) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/versions`, body, Version),
      /** Approval workflow (release 2, V-01). */
      review: (
        estimateId: string,
        n: number,
        action: 'submit' | 'approve' | 'return',
        body: In<typeof ReviewNote> | In<typeof ReturnRequest>,
      ) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/versions/${n}/${action}`, body, Version),
      compare: (estimateId: string, a: number, b: number) =>
        getParsed(http, `/estimates/${estimateId}/compare`, VersionCompare, { a, b }),
    },
    profiles: {
      list: (projectId?: string) =>
        getParsed(http, '/profiles', ProfileList, projectId ? { projectId } : undefined),
      get: (profileId: string) => getParsed(http, `/profiles/${profileId}`, ProfileDetail),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
export const api = createApi();

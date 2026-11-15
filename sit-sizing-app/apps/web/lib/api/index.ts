import {
  AdminUser,
  AuditPage,
  UserPage,
  Actuals,
  ActualsList,
  Estimate,
  EstimateCreated,
  EstimateDetail,
  Me,
  Portfolio,
  NotificationList,
  page,
  Profile,
  ProfileDetail,
  Project,
  ProjectDetail,
  Version,
  VersionCompare,
  type ActualsCreate,
  type DraftCreate,
  type DraftPatch,
  type EstimateCreate,
  type LockRequest,
  type MeUpdate,
  type MembersPut,
  type ProfileApply,
  type ProfileCreate,
  type ProfileUpdate,
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

/** The `X-Lock-Token` header for calls that use the draft lock (none until the tab has one). */
const lockHeader = (lockToken?: string): Record<string, string> | undefined =>
  lockToken ? { 'X-Lock-Token': lockToken } : undefined;

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
        sendParsed(http, 'post', `/projects/${projectId}/estimates`, body, EstimateCreated),
      get: (estimateId: string) => getParsed(http, `/estimates/${estimateId}`, EstimateDetail),
      getVersion: (estimateId: string, n: number) =>
        getParsed(http, `/estimates/${estimateId}/versions/${n}`, Version),
      createDraft: (estimateId: string, body: In<typeof DraftCreate> = {}) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/draft`, body, Version),
      patchDraft: (estimateId: string, body: In<typeof DraftPatch>, lockToken?: string) =>
        sendParsed(
          http,
          'patch',
          `/estimates/${estimateId}/draft`,
          body,
          Version,
          lockHeader(lockToken),
        ),
      /** Takes, renews (with this tab's token) or takes over the lock. */
      lock: (estimateId: string, body: In<typeof LockRequest> = {}, lockToken?: string) =>
        sendParsed(
          http,
          'post',
          `/estimates/${estimateId}/draft/lock`,
          body,
          Version,
          lockHeader(lockToken),
        ),
      unlock: async (estimateId: string, lockToken?: string) => {
        await http.delete(`/estimates/${estimateId}/draft/lock`, {
          headers: lockHeader(lockToken),
        });
      },
      /**
       * Releases the lock as the page goes away (pagehide). Axios cannot outlive the page, so
       * this is a `fetch` with `keepalive`; the answer is not read.
       */
      releaseOnPageHide: (estimateId: string, lockToken: string) => {
        void fetch(`${http.defaults.baseURL ?? '/api/v1'}/estimates/${estimateId}/draft/lock`, {
          method: 'DELETE',
          keepalive: true,
          credentials: 'same-origin',
          headers: { 'X-Lock-Token': lockToken },
        }).catch(() => undefined);
      },
      saveVersion: (estimateId: string, body: In<typeof VersionSave> = {}, lockToken?: string) =>
        sendParsed(
          http,
          'post',
          `/estimates/${estimateId}/versions`,
          body,
          Version,
          lockHeader(lockToken),
        ),
      /** Approval workflow (release 2, V-01). */
      review: (
        estimateId: string,
        n: number,
        action: 'submit' | 'approve' | 'return',
        body: In<typeof ReviewNote> | In<typeof ReturnRequest>,
      ) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/versions/${n}/${action}`, body, Version),
      /** Replace the draft's assumptions with a published profile (P-01). */
      applyProfile: (estimateId: string, body: In<typeof ProfileApply>, lockToken?: string) =>
        sendParsed(
          http,
          'post',
          `/estimates/${estimateId}/draft/profile`,
          body,
          Version,
          lockHeader(lockToken),
        ),
      /** SIT cycles recorded against a version (release 3, P-02). */
      actuals: (estimateId: string, n: number) =>
        getParsed(http, `/estimates/${estimateId}/versions/${n}/actuals`, ActualsList),
      recordActuals: (estimateId: string, n: number, body: In<typeof ActualsCreate>) =>
        sendParsed(http, 'post', `/estimates/${estimateId}/versions/${n}/actuals`, body, Actuals),
      deleteActuals: async (estimateId: string, n: number, id: string) => {
        await http.delete(`/estimates/${estimateId}/versions/${n}/actuals/${id}`);
      },
      compare: (estimateId: string, a: number, b: number) =>
        getParsed(http, `/estimates/${estimateId}/compare`, VersionCompare, { a, b }),
    },
    /** Admin and audit (release 3, H-01). */
    audit: (q: Record<string, string | number | undefined>) =>
      getParsed(http, '/audit', AuditPage, q),
    users: {
      list: (q: { q?: string; cursor?: string }) => getParsed(http, '/users', UserPage, q),
      setActive: (id: string, active: boolean) =>
        sendParsed(http, 'patch', `/users/${id}`, { active }, AdminUser),
    },
    /** Portfolio roll-up for the QBR (release 3, R-01). */
    portfolio: (q: { projectIds?: string[]; status: 'approved' | 'latest' }) =>
      getParsed(http, '/portfolio', Portfolio, {
        status: q.status,
        ...(q.projectIds?.length ? { projectIds: q.projectIds.join(',') } : {}),
      }),
    /** In-app notifications (release 2, N-01). */
    notifications: {
      list: () => getParsed(http, '/notifications', NotificationList),
      read: (id: string) =>
        sendParsed(http, 'post', `/notifications/${id}/read`, {}, NotificationList),
      readAll: () => sendParsed(http, 'post', '/notifications/read-all', {}, NotificationList),
    },
    profiles: {
      list: (projectId?: string) =>
        getParsed(http, '/profiles', ProfileList, projectId ? { projectId } : undefined),
      get: (profileId: string) => getParsed(http, `/profiles/${profileId}`, ProfileDetail),
      create: (body: In<typeof ProfileCreate>) =>
        sendParsed(http, 'post', '/profiles', body, ProfileDetail),
      update: (profileId: string, body: In<typeof ProfileUpdate>) =>
        sendParsed(http, 'patch', `/profiles/${profileId}`, body, ProfileDetail),
      setStatus: (profileId: string, action: 'publish' | 'retire') =>
        sendParsed(http, 'post', `/profiles/${profileId}/${action}`, {}, ProfileDetail),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
export const api = createApi();

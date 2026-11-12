import {
  DraftCreate,
  DraftPatch,
  EstimateCreate,
  EstimateDetail,
  Estimate,
  Health,
  LockRequest,
  Me,
  MembersPut,
  PageQuery,
  page,
  Profile,
  ProfileDetail,
  ProfileListQuery,
  Project,
  ProjectCreate,
  ProjectDetail,
  ProjectUpdate,
  Ready,
  Version,
  VersionSave,
} from '@sit/schemas';
import { z } from 'zod';
import { EstimateParams, ProfileParams, ProjectParams, VersionParams } from '../http/params';

export type MinRole = 'none' | 'USER' | 'VIEWER' | 'ESTIMATOR' | 'QE_LEAD' | 'ADMIN';
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface Operation {
  method: Method;
  /** OpenAPI path under /api/v1, with {param} placeholders. */
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description?: string;
  minRole: MinRole;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  bodyExample?: unknown;
  success: { status: number; description: string; schema?: z.ZodType; example?: unknown };
  /** Error statuses this operation can return, besides 500. */
  errors: number[];
}

const AUTH = [401];
const READ = [400, 401, 404];
const WRITE = [400, 401, 403, 404, 409];

/** Synthetic example values only (design 9.4). */
const EX_USER = {
  id: 'clx0synthuser0001',
  displayName: 'Synthetic Estimator',
  email: 'estimator@example.invalid',
};
const EX_PROJECT = {
  id: 'clx0synthproj0001',
  key: 'DEMO',
  name: 'Synthetic · Retail lending',
  description: null,
  archived: false,
  createdAt: '2026-11-12T09:00:00.000Z',
  myRole: 'ESTIMATOR',
};

/**
 * Every /api/v1 endpoint. A route handler without an entry here fails the contract test
 * (AGENTS.md rule 15). Keep in the order of design 9.2.
 */
export const OPERATIONS: Operation[] = [
  {
    method: 'get',
    path: '/projects',
    operationId: 'listProjects',
    tag: 'Projects',
    minRole: 'USER',
    summary: 'List my projects',
    description: 'All projects for an Admin; otherwise projects the caller is a member of.',
    query: PageQuery,
    success: {
      status: 200,
      description: 'A page of projects',
      schema: page(Project),
      example: { items: [EX_PROJECT], nextCursor: null },
    },
    errors: [400, ...AUTH],
  },
  {
    method: 'post',
    path: '/projects',
    operationId: 'createProject',
    tag: 'Projects',
    minRole: 'ADMIN',
    summary: 'Create a project',
    description: 'The creator becomes its first QE Lead.',
    body: ProjectCreate,
    bodyExample: { key: 'DEMO', name: 'Synthetic · Retail lending' },
    success: {
      status: 201,
      description: 'Created',
      schema: Project,
      example: { ...EX_PROJECT, myRole: 'QE_LEAD' },
    },
    errors: [400, 401, 403, 409],
  },
  {
    method: 'get',
    path: '/projects/{projectId}',
    operationId: 'getProject',
    tag: 'Projects',
    minRole: 'VIEWER',
    summary: 'Read a project with its members',
    params: ProjectParams,
    success: { status: 200, description: 'The project', schema: ProjectDetail },
    errors: READ,
  },
  {
    method: 'patch',
    path: '/projects/{projectId}',
    operationId: 'updateProject',
    tag: 'Projects',
    minRole: 'QE_LEAD',
    summary: 'Rename, describe or archive a project',
    params: ProjectParams,
    body: ProjectUpdate,
    bodyExample: { archived: true },
    success: { status: 200, description: 'Updated', schema: Project },
    errors: WRITE,
  },
  {
    method: 'put',
    path: '/projects/{projectId}/members',
    operationId: 'putProjectMembers',
    tag: 'Projects',
    minRole: 'QE_LEAD',
    summary: 'Replace the member list',
    description: 'Every person must have signed in once. At least one QE Lead is required.',
    params: ProjectParams,
    body: MembersPut,
    bodyExample: {
      members: [
        { email: 'lead@example.invalid', role: 'QE_LEAD' },
        { email: 'estimator@example.invalid', role: 'ESTIMATOR' },
      ],
    },
    success: {
      status: 200,
      description: 'The project with its new members',
      schema: ProjectDetail,
    },
    errors: [...WRITE, 422],
  },
  {
    method: 'get',
    path: '/projects/{projectId}/estimates',
    operationId: 'listEstimates',
    tag: 'Estimates',
    minRole: 'VIEWER',
    summary: 'List estimates in a project',
    params: ProjectParams,
    query: PageQuery,
    success: { status: 200, description: 'A page of estimates', schema: page(Estimate) },
    errors: READ,
  },
  {
    method: 'post',
    path: '/projects/{projectId}/estimates',
    operationId: 'createEstimate',
    tag: 'Estimates',
    minRole: 'ESTIMATOR',
    summary: 'Create an estimate',
    description:
      'Creates draft version 1 from the example or a blank scope, locked to the creator.',
    params: ProjectParams,
    body: EstimateCreate,
    bodyExample: { name: 'Synthetic · Mobile onboarding R3', template: 'example' },
    success: { status: 201, description: 'Created', schema: Estimate },
    errors: [...WRITE, 422],
  },
  {
    method: 'get',
    path: '/estimates/{estimateId}',
    operationId: 'getEstimate',
    tag: 'Estimates',
    minRole: 'VIEWER',
    summary: 'Read an estimate with its version list',
    params: EstimateParams,
    success: { status: 200, description: 'The estimate', schema: EstimateDetail },
    errors: READ,
  },
  {
    method: 'get',
    path: '/estimates/{estimateId}/versions/{number}',
    operationId: 'getVersion',
    tag: 'Versions',
    minRole: 'VIEWER',
    summary: 'Read one version with inputs, assumptions and result',
    params: VersionParams,
    success: { status: 200, description: 'The version', schema: Version },
    errors: READ,
  },
  {
    method: 'post',
    path: '/estimates/{estimateId}/draft',
    operationId: 'createDraft',
    tag: 'Versions',
    minRole: 'ESTIMATOR',
    summary: 'Start a new draft',
    description:
      'Copies a saved version (default: the latest) and recomputes it with the current engine.',
    params: EstimateParams,
    body: DraftCreate,
    bodyExample: {},
    success: { status: 201, description: 'The new draft, locked to the caller', schema: Version },
    errors: WRITE,
  },
  {
    method: 'patch',
    path: '/estimates/{estimateId}/draft',
    operationId: 'patchDraft',
    tag: 'Versions',
    minRole: 'ESTIMATOR',
    summary: 'Autosave the draft',
    description:
      'Lock holder only. The server recomputes the result. Send the rowVersion you last saw; a stale one returns 409.',
    params: EstimateParams,
    body: DraftPatch,
    bodyExample: { rowVersion: 3, note: 'Synthetic note' },
    success: { status: 200, description: 'The draft with its new rowVersion', schema: Version },
    errors: WRITE,
  },
  {
    method: 'post',
    path: '/estimates/{estimateId}/draft/lock',
    operationId: 'lockDraft',
    tag: 'Versions',
    minRole: 'ESTIMATOR',
    summary: 'Take, renew or take over the edit lock',
    description:
      'The lock lasts 15 minutes and is renewed by calling this again or by an autosave. `takeover: true` is for QE Leads.',
    params: EstimateParams,
    body: LockRequest,
    bodyExample: { takeover: false },
    success: { status: 200, description: 'The draft with the lock', schema: Version },
    errors: WRITE,
  },
  {
    method: 'delete',
    path: '/estimates/{estimateId}/draft/lock',
    operationId: 'unlockDraft',
    tag: 'Versions',
    minRole: 'ESTIMATOR',
    summary: 'Release the edit lock',
    params: EstimateParams,
    success: { status: 204, description: 'Released' },
    errors: WRITE,
  },
  {
    method: 'post',
    path: '/estimates/{estimateId}/versions',
    operationId: 'saveVersion',
    tag: 'Versions',
    minRole: 'ESTIMATOR',
    summary: 'Save the draft as a version',
    description: 'Lock holder only. The saved version is immutable.',
    params: EstimateParams,
    body: VersionSave,
    bodyExample: { note: 'Synthetic · ready for review' },
    success: { status: 201, description: 'The saved version', schema: Version },
    errors: WRITE,
  },
  {
    method: 'get',
    path: '/profiles',
    operationId: 'listProfiles',
    tag: 'Assumption profiles',
    minRole: 'USER',
    summary: 'List assumption profiles',
    description: "Published global profiles, plus the project's profiles when projectId is given.",
    query: ProfileListQuery,
    success: {
      status: 200,
      description: 'Profiles',
      schema: z.object({ items: z.array(Profile) }),
    },
    errors: READ,
  },
  {
    method: 'get',
    path: '/profiles/{profileId}',
    operationId: 'getProfile',
    tag: 'Assumption profiles',
    minRole: 'VIEWER',
    summary: 'Read a profile with its values',
    params: ProfileParams,
    success: { status: 200, description: 'The profile', schema: ProfileDetail },
    errors: READ,
  },
  {
    method: 'get',
    path: '/me',
    operationId: 'getMe',
    tag: 'Session',
    minRole: 'USER',
    summary: 'Current user, roles and locale',
    success: {
      status: 200,
      description: 'The signed-in user',
      schema: Me,
      example: { ...EX_USER, globalRole: 'USER', locale: 'en', memberships: [] },
    },
    errors: AUTH,
  },
  {
    method: 'get',
    path: '/openapi.json',
    operationId: 'getOpenApi',
    tag: 'Documentation',
    minRole: 'USER',
    summary: 'This OpenAPI document',
    success: { status: 200, description: 'OpenAPI document', schema: z.looseObject({}) },
    errors: AUTH,
  },
  {
    method: 'get',
    path: '/docs',
    operationId: 'getApiReference',
    tag: 'Documentation',
    minRole: 'USER',
    summary: 'Interactive API reference (Scalar)',
    success: { status: 200, description: 'HTML page' },
    errors: AUTH,
  },
  {
    method: 'get',
    path: '/health',
    operationId: 'getHealth',
    tag: 'Operations',
    minRole: 'none',
    summary: 'Liveness',
    success: { status: 200, description: 'The process is up', schema: Health },
    errors: [],
  },
  {
    method: 'get',
    path: '/ready',
    operationId: 'getReady',
    tag: 'Operations',
    minRole: 'none',
    summary: 'Readiness (database reachable)',
    success: { status: 200, description: 'Ready', schema: Ready },
    errors: [503],
  },
];

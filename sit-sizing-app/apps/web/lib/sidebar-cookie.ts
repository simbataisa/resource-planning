/**
 * Cookie that remembers whether the sidebar is expanded (ADR-0015). A plain module, not
 * 'use client', so the server layout can read the real name and set the initial state.
 */
export const SIDEBAR_COOKIE_NAME = 'sidebar_state';
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

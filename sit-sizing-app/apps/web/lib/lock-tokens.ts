/**
 * Draft lock tokens held by this browser tab (draft lock token design, 4). Memory only: never
 * written to localStorage, sessionStorage or cookies, so another tab never shares a token.
 * Creating an estimate or a draft hands its token to the editor through this map.
 */
const tokens = new Map<string, string>();

export const lockTokenFor = (estimateId: string): string | undefined => tokens.get(estimateId);

export function rememberLockToken(estimateId: string, token: string | undefined): void {
  if (token) tokens.set(estimateId, token);
}

export function forgetLockToken(estimateId: string): void {
  tokens.delete(estimateId);
}

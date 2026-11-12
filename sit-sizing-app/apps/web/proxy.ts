import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 request proxy (formerly middleware).
 * Step 1.0: guarantees every request carries an `x-request-id` (design 12.6).
 * Step 1.3 adds the Auth.js session check here.
 */
const REQUEST_ID = 'x-request-id';
const VALID_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function proxy(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID);
  const requestId = incoming && VALID_ID.test(incoming) ? incoming : crypto.randomUUID();

  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID, requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID, requestId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

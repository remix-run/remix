import type { Cookie } from '@remix-run/cookie';
import type { Middleware } from '@remix-run/fetch-router';
import { type SessionStorage } from '@remix-run/session';
/**
 * Middleware that manages request session state on request context.
 *
 * @param sessionCookie The session cookie to use
 * @param sessionStorage The storage backend for session data
 * @returns The session middleware
 */
export declare function session(sessionCookie: Cookie, sessionStorage: SessionStorage): Middleware;
//# sourceMappingURL=session.d.ts.map
import type { Cookie } from '@remix-run/cookie';
import type { Middleware } from '@remix-run/fetch-router';
import { Session, type SessionStorage } from '@remix-run/session';
/**
 * Middleware that manages request session state on request context.
 * Session cookies default to HTTP-only and use Secure for HTTPS requests.
 * Explicit cookie settings take precedence.
 * Configured cookie lifetimes are also checked before loading session data.
 *
 * @param sessionCookie The session cookie to use
 * @param sessionStorage The storage backend for session data
 * @returns The session middleware
 */
export declare function session(sessionCookie: Cookie, sessionStorage: SessionStorage): Middleware<{
    key: typeof Session;
    value: Session;
    property: 'session';
}>;
//# sourceMappingURL=session.d.ts.map
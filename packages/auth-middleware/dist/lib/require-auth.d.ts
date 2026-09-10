import type { Middleware, RequestContext } from '@remix-run/fetch-router';
import { Auth, type BadAuth, type GoodAuth } from './auth.ts';
/**
 * Options for enforcing authentication on a route.
 */
export interface RequireAuthOptions {
    /** Custom response builder for unauthenticated requests. */
    onFailure?: (context: RequestContext, auth: BadAuth) => Response | Promise<Response>;
}
/**
 * Enforces that `auth()` has already resolved a successful auth state for the current request.
 *
 * @param options Failure handling options for unauthenticated requests.
 * @returns Middleware that allows authenticated requests through, rejects anonymous ones, and
 * narrows auth state on request context.
 */
export declare function requireAuth<identity = unknown>(options?: RequireAuthOptions): Middleware<{
    key: typeof Auth;
    value: GoodAuth<identity>;
    property: 'auth';
}>;
//# sourceMappingURL=require-auth.d.ts.map
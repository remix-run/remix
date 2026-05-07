import type { GetContextValue, Middleware, RequestContext, SetContextValue } from '@remix-run/fetch-router';
import { Auth, type BadAuth, type GoodAuth } from './auth.ts';
type ExistingGoodAuth<context extends RequestContext<any, any>> = Extract<GetContextValue<context, typeof Auth>, GoodAuth<any>>;
type IsDefaultGoodAuth<auth> = [auth] extends [GoodAuth<unknown>] ? [GoodAuth<unknown>] extends [auth] ? true : false : false;
type ResolvedGoodAuth<context extends RequestContext<any, any>, identity> = [
    ExistingGoodAuth<context>
] extends [never] ? GoodAuth<identity> : IsDefaultGoodAuth<ExistingGoodAuth<context>> extends true ? GoodAuth<identity> : ExistingGoodAuth<context>;
type RequireAuthContextTransform<identity> = <context extends RequestContext<any, any>>(context: context) => SetContextValue<context, typeof Auth, ResolvedGoodAuth<context, identity>>;
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
 * @returns Middleware that allows authenticated requests through and rejects anonymous ones.
 */
export declare function requireAuth<identity = unknown>(options?: RequireAuthOptions): Middleware<any, RequireAuthContextTransform<identity>>;
export {};
//# sourceMappingURL=require-auth.d.ts.map
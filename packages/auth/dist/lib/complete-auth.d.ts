import type { RequestContext } from '@remix-run/fetch-router';
import type { Session } from '@remix-run/session';
/**
 * Rotates the current session id and returns the fresh session for auth writes.
 *
 * @param context Current request context with session middleware installed.
 * @returns The current session after its id has been regenerated.
 */
export declare function completeAuth<context extends RequestContext<any, any> = RequestContext>(context: context): Session;
//# sourceMappingURL=complete-auth.d.ts.map
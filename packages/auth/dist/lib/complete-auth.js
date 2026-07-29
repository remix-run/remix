import { getSession } from "./utils.js";
/**
 * Rotates the current session id and returns the fresh session for auth writes.
 *
 * @param context Current request context with session middleware installed.
 * @returns The current session after its id has been regenerated.
 */
export function completeAuth(context) {
    let session = getSession(context, 'completeAuth()');
    session.regenerateId(true);
    return session;
}

import { redirect } from 'remix/response/redirect';
import { routes } from '../routes.js';
import { users } from '../data/schema.js';
import { setCurrentUser } from '../utils/context.js';
import { parseId } from '../utils/ids.js';
import { Session } from '../utils/session.js';
/**
 * Middleware that optionally loads the current user if authenticated.
 * Does not redirect if not authenticated.
 * Attaches user (if any) to request context.
 */
export function loadAuth() {
    return async ({ db, get }) => {
        let session = get(Session);
        let userId = parseId(session.get('userId'));
        if (userId !== undefined) {
            let user = await db.find(users, userId);
            if (user) {
                setCurrentUser(user);
            }
        }
    };
}
/**
 * Middleware that requires a user to be authenticated.
 * Redirects to login if not authenticated.
 * Attaches user to request context.
 */
export function requireAuth(options) {
    let redirectRoute = options?.redirectTo ?? routes.auth.login.index;
    return async ({ db, get, url }) => {
        let session = get(Session);
        let userId = parseId(session.get('userId'));
        let user = userId === undefined ? undefined : await db.find(users, userId);
        if (!user) {
            // Capture the current URL to redirect back to after login
            return redirect(redirectRoute.href(undefined, { returnTo: url.pathname + url.search }), 302);
        }
        setCurrentUser(user);
    };
}

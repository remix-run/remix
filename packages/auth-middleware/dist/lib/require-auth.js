import { Auth } from "./auth.js";
/**
 * Enforces that `auth()` has already resolved a successful auth state for the current request.
 *
 * @param options Failure handling options for unauthenticated requests.
 * @returns Middleware that allows authenticated requests through and rejects anonymous ones.
 */
export function requireAuth(options = {}) {
    return async (context, next) => {
        let auth = context.get(Auth);
        if (auth == null) {
            throw new Error('Auth state not found. Make sure auth() middleware runs before requireAuth().');
        }
        if (auth.ok) {
            return next();
        }
        let response = await createFailureResponse(auth, context, options);
        if (auth.error?.challenge != null && response.headers.get('WWW-Authenticate') == null) {
            response = new Response(response.body, response);
            response.headers.append('WWW-Authenticate', auth.error.challenge);
        }
        return response;
    };
}
async function createFailureResponse(auth, context, options) {
    if (options.onFailure) {
        return options.onFailure(context, auth);
    }
    return new Response('Unauthorized', {
        status: 401,
    });
}

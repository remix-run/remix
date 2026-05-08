import { Session } from '@remix-run/session';
/**
 * Middleware that manages request session state on request context.
 *
 * @param sessionCookie The session cookie to use
 * @param sessionStorage The storage backend for session data
 * @returns The session middleware
 */
export function session(sessionCookie, sessionStorage) {
    if (!sessionCookie.signed) {
        throw new Error('Session cookie must be signed');
    }
    return async (context, next) => {
        if (context.has(Session)) {
            throw new Error('Existing session found, refusing to overwrite');
        }
        let cookieValue = await sessionCookie.parse(context.headers.get('Cookie'));
        let session = await sessionStorage.read(cookieValue);
        context.set(Session, session);
        let response = await next();
        if (session !== context.get(Session)) {
            throw new Error('Cannot save session that was initialized by another middleware/handler');
        }
        let setCookieValue = await sessionStorage.save(session);
        if (setCookieValue != null) {
            // make sure the response is mutable
            response = new Response(response.body, response);
            response.headers.append('Set-Cookie', await sessionCookie.serialize(setCookieValue));
        }
        return response;
    };
}

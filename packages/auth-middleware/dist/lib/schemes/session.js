import { Session } from '@remix-run/session';
/**
 * Creates an auth scheme that resolves identity from session data loaded by `session()`.
 *
 * @param options Session reading, verification, and invalidation hooks.
 * @returns An auth scheme for use with `auth()`.
 */
export function createSessionAuthScheme(options) {
    let name = options.name ?? 'session';
    return {
        name,
        async authenticate(context) {
            let session = context.get(Session);
            if (session == null) {
                throw new Error('Session not found. Make sure session() middleware runs before createSessionAuthScheme().');
            }
            let value = options.read(session, context);
            if (value == null) {
                return;
            }
            let identity = await options.verify(value, context);
            if (identity != null) {
                return {
                    status: 'success',
                    identity,
                };
            }
            await options.invalidate?.(session, context);
            return {
                status: 'failure',
                code: options.code ?? 'invalid_credentials',
                message: options.message ?? 'Invalid session',
            };
        },
    };
}

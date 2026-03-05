import { getCurrentUser } from '../utils/context.js';
/**
 * Middleware that requires a user to have admin role.
 * Returns 403 Forbidden if user is not an admin.
 * Must be used after requireAuth middleware.
 */
export function requireAdmin() {
    return () => {
        let user = getCurrentUser();
        if (user.role !== 'admin') {
            return new Response('Forbidden', { status: 403 });
        }
    };
}

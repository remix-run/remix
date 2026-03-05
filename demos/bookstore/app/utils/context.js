import { createContextKey } from 'remix/fetch-router';
import { getContext } from 'remix/async-context-middleware';
import { getCart } from '../data/cart.js';
import { Session } from './session.js';
// Context key for attaching user data to request context
let USER_KEY = createContextKey();
/**
 * Get the current authenticated user from request context.
 */
export function getCurrentUser() {
    return getContext().get(USER_KEY);
}
/**
 * Get the current authenticated user from request context, or null if not authenticated.
 * Safe to use when running behind loadAuth middleware (not requireAuth).
 */
export function getCurrentUserSafely() {
    try {
        return getCurrentUser();
    }
    catch {
        return null;
    }
}
/**
 * Set the current authenticated user in request context.
 */
export function setCurrentUser(user) {
    getContext().set(USER_KEY, user);
}
/**
 * Get the current cart from the session.
 */
export function getCurrentCart() {
    return getCart(getContext().get(Session).get('cart'));
}

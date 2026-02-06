/**
 * Check if an object has middleware and an `actions` property (controller with middleware).
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller with middleware
 */
export function isControllerWithMiddleware(obj) {
    return typeof obj === 'object' && obj != null && 'middleware' in obj && 'actions' in obj;
}
/**
 * Check if an object has middleware and an `action` property (action with middleware).
 *
 * @param obj The object to check
 * @returns `true` if the object is an action with middleware
 */
export function isActionWithMiddleware(obj) {
    return typeof obj === 'object' && obj != null && 'middleware' in obj && 'action' in obj;
}

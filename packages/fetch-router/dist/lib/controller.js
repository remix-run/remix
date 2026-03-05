/**
 * Check if an object has an `actions` property (controller).
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export function isController(obj) {
    return typeof obj === 'object' && obj != null && 'actions' in obj;
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

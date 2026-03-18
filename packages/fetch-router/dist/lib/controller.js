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
 * Check if an object has an `action` property (action object).
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export function isActionObject(obj) {
    return typeof obj === 'object' && obj != null && 'action' in obj;
}

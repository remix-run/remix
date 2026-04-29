/**
 * Check if an object has an `actions` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export function isController(obj) {
    return typeof obj === 'object' && obj != null && 'actions' in obj;
}
/**
 * Check if an object has a `handler` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export function isActionObject(obj) {
    return typeof obj === 'object' && obj != null && 'handler' in obj;
}

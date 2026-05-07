/**
 * Check if an object has an object `actions` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export function isController(obj) {
    return isRecord(obj) && isRecord(obj.actions);
}
/**
 * Check if an object has a function `handler` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export function isActionObject(obj) {
    return isRecord(obj) && typeof obj.handler === 'function';
}
function isRecord(obj) {
    return typeof obj === 'object' && obj != null && !Array.isArray(obj);
}

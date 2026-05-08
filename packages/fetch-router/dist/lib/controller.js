export function isRequestHandler(object) {
    return typeof object === 'function';
}
/**
 * Defines a route handler with route-aware params and the default router context.
 *
 * This helper returns the action unchanged while giving TypeScript the route pattern it needs to
 * type `context.params`. If local middleware adds context values, compose those values into the
 * action context type and pass it as the second generic.
 *
 * @param route The route pattern or route object this action handles.
 * @param action The handler function or action object to type-check.
 * @returns The same action value.
 */
export function createAction(route, action) {
    void route;
    return action;
}
export function isAction(obj) {
    return isRequestHandler(obj) || isActionObject(obj);
}
export function isActionObject(obj) {
    return isRecord(obj) && typeof obj.handler === 'function';
}
/**
 * Defines a controller whose action keys and params are checked against a route map.
 *
 * This helper returns the controller unchanged while giving TypeScript the route map it needs to
 * type each action's `context.params`. If local middleware adds context values, compose those
 * values into the controller context type and pass it as the second generic.
 *
 * @param routes The route map this controller handles.
 * @param controller The controller object to type-check.
 * @returns The same controller value.
 */
export function createController(routes, controller) {
    void routes;
    return controller;
}
export function isController(obj) {
    return isRecord(obj) && isRecord(obj.actions);
}
function isRecord(obj) {
    return typeof obj === 'object' && obj != null && !Array.isArray(obj);
}

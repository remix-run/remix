import { createRoutes } from "../route-map.js";
/**
 * Create a route map with `index` (`GET`) and `action` (`POST`) routes, suitable
 * for showing a standard HTML `<form>` and handling its submit action at the same
 * URL.
 *
 * @param pattern The route pattern to use for the form and its submit action
 * @param options Options to configure the form action routes
 * @returns The route map with `index` and `action` routes
 */
export function createFormRoutes(pattern, options) {
    let formMethod = options?.formMethod ?? 'POST';
    let indexName = options?.names?.index ?? 'index';
    let actionName = options?.names?.action ?? 'action';
    return createRoutes(pattern, {
        [indexName]: { method: 'GET', pattern: '/' },
        [actionName]: { method: formMethod, pattern: '/' },
    });
}

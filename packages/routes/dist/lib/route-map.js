import { RoutePattern } from '@remix-run/route-pattern';
/**
 * A route definition that includes a request method and pattern.
 */
export class Route {
    /**
     * The HTTP method this route matches.
     */
    method;
    /**
     * The pattern this route matches.
     */
    pattern;
    /**
     * @param method The HTTP method this route matches
     * @param pattern The pattern this route matches
     */
    constructor(method, pattern) {
        this.method = method;
        this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
    }
    /**
     * Build a URL href for this route using the given parameters.
     *
     * @param args The parameters to use for building the href
     * @returns The built URL href
     */
    href(...args) {
        return this.pattern.href(...args);
    }
    /**
     * Match a URL against this route's pattern.
     *
     * @param url The URL to match
     * @returns The match result, or `null` if the URL doesn't match
     */
    match(url) {
        return this.pattern.match(url);
    }
}
export function createRoutes(baseOrDefs, defs) {
    return typeof baseOrDefs === 'string' || baseOrDefs instanceof RoutePattern
        ? buildRouteMap(typeof baseOrDefs === 'string' ? new RoutePattern(baseOrDefs) : baseOrDefs, defs)
        : buildRouteMap(new RoutePattern('/'), baseOrDefs);
}
function buildRouteMap(base, defs) {
    let routes = {};
    for (let key in defs) {
        let def = defs[key];
        if (def instanceof Route) {
            routes[key] = new Route(def.method, base.join(def.pattern));
        }
        else if (typeof def === 'string' || def instanceof RoutePattern) {
            routes[key] = new Route('ANY', base.join(def));
        }
        else if (typeof def === 'object' && def != null && 'pattern' in def) {
            routes[key] = new Route(def.method ?? 'ANY', base.join(def.pattern));
        }
        else {
            routes[key] = buildRouteMap(base, def);
        }
    }
    return routes;
}

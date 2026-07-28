import { RoutePattern } from '@remix-run/route-pattern';
import { createHref } from '@remix-run/route-pattern/href';
import { joinPatterns } from '@remix-run/route-pattern/join';
/**
 * A route definition that includes a request method and pattern.
 */
export class Route {
    /**
     * The HTTP method this route matches.
     */
    method;
    /**
     * The parsed route-pattern AST. Useful for advanced consumers (e.g. matchers) that want to skip
     * re-parsing the source string.
     */
    pattern;
    /**
     * @param method The HTTP method this route matches
     * @param pattern The route-pattern source string or pre-parsed AST
     */
    constructor(method, pattern) {
        this.method = method;
        this.pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern;
    }
    /**
     * Build a URL href for this route using the given parameters.
     *
     * @param args The parameters to use for building the href
     * @returns The built URL href
     */
    href(...args) {
        return createHref(this.pattern, ...args);
    }
}
export function createRoutes(baseOrDefs, defs) {
    let baseIsPattern = typeof baseOrDefs === 'string' || baseOrDefs instanceof RoutePattern;
    if (baseIsPattern) {
        let baseAst = typeof baseOrDefs === 'string' ? RoutePattern.parse(baseOrDefs) : baseOrDefs;
        return buildRouteMap(baseAst, defs);
    }
    return buildRouteMap(RoutePattern.parse('/'), baseOrDefs);
}
function buildRouteMap(base, defs) {
    let routes = {};
    for (let key in defs) {
        let def = defs[key];
        if (def instanceof Route) {
            routes[key] = new Route(def.method, joinPatterns(base, def.pattern));
        }
        else if (typeof def === 'string') {
            routes[key] = new Route('ANY', joinPatterns(base, RoutePattern.parse(def)));
        }
        else if (def instanceof RoutePattern) {
            routes[key] = new Route('ANY', joinPatterns(base, def));
        }
        else if (typeof def === 'object' && def != null && 'pattern' in def) {
            let defPattern = typeof def.pattern === 'string' ? RoutePattern.parse(def.pattern) : def.pattern;
            routes[key] = new Route(def.method ?? 'ANY', joinPatterns(base, defPattern));
        }
        else {
            routes[key] = buildRouteMap(base, def);
        }
    }
    return routes;
}

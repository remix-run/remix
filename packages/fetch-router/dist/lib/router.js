import { ArrayMatcher, RoutePattern } from '@remix-run/route-pattern';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isController, isActionObject, } from "./controller.js";
import { Route } from "./route-map.js";
function noMatchHandler({ url }) {
    return new Response(`Not Found: ${url.pathname}`, { status: 404 });
}
/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export function createRouter(options) {
    let defaultHandler = options?.defaultHandler ?? noMatchHandler;
    let matcher = options?.matcher ?? new ArrayMatcher();
    let globalMiddleware = options?.middleware;
    function normalizeAction(action) {
        if (isActionObject(action)) {
            return {
                handler: action.action,
                middleware: action.middleware && action.middleware.length > 0 ? action.middleware : undefined,
            };
        }
        return {
            handler: action,
            middleware: undefined,
        };
    }
    function mergeMiddleware(routeMiddleware, actionMiddleware) {
        if (!routeMiddleware || routeMiddleware.length === 0) {
            return actionMiddleware;
        }
        if (!actionMiddleware || actionMiddleware.length === 0) {
            return routeMiddleware;
        }
        return routeMiddleware.concat(actionMiddleware);
    }
    function createRequestContext(input, init) {
        let request = new Request(input, init);
        if (request.signal.aborted) {
            throw request.signal.reason;
        }
        return new RequestContext(request);
    }
    function dispatch(context) {
        for (let match of matcher.matchAll(context.url)) {
            let { handler, method, middleware } = match.data;
            if (method !== context.method && method !== 'ANY') {
                // Request method does not match, continue to next match
                continue;
            }
            context.params = match.params;
            if (middleware) {
                return runMiddleware(middleware, context, handler);
            }
            return raceRequestAbort(Promise.resolve(handler(context)), context.request);
        }
        return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request);
    }
    function registerRoute(method, route, action) {
        matcher.add(route instanceof Route ? route.pattern : route, {
            handler: action.handler,
            method,
            middleware: action.middleware,
        });
    }
    function addRoute(method, route, action) {
        registerRoute(method, route, normalizeAction(action));
    }
    function mapRoutes(target, handler) {
        // Single route: string, RoutePattern, or Route
        if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
            addRoute('ANY', target, handler);
            return;
        }
        // Route map
        if (!isController(handler)) {
            throw new TypeError('Expected a controller with an `actions` property');
        }
        mapController(target, handler);
    }
    function mapController(routes, controller, parentMiddleware = []) {
        let middleware = controller.middleware
            ? parentMiddleware.concat(controller.middleware)
            : parentMiddleware;
        for (let key in routes) {
            let route = routes[key];
            let action = controller.actions[key];
            if (route instanceof Route) {
                let normalizedAction = normalizeAction(action);
                let routeMiddleware = middleware.length > 0 ? middleware : undefined;
                registerRoute(route.method, route.pattern, {
                    handler: normalizedAction.handler,
                    middleware: mergeMiddleware(routeMiddleware, normalizedAction.middleware),
                });
            }
            else {
                if (!isController(action)) {
                    throw new TypeError(`Expected a nested controller with an \`actions\` property at \`${key}\``);
                }
                mapController(route, action, middleware);
            }
        }
    }
    let router = {
        fetch(input, init) {
            let context = createRequestContext(input, init);
            context.router = router;
            if (globalMiddleware) {
                return runMiddleware(globalMiddleware, context, dispatch);
            }
            return dispatch(context);
        },
        route: addRoute,
        map: mapRoutes,
        get(route, action) {
            addRoute('GET', route, action);
        },
        head(route, action) {
            addRoute('HEAD', route, action);
        },
        post(route, action) {
            addRoute('POST', route, action);
        },
        put(route, action) {
            addRoute('PUT', route, action);
        },
        patch(route, action) {
            addRoute('PATCH', route, action);
        },
        delete(route, action) {
            addRoute('DELETE', route, action);
        },
        options(route, action) {
            addRoute('OPTIONS', route, action);
        },
    };
    return router;
}

import { ArrayMatcher, RoutePattern } from '@remix-run/route-pattern';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isActionObject, isController, } from "./controller.js";
import { Route } from "./route-map.js";
function noMatchHandler({ url }) {
    return new Response(`Not Found: ${url.pathname}`, { status: 404 });
}
function normalizeAction(action) {
    if (isActionObject(action)) {
        return {
            handler: action.handler,
            middleware: action.middleware && action.middleware.length > 0 ? [...action.middleware] : undefined,
        };
    }
    return {
        handler: action,
        middleware: undefined,
    };
}
function mergeMiddleware(upstream, downstream) {
    if (!upstream || upstream.length === 0) {
        return downstream;
    }
    if (!downstream || downstream.length === 0) {
        return upstream;
    }
    return upstream.concat(downstream);
}
function createRequestContext(input, init) {
    let request = new Request(input, init);
    if (request.signal.aborted) {
        throw request.signal.reason;
    }
    return new RequestContext(request);
}
function getRoutePattern(target) {
    if (target instanceof Route) {
        return target.pattern;
    }
    return typeof target === 'string' ? new RoutePattern(target) : target;
}
function getMappedRouteMethod(target) {
    return target instanceof Route ? target.method : 'ANY';
}
export function createRouter(options) {
    let defaultHandler = (options?.defaultHandler ?? noMatchHandler);
    let matcher = options?.matcher ?? new ArrayMatcher();
    let routerMiddleware = options?.middleware ? [...options.middleware] : undefined;
    async function dispatchRouter(runtime, context) {
        let dispatch = () => dispatchMatches(runtime, context);
        if (runtime.middleware && runtime.middleware.length > 0) {
            return runMiddleware(runtime.middleware, context, dispatch);
        }
        return dispatch();
    }
    async function dispatchMatches(runtime, context) {
        for (let match of runtime.matcher.matchAll(context.url)) {
            if (match.data.method !== context.method && match.data.method !== 'ANY') {
                continue;
            }
            context.params = { ...context.params, ...match.params };
            if (match.data.middleware && match.data.middleware.length > 0) {
                return runMiddleware(match.data.middleware, context, match.data.handler);
            }
            return raceRequestAbort(Promise.resolve(match.data.handler(context)), context.request);
        }
        return raceRequestAbort(Promise.resolve(runtime.defaultHandler(context)), context.request);
    }
    function registerRoute(method, route, normalizedAction) {
        let pattern = getRoutePattern(route);
        let entry = {
            pattern,
            handler: normalizedAction.handler,
            method,
            middleware: normalizedAction.middleware,
        };
        matcher.add(pattern, entry);
    }
    function addRoute(method, route, handler) {
        registerRoute(method, route, normalizeAction(handler));
    }
    function mapRoutes(target, handler) {
        if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
            addRoute(getMappedRouteMethod(target), target, handler);
            return;
        }
        if (!isController(handler)) {
            throw new TypeError('Expected a controller with an `actions` property');
        }
        mapController(target, handler);
    }
    function mapController(routes, controller, parentMiddleware = []) {
        let controllerMiddleware = controller.middleware
            ? mergeMiddleware(parentMiddleware, controller.middleware)
            : parentMiddleware.length > 0
                ? parentMiddleware
                : undefined;
        for (let key in routes) {
            let route = routes[key];
            let action = controller.actions[key];
            if (route instanceof Route) {
                let normalizedAction = normalizeAction(action);
                registerRoute(route.method, route.pattern, {
                    handler: normalizedAction.handler,
                    middleware: mergeMiddleware(controllerMiddleware, normalizedAction.middleware),
                });
            }
            else {
                if (!isController(action)) {
                    throw new TypeError(`Expected a nested controller with an \`actions\` property at \`${key}\``);
                }
                mapController(route, action, controllerMiddleware ?? []);
            }
        }
    }
    function createVerbMethod(method) {
        return ((route, handler) => {
            addRoute(method, route, handler);
        });
    }
    let runtime = {
        defaultHandler,
        matcher,
        middleware: routerMiddleware,
    };
    let router = {
        fetch(input, init) {
            let context = createRequestContext(input, init);
            context.router = router;
            return dispatchRouter(runtime, context);
        },
        route(method, route, handler) {
            addRoute(method, route, handler);
        },
        map: mapRoutes,
        get: createVerbMethod('GET'),
        head: createVerbMethod('HEAD'),
        post: createVerbMethod('POST'),
        put: createVerbMethod('PUT'),
        patch: createVerbMethod('PATCH'),
        delete: createVerbMethod('DELETE'),
        options: createVerbMethod('OPTIONS'),
    };
    return router;
}

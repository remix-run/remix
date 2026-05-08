import { createMatcher, RoutePattern } from '@remix-run/route-pattern';
import { Route } from '@remix-run/routes';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isRequestHandler, isActionObject, isController, } from "./controller.js";
function noMatchHandler({ url }) {
    return new Response(`Not Found: ${url.pathname}`, { status: 404 });
}
function normalizeMiddleware(middleware) {
    return middleware == null || middleware.length === 0 ? undefined : [...middleware];
}
function normalizeAction(action) {
    if (isRequestHandler(action)) {
        return {
            handler: action,
            middleware: undefined,
        };
    }
    if (!isActionObject(action)) {
        throw new TypeError('Expected a request handler function or action object with a function `handler` property');
    }
    return {
        handler: action.handler,
        middleware: normalizeMiddleware(action.middleware),
    };
}
function isRouteTarget(target) {
    return typeof target === 'string' || target instanceof RoutePattern || target instanceof Route;
}
export function createRouter(options) {
    let defaultHandler = (options?.defaultHandler ?? noMatchHandler);
    let matcher = options?.matcher ?? createMatcher();
    let routerMiddleware = normalizeMiddleware(options?.middleware);
    async function dispatchRouter(context) {
        let dispatch = () => dispatchMatches(context);
        if (routerMiddleware) {
            return runMiddleware(routerMiddleware, context, dispatch);
        }
        return dispatch();
    }
    async function dispatchMatches(context) {
        for (let match of matcher.matchAll(context.url)) {
            let route = match.data;
            if (route.method !== context.method && route.method !== 'ANY') {
                continue;
            }
            context.params = { ...context.params, ...match.params };
            if (route.middleware) {
                return runMiddleware(route.middleware, context, route.handler);
            }
            return raceRequestAbort(Promise.resolve(route.handler(context)), context.request);
        }
        return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request);
    }
    function registerRoute(method, route, action) {
        let pattern = route instanceof Route
            ? route.pattern
            : typeof route === 'string'
                ? new RoutePattern(route)
                : route;
        let entry = {
            pattern,
            handler: action.handler,
            method,
            middleware: action.middleware,
        };
        matcher.add(pattern, entry);
    }
    function addRoute(method, route, action) {
        registerRoute(method, route, normalizeAction(action));
    }
    function mapRoutes(target, handler) {
        if (isRouteTarget(target)) {
            mapSingleRoute(target, handler);
            return;
        }
        if (!isController(handler)) {
            throw new TypeError('Expected a controller with an object `actions` property');
        }
        mapController(target, handler);
    }
    function mapSingleRoute(target, handler) {
        registerRoute(target instanceof Route ? target.method : 'ANY', target, normalizeAction(handler));
    }
    function mapController(routes, controller) {
        let controllerMiddleware = normalizeMiddleware(controller.middleware);
        for (let key in controller.actions) {
            if (!(key in routes)) {
                throw new TypeError(`Unknown action \`${key}\` in controller`);
            }
            if (!(routes[key] instanceof Route)) {
                throw new TypeError(`Cannot map nested route map key \`${key}\` in controller actions; call router.map() for that route map separately`);
            }
        }
        for (let key in routes) {
            let route = routes[key];
            if (route instanceof Route) {
                if (!Object.hasOwn(controller.actions, key)) {
                    throw new TypeError(`Missing action \`${key}\` in controller`);
                }
                let action = normalizeAction(controller.actions[key]);
                let middleware = action.middleware;
                if (controllerMiddleware) {
                    middleware = middleware ? controllerMiddleware.concat(middleware) : controllerMiddleware;
                }
                registerRoute(route.method, route.pattern, {
                    handler: action.handler,
                    middleware,
                });
            }
        }
    }
    function createVerbMethod(method) {
        return ((route, action) => {
            addRoute(method, route, action);
        });
    }
    let router = {
        fetch(input, init) {
            let request = input instanceof Request && init == null ? input : new Request(input, init);
            if (request.signal.aborted) {
                throw request.signal.reason;
            }
            let context = new RequestContext(request);
            context.router = router;
            return dispatchRouter(context);
        },
        route(method, route, action) {
            addRoute(method, route, action);
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

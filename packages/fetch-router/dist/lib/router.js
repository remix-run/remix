import { createMatcher, RoutePattern } from '@remix-run/route-pattern';
import { Route } from '@remix-run/routes';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isActionObject, isController, } from "./controller.js";
function noMatchHandler({ url }) {
    return new Response(`Not Found: ${url.pathname}`, { status: 404 });
}
function normalizeMiddleware(middleware) {
    if (middleware == null || middleware.length === 0) {
        return undefined;
    }
    return [...middleware];
}
function isRequestHandler(action) {
    return typeof action === 'function';
}
function normalizeAction(action) {
    if (isActionObject(action)) {
        return {
            handler: action.handler,
            middleware: normalizeMiddleware(action.middleware),
        };
    }
    if (!isRequestHandler(action)) {
        throw new TypeError('Expected a request handler function or action object with a function `handler` property');
    }
    return {
        handler: action,
        middleware: undefined,
    };
}
function mergeMiddleware(upstream, downstream) {
    let upstreamMiddleware = normalizeMiddleware(upstream);
    let downstreamMiddleware = normalizeMiddleware(downstream);
    if (!upstreamMiddleware) {
        return downstreamMiddleware;
    }
    if (!downstreamMiddleware) {
        return upstreamMiddleware;
    }
    return upstreamMiddleware.concat(downstreamMiddleware);
}
function createRequestContext(input, init) {
    let request;
    if (input instanceof Request) {
        request = cloneRequest(input);
        if (init != null)
            request = new Request(request, init);
    }
    else {
        request = new Request(input, init);
    }
    if (request.signal.aborted) {
        throw request.signal.reason;
    }
    return new RequestContext(request);
}
function cloneRequest(input) {
    // Cloudflare's generated Request type preserves worker metadata generics through clone().
    return input.clone();
}
function isSingleRouteTarget(target) {
    return typeof target === 'string' || target instanceof RoutePattern || target instanceof Route;
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
            if (match.data.method !== context.method && match.data.method !== 'ANY') {
                continue;
            }
            context.params = { ...context.params, ...match.params };
            if (match.data.middleware) {
                return runMiddleware(match.data.middleware, context, match.data.handler);
            }
            return raceRequestAbort(Promise.resolve(match.data.handler(context)), context.request);
        }
        return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request);
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
    function mapSingleRoute(target, handler) {
        registerRoute(getMappedRouteMethod(target), target, normalizeAction(handler));
    }
    function mapRoutes(target, handler) {
        if (isSingleRouteTarget(target)) {
            mapSingleRoute(target, handler);
            return;
        }
        if (!isController(handler)) {
            throw new TypeError('Expected a controller with an object `actions` property');
        }
        mapController(target, handler);
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
                let action = controller.actions[key];
                let normalizedAction = normalizeAction(action);
                registerRoute(route.method, route.pattern, {
                    handler: normalizedAction.handler,
                    middleware: mergeMiddleware(controllerMiddleware, normalizedAction.middleware),
                });
            }
        }
    }
    function createVerbMethod(method) {
        return ((route, handler) => {
            addRoute(method, route, handler);
        });
    }
    let router = {
        fetch(input, init) {
            let context = createRequestContext(input, init);
            context.router = router;
            return dispatchRouter(context);
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

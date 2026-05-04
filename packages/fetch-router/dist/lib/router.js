import { createMatcher, RoutePattern } from '@remix-run/route-pattern';
import { Route } from '@remix-run/routes';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isActionObject, isController, } from "./controller.js";
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
    function mapController(routes, controller) {
        let controllerMiddleware = controller.middleware
            ? controller.middleware.length > 0
                ? [...controller.middleware]
                : undefined
            : undefined;
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

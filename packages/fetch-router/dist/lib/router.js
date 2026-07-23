import { RoutePattern } from '@remix-run/route-pattern';
import { joinPatterns } from '@remix-run/route-pattern/join';
import { createMultiMatcher, } from '@remix-run/route-pattern/match';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext, } from "./request-context.js";
import { Route } from "./route-map.js";
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
function mergeMiddleware(upstream, downstream) {
    if (!upstream || upstream.length === 0) {
        return downstream;
    }
    if (!downstream || downstream.length === 0) {
        return upstream;
    }
    return upstream.concat(downstream);
}
function isRouteTarget(target) {
    return typeof target === 'string' || target instanceof Route || target instanceof RoutePattern;
}
function createRequestContext(input, init) {
    let request = input instanceof Request && init == null ? input : new Request(input, init);
    if (request.signal.aborted) {
        throw request.signal.reason;
    }
    return new RequestContext(request);
}
function getRoutePattern(target) {
    if (target instanceof Route) {
        return target.pattern;
    }
    if (typeof target === 'string') {
        return RoutePattern.parse(target);
    }
    return target;
}
function getMappedRouteMethod(target) {
    return target instanceof Route ? target.method : 'ANY';
}
function getPrefixedRoutePattern(target, state) {
    let pattern = getRoutePattern(target);
    return state.prefix ? joinPatterns(state.prefix, pattern) : pattern;
}
export function createRouter(...args) {
    let options = args[0];
    let defaultHandler = (options?.defaultHandler ?? noMatchHandler);
    let matcher = options?.matcher ?? createMultiMatcher();
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
    function registerRoute(method, route, action, state) {
        let pattern = getPrefixedRoutePattern(route, state);
        let entry = {
            pattern,
            handler: action.handler,
            method,
            middleware: action.middleware,
        };
        matcher.add(pattern, entry);
    }
    function addRoute(method, route, action, state) {
        registerRoute(method, route, normalizeAction(action), state);
    }
    function mapRoutes(target, handler, state) {
        if (isRouteTarget(target)) {
            mapSingleRoute(target, handler, state);
            return;
        }
        if (!isController(handler)) {
            throw new TypeError('Expected a controller with an object `actions` property');
        }
        mapController(target, handler, state);
    }
    function mapSingleRoute(target, handler, state) {
        registerRoute(getMappedRouteMethod(target), target, normalizeAction(handler), state);
    }
    function mapController(routes, controller, state) {
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
                registerRoute(route.method, route, {
                    handler: action.handler,
                    middleware: mergeMiddleware(controllerMiddleware, action.middleware),
                }, state);
            }
        }
    }
    function createRouteBuilder(state) {
        function createVerbMethod(method) {
            return (route, action) => {
                addRoute(method, route, action, state);
            };
        }
        return {
            route(method, route, action) {
                addRoute(method, route, action, state);
            },
            map(target, handler) {
                mapRoutes(target, handler, state);
            },
            mount(prefix, installer) {
                let mountPrefix = typeof prefix === 'string' ? RoutePattern.parse(prefix) : prefix;
                let childPrefix = state.prefix ? joinPatterns(state.prefix, mountPrefix) : mountPrefix;
                installer(createRouteBuilder({ prefix: childPrefix }));
            },
            get: createVerbMethod('GET'),
            head: createVerbMethod('HEAD'),
            post: createVerbMethod('POST'),
            put: createVerbMethod('PUT'),
            patch: createVerbMethod('PATCH'),
            delete: createVerbMethod('DELETE'),
            options: createVerbMethod('OPTIONS'),
        };
    }
    let rootBuilder = createRouteBuilder({ prefix: undefined });
    let router = {
        ...rootBuilder,
        fetch(input, init) {
            let context = createRequestContext(input, init);
            context.router = router;
            return dispatchRouter(context);
        },
    };
    return router;
}

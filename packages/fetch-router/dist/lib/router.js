import { ArrayMatcher, RoutePattern } from '@remix-run/route-pattern';
import { runMiddleware } from "./middleware.js";
import { raceRequestAbort } from "./request-abort.js";
import { RequestContext } from "./request-context.js";
import { isControllerWithMiddleware, isActionWithMiddleware, } from "./controller.js";
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
    function addRoute(method, route, action) {
        let middleware;
        let requestHandler;
        if (isActionWithMiddleware(action)) {
            middleware = action.middleware.length > 0 ? action.middleware : undefined;
            requestHandler = action.action;
        }
        else {
            requestHandler = action;
        }
        matcher.add(route instanceof Route ? route.pattern : route, {
            handler: requestHandler,
            method,
            middleware,
        });
    }
    function mapRoutes(target, handler) {
        // Single route: string, RoutePattern, or Route
        if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
            addRoute('ANY', target, handler);
            return;
        }
        // Route map
        if (isControllerWithMiddleware(handler)) {
            // map(routes, { middleware, actions })
            mapControllerWithMiddleware(target, handler.middleware, handler.actions);
        }
        else {
            // map(routes, controller)
            mapController(target, handler);
        }
    }
    function mapControllerWithMiddleware(routes, middleware, actions) {
        for (let key in routes) {
            let route = routes[key];
            let action = actions[key];
            if (route instanceof Route) {
                // Single route - check if action has its own middleware
                if (isActionWithMiddleware(action)) {
                    addRoute(route.method, route.pattern, {
                        middleware: middleware.concat(action.middleware),
                        action: action.action,
                    });
                }
                else {
                    addRoute(route.method, route.pattern, {
                        middleware,
                        action: action,
                    });
                }
            }
            else if (isControllerWithMiddleware(action)) {
                // Nested controller with its own middleware - merge and recurse
                mapControllerWithMiddleware(route, middleware.concat(action.middleware), action.actions);
            }
            else {
                // Nested controller without middleware - pass down current middleware
                mapControllerWithMiddleware(route, middleware, action);
            }
        }
    }
    function mapController(routes, controller) {
        for (let key in routes) {
            let route = routes[key];
            let action = controller[key];
            if (route instanceof Route) {
                addRoute(route.method, route.pattern, action);
            }
            else {
                mapRoutes(route, action);
            }
        }
    }
    return {
        fetch(input, init) {
            let context = createRequestContext(input, init);
            if (globalMiddleware) {
                return runMiddleware(globalMiddleware, context, dispatch);
            }
            return dispatch(context);
        },
        async run(input, initOrCallback, maybeCallback) {
            let init = typeof initOrCallback === 'function' ? undefined : initOrCallback;
            let callback = typeof initOrCallback === 'function' ? initOrCallback : maybeCallback;
            if (callback == null) {
                throw new TypeError('router.run() requires a callback function');
            }
            let context = createRequestContext(input, init);
            let callbackRan = false;
            let callbackThrew = false;
            let callbackError = undefined;
            let callbackResult = undefined;
            let runCallback = async () => {
                callbackRan = true;
                try {
                    callbackResult = await callback(context);
                }
                catch (error) {
                    callbackThrew = true;
                    callbackError = error;
                }
                return new Response(null, { status: 204 });
            };
            if (globalMiddleware) {
                await runMiddleware(globalMiddleware, context, runCallback);
            }
            else {
                await runCallback();
            }
            if (!callbackRan) {
                throw new Error('router.run() callback was not invoked. Ensure all middleware at this URL calls next() and does not return a Response directly.');
            }
            if (callbackThrew) {
                throw callbackError;
            }
            return callbackResult;
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
}

import { type Matcher, type Params, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type ApplyMiddlewareTuple, type Middleware, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { type ContextParams, RequestContext, type WithParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Action,
  type Controller,
  type ControllerInput,
  type ControllerShape,
  type ControllerWithMiddleware,
  type ControllerWithoutMiddleware,
  type RequestHandler,
  isActionObject,
  isController,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

type AnyMiddleware = Middleware<any, any, any>
type MiddlewareTuple = readonly AnyMiddleware[]
type AnyContext = RequestContext<any, any>

type RouteContext<context extends AnyContext, pattern extends string> = WithParams<
  context,
  Params<pattern>
>

type RouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method | 'ANY', pattern>

type MapRouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method, pattern>

type RouteActionObjectWithoutMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  context extends AnyContext,
> = {
  middleware?: undefined
  handler: RequestHandler<method, Params<pattern>, RouteContext<context, pattern>>
}

type RouteActionObjectWithMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  context extends AnyContext,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  handler: RequestHandler<
    method,
    Params<pattern>,
    ApplyMiddlewareTuple<RouteContext<context, pattern>, middleware>
  >
}

type RouteActionInput<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  context extends AnyContext,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | RequestHandler<method, Params<pattern>, RouteContext<context, pattern>>
  | RouteActionObjectWithoutMiddleware<method, pattern, context>
  | RouteActionObjectWithMiddleware<method, pattern, context, middleware>

type RouteMatchData = {
  pattern: RoutePattern<string>
  handler: RequestHandler<any, any, any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any, any, any>[] | undefined
}

/**
 * Normalized route match payload stored in the router matcher.
 */
export type MatchData = RouteMatchData

type RouterRuntime = {
  defaultHandler: RequestHandler<any, any, any>
  matcher: Matcher<MatchData>
  middleware: Middleware<any, any, any>[] | undefined
}

type NormalizedAction = {
  handler: RequestHandler<any, any, any>
  middleware: Middleware<any, any, any>[] | undefined
}

const routerRuntimeSymbol = Symbol('remix.fetch-router.runtime')


/**
 * The valid types for the first argument to `router.map()`.
 */
export type MapTarget =
  | string
  | RoutePattern<string>
  | Route<RequestMethod | 'ANY', string>
  | RouteMap

/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
// prettier-ignore
export type MapHandler<
  target extends MapTarget,
  context extends AnyContext = RequestContext,
> =
  target extends string ? Action<RequestMethod | 'ANY', target, context> :
  target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, context> :
  target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, context> :
  target extends RouteMap ? Controller<target, context> :
  never

/**
 * Options for creating a router.
 */
export interface RouterOptions<
  context extends AnyContext = RequestContext,
  global_middleware extends MiddlewareTuple = MiddlewareTuple,
> {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler<
    RequestMethod | 'ANY',
    ContextParams<ApplyMiddlewareTuple<context, global_middleware>>,
    ApplyMiddlewareTuple<context, global_middleware>
  >
  /**
   * The matcher to use for matching routes.
   *
   * @default `new ArrayMatcher()`
   */
  matcher?: Matcher<MatchData>
  /**
   * Middleware to run for every request handled by this router.
   */
  middleware?: readonly [...global_middleware]
}

/**
 * A router maps incoming requests to request handlers.
 */
export interface Router<context extends AnyContext = RequestContext> {
  /**
   * Fetch a response from the router.
   *
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The response from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
  /**
   * Add a route to the router.
   *
   * @param method The request method to match
   * @param pattern The pattern to match
   * @param action The action to invoke when the route matches
   */
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    handler: RequestHandler<method, Params<pattern>, RouteContext<context, pattern>>,
  ): void
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithoutMiddleware<method, pattern, context>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithMiddleware<method, pattern, context, middleware>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionInput<method, pattern, context, middleware>,
  ): void
  /**
   * Map a single route to an action.
   *
   * @param target The route/pattern to match
   * @param handler The action to invoke when the route matches
   */
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RequestHandler<method, Params<pattern>, RouteContext<context, pattern>>,
  ): void
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithoutMiddleware<method, pattern, context>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithMiddleware<method, pattern, context, middleware>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionInput<method, pattern, context, middleware>,
  ): void
  /**
   * Map a route map to a controller.
   *
   * @param target The route map to match
   * @param handler The controller to invoke when the route(s) match
   */
  map<target extends RouteMap>(
    target: target,
    handler: ControllerWithoutMiddleware<target, context>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple>(
    target: target,
    handler: ControllerWithMiddleware<target, context, middleware>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple = MiddlewareTuple>(
    target: target,
    handler: ControllerInput<target, context, middleware>,
  ): void
  /**
   * Map a `GET` route/pattern to an action.
   */
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RequestHandler<'GET', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithoutMiddleware<'GET', pattern, context>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithMiddleware<'GET', pattern, context, middleware>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionInput<'GET', pattern, context, middleware>,
  ): void
  /**
   * Map a `HEAD` route/pattern to an action.
   */
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RequestHandler<'HEAD', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithoutMiddleware<'HEAD', pattern, context>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithMiddleware<'HEAD', pattern, context, middleware>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionInput<'HEAD', pattern, context, middleware>,
  ): void
  /**
   * Map a `POST` route/pattern to an action.
   */
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RequestHandler<'POST', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithoutMiddleware<'POST', pattern, context>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithMiddleware<'POST', pattern, context, middleware>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionInput<'POST', pattern, context, middleware>,
  ): void
  /**
   * Map a `PUT` route/pattern to an action.
   */
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RequestHandler<'PUT', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PUT', pattern, context>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithMiddleware<'PUT', pattern, context, middleware>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionInput<'PUT', pattern, context, middleware>,
  ): void
  /**
   * Map a `PATCH` route/pattern to an action.
   */
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RequestHandler<'PATCH', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PATCH', pattern, context>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithMiddleware<'PATCH', pattern, context, middleware>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionInput<'PATCH', pattern, context, middleware>,
  ): void
  /**
   * Map a `DELETE` route/pattern to an action.
   */
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RequestHandler<'DELETE', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithoutMiddleware<'DELETE', pattern, context>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithMiddleware<'DELETE', pattern, context, middleware>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionInput<'DELETE', pattern, context, middleware>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to an action.
   */
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RequestHandler<'OPTIONS', Params<pattern>, RouteContext<context, pattern>>,
  ): void
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithoutMiddleware<'OPTIONS', pattern, context>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithMiddleware<'OPTIONS', pattern, context, middleware>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionInput<'OPTIONS', pattern, context, middleware>,
  ): void
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

function normalizeAction(action: unknown): NormalizedAction {
  if (isActionObject(action)) {
    return {
      handler: action.handler,
      middleware:
        action.middleware && action.middleware.length > 0 ? [...action.middleware] : undefined,
    }
  }

  return {
    handler: action as RequestHandler<any, any, any>,
    middleware: undefined,
  }
}

function mergeMiddleware(
  upstream: Middleware<any, any, any>[] | undefined,
  downstream: Middleware<any, any, any>[] | undefined,
): Middleware<any, any, any>[] | undefined {
  if (!upstream || upstream.length === 0) {
    return downstream
  }

  if (!downstream || downstream.length === 0) {
    return upstream
  }

  return upstream.concat(downstream)
}

function createRequestContext(input: string | URL | Request, init?: RequestInit): RequestContext {
  let request = new Request(input, init)

  if (request.signal.aborted) {
    throw request.signal.reason
  }

  return new RequestContext(request)
}

function getRoutePattern(target: string | RoutePattern<string> | Route<any, string>): RoutePattern<string> {
  if (target instanceof Route) {
    return target.pattern
  }

  return typeof target === 'string' ? new RoutePattern(target) : target
}

function getMappedRouteMethod(target: MapRouteTarget<any, any>): RequestMethod | 'ANY' {
  return target instanceof Route ? target.method : 'ANY'
}

/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export function createRouter<context extends AnyContext = RequestContext>(): Router<context>
export function createRouter<
  context extends AnyContext = RequestContext,
  const global_middleware extends MiddlewareTuple = MiddlewareTuple,
>(
  options: RouterOptions<context, global_middleware>,
): Router<ApplyMiddlewareTuple<context, global_middleware>>
export function createRouter<
  context extends AnyContext = RequestContext,
  const global_middleware extends MiddlewareTuple = MiddlewareTuple,
>(
  options?: RouterOptions<context, global_middleware>,
): Router<ApplyMiddlewareTuple<context, global_middleware>> {
  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, any, any>
  let matcher = options?.matcher ?? new ArrayMatcher<MatchData>()
  let middleware = options?.middleware ? [...options.middleware] : undefined

  async function dispatchRouter(runtime: RouterRuntime, context: RequestContext): Promise<Response> {
    let dispatch = () => dispatchMatches(runtime, context)

    if (runtime.middleware && runtime.middleware.length > 0) {
      return runMiddleware(runtime.middleware, context, dispatch)
    }

    return dispatch()
  }

  async function dispatchMatches(runtime: RouterRuntime, context: RequestContext): Promise<Response> {
    for (let match of runtime.matcher.matchAll(context.url)) {
      if (match.data.method !== context.method && match.data.method !== 'ANY') {
        continue
      }

      context.params = { ...context.params, ...match.params }

      if (match.data.middleware && match.data.middleware.length > 0) {
        return runMiddleware(match.data.middleware, context, match.data.handler)
      }

      return raceRequestAbort(Promise.resolve(match.data.handler(context)), context.request)
    }

    return raceRequestAbort(Promise.resolve(runtime.defaultHandler(context)), context.request)
  }

  function registerRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    action: NormalizedAction,
  ): void {
    let pattern = getRoutePattern(route)
    let entry: RouteMatchData = {
      pattern,
      handler: action.handler,
      method,
      middleware: action.middleware,
    }

    matcher.add(pattern, entry)
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    action: Action<method, pattern, ApplyMiddlewareTuple<context, global_middleware>>,
  ): void {
    registerRoute(method, route, normalizeAction(action))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute(
        getMappedRouteMethod(target as MapRouteTarget<any, any>) as any,
        target as any,
        handler as Action<any, any, ApplyMiddlewareTuple<context, global_middleware>>,
      )
      return
    }

    if (!isController(handler)) {
      throw new TypeError('Expected a controller with an `actions` property')
    }

    mapController(target, handler)
  }

  function mapController(
    routes: RouteMap,
    controller: ControllerShape,
    parentMiddleware: Middleware<any, any, any>[] = [],
  ): void {
    let controllerMiddleware = controller.middleware
      ? mergeMiddleware(parentMiddleware, controller.middleware)
      : parentMiddleware.length > 0
        ? parentMiddleware
        : undefined

    for (let key in routes) {
      let route = routes[key]
      let action = controller.actions[key]

      if (route instanceof Route) {
        let normalizedAction = normalizeAction(
          action as Action<any, any, ApplyMiddlewareTuple<context, global_middleware>>,
        )
        registerRoute(route.method, route.pattern, {
          handler: normalizedAction.handler,
          middleware: mergeMiddleware(controllerMiddleware, normalizedAction.middleware),
        })
      } else {
        if (!isController(action)) {
          throw new TypeError(
            `Expected a nested controller with an \`actions\` property at \`${key}\``,
          )
        }

        mapController(route as RouteMap, action, controllerMiddleware ?? [])
      }
    }
  }

  let runtime: RouterRuntime = {
    defaultHandler,
    matcher,
    middleware,
  }

  let router: Router<ApplyMiddlewareTuple<context, global_middleware>> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router
      return dispatchRouter(runtime, context)
    },
    route<
      method extends RequestMethod | 'ANY',
      pattern extends string,
      route_middleware extends MiddlewareTuple = MiddlewareTuple,
    >(
      method: method,
      route: RouteTarget<method, pattern>,
      action: RouteActionInput<
        method,
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        method,
        route,
        action as Action<method, pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    map: mapRoutes,
    get<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'GET', pattern>,
      action: RouteActionInput<
        'GET',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'GET',
        route,
        action as Action<'GET', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    head<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'HEAD', pattern>,
      action: RouteActionInput<
        'HEAD',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'HEAD',
        route,
        action as Action<'HEAD', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    post<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'POST', pattern>,
      action: RouteActionInput<
        'POST',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'POST',
        route,
        action as Action<'POST', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    put<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PUT', pattern>,
      action: RouteActionInput<
        'PUT',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'PUT',
        route,
        action as Action<'PUT', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    patch<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PATCH', pattern>,
      action: RouteActionInput<
        'PATCH',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'PATCH',
        route,
        action as Action<'PATCH', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    delete<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'DELETE', pattern>,
      action: RouteActionInput<
        'DELETE',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'DELETE',
        route,
        action as Action<'DELETE', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
    options<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'OPTIONS', pattern>,
      action: RouteActionInput<
        'OPTIONS',
        pattern,
        ApplyMiddlewareTuple<context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(
        'OPTIONS',
        route,
        action as Action<'OPTIONS', pattern, ApplyMiddlewareTuple<context, global_middleware>>,
      )
    },
  }

  Object.defineProperty(router, routerRuntimeSymbol, {
    value: runtime,
  })

  return router
}

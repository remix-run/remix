import { RoutePattern } from '@remix-run/route-pattern'
import {
  createMultiMatcher,
  type MatchParams,
  type MultiMatcher,
} from '@remix-run/route-pattern/match'

import { type AnyMiddleware, type MiddlewareContext, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { type ContextWithParams, RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import { type RouteMap, Route } from './route-map.ts'
import {
  type RequestHandler,
  type Action,
  type Controller,
  isRequestHandler,
  isActionObject,
  isController,
} from './controller.ts'

type AnyContext = RequestContext<any, any>

type RouteTarget<
  pattern extends string = string,
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
> = pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>

type RouteContext<context extends AnyContext, pattern extends string> = ContextWithParams<
  context,
  MatchParams<pattern>
>

type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
  <pattern extends string, actionContext extends AnyContext = context>(
    route: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext>,
  ): void
}

/**
 * The normalized route entry stored in the router matcher.
 */
export interface RouteEntry {
  /**
   * The URL pattern used to match this route.
   */
  pattern: RoutePattern<string>
  /**
   * The handler that runs when this route matches.
   */
  handler: RequestHandler<any>
  /**
   * The request method this route handles, or `ANY` for method-agnostic routes.
   */
  method: RequestMethod | 'ANY'
  /**
   * Route-specific middleware that runs before the handler.
   */
  middleware: AnyMiddleware[] | undefined
}

export type MatchData = RouteEntry

type NormalizedAction = {
  handler: RequestHandler<any>
  middleware: AnyMiddleware[] | undefined
}

/**
 * The valid types for the first argument to `router.map()`.
 */
export type MapTarget = RouteTarget | RouteMap

/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
// oxfmt-ignore
export type MapHandler<
  target extends MapTarget,
  context extends AnyContext = RequestContext,
> =
  target extends string ? Action<target, context> :
  target extends RoutePattern<infer pattern extends string> ? Action<RoutePattern<pattern>, context> :
  target extends Route<any, any> ? Action<target, context> :
  target extends RouteMap ? Controller<target, context> :
  never

/**
 * Options for creating a router.
 */
export interface RouterOptions<
  context extends AnyContext = RequestContext,
  middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
> {
  /**
   * The default request handler that runs when no route matches.
   * Defaults to a 404 `Not Found` response.
   */
  defaultHandler?: RequestHandler<MiddlewareContext<middleware, context>>
  /**
   * The matcher to use for matching routes.
   *
   * @default `createMultiMatcher()`
   */
  matcher?: MultiMatcher<MatchData>
  /**
   * Middleware to run for every request handled by this router.
   *
   * Keep this array tuple-typed when you want `MiddlewareContext<typeof middleware>` to preserve
   * the exact context contributions of each middleware.
   */
  middleware?: readonly [...middleware]
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
   * Registers a handler for a specific request method and route target.
   *
   * Accepts either a plain request handler or an action object with optional inline middleware.
   */
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    actionContext extends AnyContext = context,
  >(
    method: method,
    pattern: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext>,
  ): void
  /**
   * Maps either a single route target to an action or a route map to a controller.
   */
  map<pattern extends string, actionContext extends AnyContext = context>(
    target: RouteTarget<pattern>,
    action: Action<RouteTarget<pattern>, actionContext>,
  ): void
  map<target extends RouteMap, controllerContext extends AnyContext = context>(
    target: target,
    controller: Controller<target, controllerContext>,
  ): void
  /**
   * Shorthand for registering a `GET` route.
   */
  get: VerbMethod<'GET', context>
  /**
   * Shorthand for registering a `HEAD` route.
   */
  head: VerbMethod<'HEAD', context>
  /**
   * Shorthand for registering a `POST` route.
   */
  post: VerbMethod<'POST', context>
  /**
   * Shorthand for registering a `PUT` route.
   */
  put: VerbMethod<'PUT', context>
  /**
   * Shorthand for registering a `PATCH` route.
   */
  patch: VerbMethod<'PATCH', context>
  /**
   * Shorthand for registering a `DELETE` route.
   */
  delete: VerbMethod<'DELETE', context>
  /**
   * Shorthand for registering an `OPTIONS` route.
   */
  options: VerbMethod<'OPTIONS', context>
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

function normalizeMiddleware(
  middleware: readonly AnyMiddleware[] | undefined,
): AnyMiddleware[] | undefined {
  return middleware == null || middleware.length === 0 ? undefined : [...middleware]
}

function normalizeAction(action: unknown): NormalizedAction {
  if (isRequestHandler(action)) {
    return {
      handler: action,
      middleware: undefined,
    }
  }

  if (!isActionObject(action)) {
    throw new TypeError(
      'Expected a request handler function or action object with a function `handler` property',
    )
  }

  return {
    handler: action.handler,
    middleware: normalizeMiddleware(action.middleware),
  }
}

function mergeMiddleware(
  upstream: AnyMiddleware[] | undefined,
  downstream: AnyMiddleware[] | undefined,
): AnyMiddleware[] | undefined {
  if (!upstream || upstream.length === 0) {
    return downstream
  }

  if (!downstream || downstream.length === 0) {
    return upstream
  }

  return upstream.concat(downstream)
}

function isRouteTarget(target: MapTarget): target is RouteTarget {
  return typeof target === 'string' || target instanceof Route || target instanceof RoutePattern
}

function createRequestContext(input: string | URL | Request, init?: RequestInit): RequestContext {
  let request = input instanceof Request && init == null ? input : new Request(input, init)

  if (request.signal.aborted) {
    throw request.signal.reason
  }

  return new RequestContext(request)
}

function getRoutePattern(target: RouteTarget): RoutePattern {
  if (target instanceof Route) {
    return target.pattern
  }

  if (typeof target === 'string') {
    return RoutePattern.parse(target)
  }

  return target
}

function getMappedRouteMethod(target: RouteTarget): RequestMethod | 'ANY' {
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
  const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
>(options: RouterOptions<context, middleware>): Router<MiddlewareContext<middleware, context>>
export function createRouter<
  context extends AnyContext = RequestContext,
  const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
>(options?: RouterOptions<context, middleware>): Router<MiddlewareContext<middleware, context>> {
  type RouterContext = MiddlewareContext<middleware, context>

  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any>
  let matcher = options?.matcher ?? createMultiMatcher<MatchData>()
  let routerMiddleware = normalizeMiddleware(options?.middleware)

  async function dispatchRouter(context: RequestContext): Promise<Response> {
    let dispatch = () => dispatchMatches(context)

    if (routerMiddleware) {
      return runMiddleware(routerMiddleware, context, dispatch)
    }

    return dispatch()
  }

  async function dispatchMatches(context: RequestContext): Promise<Response> {
    for (let match of matcher.matchAll(context.url)) {
      let route = match.data

      if (route.method !== context.method && route.method !== 'ANY') {
        continue
      }

      context.params = { ...context.params, ...match.params }

      if (route.middleware) {
        return runMiddleware(route.middleware, context, route.handler)
      }

      return raceRequestAbort(Promise.resolve(route.handler(context)), context.request)
    }

    return raceRequestAbort(Promise.resolve(defaultHandler(context)), context.request)
  }

  function registerRoute(
    method: RequestMethod | 'ANY',
    route: RouteTarget,
    action: NormalizedAction,
  ): void {
    let pattern = getRoutePattern(route)
    let entry: RouteEntry = {
      pattern,
      handler: action.handler,
      method,
      middleware: action.middleware,
    }

    matcher.add(pattern, entry)
  }

  function addRoute<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    actionContext extends AnyContext,
  >(
    method: method,
    route: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext>,
  ): void {
    registerRoute(method, route, normalizeAction(action))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    if (isRouteTarget(target)) {
      mapSingleRoute(target, handler)
      return
    }

    if (!isController(handler)) {
      throw new TypeError('Expected a controller with an object `actions` property')
    }

    mapController(target, handler)
  }

  function mapSingleRoute(target: RouteTarget, handler: unknown): void {
    registerRoute(getMappedRouteMethod(target), target, normalizeAction(handler))
  }

  function mapController(
    routes: RouteMap,
    controller: {
      middleware?: readonly AnyMiddleware[] | undefined
      actions: Record<string, unknown>
    },
  ): void {
    let controllerMiddleware = normalizeMiddleware(controller.middleware)

    for (let key in controller.actions) {
      if (!(key in routes)) {
        throw new TypeError(`Unknown action \`${key}\` in controller`)
      }

      if (!(routes[key] instanceof Route)) {
        throw new TypeError(
          `Cannot map nested route map key \`${key}\` in controller actions; call router.map() for that route map separately`,
        )
      }
    }

    for (let key in routes) {
      let route = routes[key]

      if (route instanceof Route) {
        if (!Object.hasOwn(controller.actions, key)) {
          throw new TypeError(`Missing action \`${key}\` in controller`)
        }

        let action = normalizeAction(controller.actions[key])
        registerRoute(route.method, route, {
          handler: action.handler,
          middleware: mergeMiddleware(controllerMiddleware, action.middleware),
        })
      }
    }
  }

  function createVerbMethod<method extends RequestMethod>(
    method: method,
  ): VerbMethod<method, RouterContext> {
    return (<pattern extends string, actionContext extends AnyContext = RouterContext>(
      route: RouteTarget<pattern, method>,
      action: Action<RouteTarget<pattern, method>, actionContext>,
    ): void => {
      addRoute(method, route, action)
    }) as VerbMethod<method, RouterContext>
  }

  let router: Router<RouterContext> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router

      return dispatchRouter(context)
    },
    route<
      method extends RequestMethod | 'ANY',
      pattern extends string,
      actionContext extends AnyContext = RouterContext,
    >(
      method: method,
      route: RouteTarget<pattern, method>,
      action: Action<RouteTarget<pattern, method>, actionContext>,
    ): void {
      addRoute(method, route, action)
    },
    map: mapRoutes,
    get: createVerbMethod('GET'),
    head: createVerbMethod('HEAD'),
    post: createVerbMethod('POST'),
    put: createVerbMethod('PUT'),
    patch: createVerbMethod('PATCH'),
    delete: createVerbMethod('DELETE'),
    options: createVerbMethod('OPTIONS'),
  }

  return router
}

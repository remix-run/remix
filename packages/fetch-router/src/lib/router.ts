import { type Matcher, type Params, createMatcher, RoutePattern } from '@remix-run/route-pattern'
import { type RouteMap, Route } from '@remix-run/routes'

import { type AnyMiddleware, type MiddlewareContext, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { type ContextParams, RequestContext, type ContextWithParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Action,
  type Controller,
  type ControllerShape,
  type RequestHandler,
  isAction,
  isController,
} from './controller.ts'

type AnyContext = RequestContext<any, any>

type RouteContext<context extends AnyContext, pattern extends string> = ContextWithParams<
  context,
  Params<pattern>
>

type RouteTarget<
  pattern extends string = string,
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
> = pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>

type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
  <pattern extends string>(
    route: RouteTarget<pattern, method>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <pattern extends string, actionContext extends AnyContext = context>(
    route: RouteTarget<pattern, method>,
    action: Action<pattern, actionContext>,
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
  handler: RequestHandler<any, any>
  /**
   * The request method this route handles, or `ANY` for method-agnostic routes.
   */
  method: RequestMethod | 'ANY'
  /**
   * Route-specific middleware that runs before the handler.
   */
  middleware: AnyMiddleware[] | undefined
}

type NormalizedAction = {
  handler: RequestHandler<any, any>
  middleware: AnyMiddleware[] | undefined
}

type MapTarget = RouteTarget | RouteMap

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
  defaultHandler?: RequestHandler<
    ContextParams<MiddlewareContext<middleware, context>>,
    MiddlewareContext<middleware, context>
  >
  /**
   * The matcher to use for matching routes.
   * Defaults to `createMatcher()`.
   */
  matcher?: Matcher<RouteEntry>
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
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<pattern, method>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    actionContext extends AnyContext = context,
  >(
    method: method,
    pattern: RouteTarget<pattern, method>,
    action: Action<pattern, actionContext>,
  ): void
  /**
   * Maps either a single route target to an action or a route map to a controller.
   */
  map<pattern extends string>(
    target: RouteTarget<pattern>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  map<pattern extends string, actionContext extends AnyContext = context>(
    target: RouteTarget<pattern>,
    action: Action<pattern, actionContext>,
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
  if (middleware == null || middleware.length === 0) {
    return undefined
  }

  return [...middleware]
}

function isRequestHandler(action: unknown): action is RequestHandler<any, any> {
  return typeof action === 'function'
}

function normalizeAction(action: unknown): NormalizedAction {
  if (isAction(action)) {
    return {
      handler: action.handler,
      middleware: normalizeMiddleware(action.middleware),
    }
  }

  if (!isRequestHandler(action)) {
    throw new TypeError(
      'Expected a request handler function or action object with a function `handler` property',
    )
  }

  return {
    handler: action,
    middleware: undefined,
  }
}

function mergeMiddleware(
  upstream: AnyMiddleware[] | undefined,
  downstream: AnyMiddleware[] | undefined,
): AnyMiddleware[] | undefined {
  let upstreamMiddleware = normalizeMiddleware(upstream)
  let downstreamMiddleware = normalizeMiddleware(downstream)

  if (!upstreamMiddleware) {
    return downstreamMiddleware
  }

  if (!downstreamMiddleware) {
    return upstreamMiddleware
  }

  return upstreamMiddleware.concat(downstreamMiddleware)
}

function createRequestContext(input: string | URL | Request, init?: RequestInit): RequestContext {
  let request = input instanceof Request && init == null ? input : new Request(input, init)

  if (request.signal.aborted) {
    throw request.signal.reason
  }

  return new RequestContext(request)
}

function isRouteTarget(target: MapTarget): target is RouteTarget {
  return typeof target === 'string' || target instanceof RoutePattern || target instanceof Route
}

function getRoutePattern(target: RouteTarget): RoutePattern<string> {
  if (target instanceof Route) {
    return target.pattern
  }

  return typeof target === 'string' ? new RoutePattern(target) : target
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

  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, any>
  let matcher = options?.matcher ?? createMatcher<RouteEntry>()
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
    normalizedAction: NormalizedAction,
  ): void {
    let pattern = getRoutePattern(route)
    let entry: RouteEntry = {
      pattern,
      handler: normalizedAction.handler,
      method,
      middleware: normalizedAction.middleware,
    }

    matcher.add(pattern, entry)
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<pattern, method>,
    handler:
      | RequestHandler<Params<pattern>, RouteContext<RouterContext, pattern>>
      | Action<pattern, AnyContext>,
  ): void {
    registerRoute(method, route, normalizeAction(handler))
  }

  function mapSingleRoute(target: RouteTarget, handler: unknown): void {
    registerRoute(getMappedRouteMethod(target), target, normalizeAction(handler))
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

  function mapController(routes: RouteMap, controller: ControllerShape): void {
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

        let action = controller.actions[key]
        let normalizedAction = normalizeAction(action as Action<any, RouterContext>)
        registerRoute(route.method, route.pattern, {
          handler: normalizedAction.handler,
          middleware: mergeMiddleware(controllerMiddleware, normalizedAction.middleware),
        })
      }
    }
  }

  function createVerbMethod<method extends RequestMethod>(
    method: method,
  ): VerbMethod<method, RouterContext> {
    return (<pattern extends string>(
      route: RouteTarget<pattern, method>,
      handler:
        | RequestHandler<Params<pattern>, RouteContext<RouterContext, pattern>>
        | Action<pattern, AnyContext>,
    ): void => {
      addRoute(method, route, handler)
    }) as VerbMethod<method, RouterContext>
  }

  let router: Router<RouterContext> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router
      return dispatchRouter(context)
    },
    route<method extends RequestMethod | 'ANY', pattern extends string>(
      method: method,
      route: RouteTarget<pattern, method>,
      handler:
        | RequestHandler<Params<pattern>, RouteContext<RouterContext, pattern>>
        | Action<pattern, AnyContext>,
    ): void {
      addRoute(method, route, handler)
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

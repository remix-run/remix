import { RoutePattern } from '@remix-run/route-pattern'
import { joinPatterns } from '@remix-run/route-pattern/join'
import type { Match, MatchParams, MultiMatcher } from '@remix-run/route-pattern/match'
import * as Specificity from '@remix-run/route-pattern/specificity'

import { runMiddleware } from './middleware.ts'
import type { AnyMiddleware, MiddlewareContext } from './middleware.ts'
import { AbortRace, cancelAbandonedResponse, raceRequestAbort } from './request-abort.ts'
import { peekContextUrl, RequestContext } from './request-context.ts'
import type { ContextWithParams, requestContextTypes } from './request-context.ts'
import { RequestMethods } from './request-methods.ts'
import type { RequestMethod } from './request-methods.ts'
import { MATCH_HIT, MATCH_MISS, RouteMatcher } from './route-matcher.ts'
import { Route } from './route-map.ts'
import type { RouteMap } from './route-map.ts'
import { isRequestHandler, isActionObject, isController } from './controller.ts'
import type {
  RequestHandler,
  Action,
  Controller,
  ControllerActionMiddleware,
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

type ContextShape<context extends AnyContext> = Omit<context, 'router' | typeof requestContextTypes>

type ContextProvides<provided extends AnyContext, required extends AnyContext> =
  ContextShape<provided> extends ContextShape<required> ? true : false

type ContextCompatibility<
  providedContext extends AnyContext,
  requiredContext extends AnyContext,
  middleware extends readonly AnyMiddleware[],
> = [providedContext] extends [requiredContext]
  ? unknown
  : ContextProvides<providedContext, requiredContext> extends true
    ? unknown
    : ContextProvides<MiddlewareContext<middleware, providedContext>, requiredContext> extends true
      ? unknown
      : never

type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
  <
    pattern extends string,
    actionContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
  >(
    route: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext, middleware> &
      ContextCompatibility<context, actionContext, middleware>,
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
   * Action middleware that runs before the handler.
   */
  middleware: AnyMiddleware[] | undefined
}

export type MatchData = RouteEntry

type NormalizedAction = {
  handler: RequestHandler<any>
  middleware: AnyMiddleware[] | undefined
}

type MapTarget = RouteTarget | RouteMap

/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
// oxfmt-ignore
export type MapHandler<
  target extends MapTarget,
  context extends AnyContext = RequestContext,
  middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
  actionMiddleware = target extends RouteMap ? ControllerActionMiddleware<target> : never,
> =
  target extends string ? Action<target, context, middleware> :
  target extends RoutePattern<infer pattern extends string> ? Action<RoutePattern<pattern>, context, middleware> :
  target extends Route<any, any> ? Action<target, context, middleware> :
  target extends RouteMap ? Controller<target, context, middleware, actionMiddleware> :
  never

declare const routeBuilderContext: unique symbol

/**
 * A route builder registers routes into a router.
 *
 * Route builders are useful for composing route groups with {@link RouteInstaller}. Unlike a
 * {@link Router}, a route builder cannot dispatch requests.
 */
export interface RouteBuilder<context extends AnyContext = RequestContext> {
  readonly [routeBuilderContext]?: context
  /**
   * Registers a handler for a specific request method and route target.
   *
   * Accepts either a plain request handler or an action object with optional action middleware.
   */
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    actionContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
  >(
    method: method,
    pattern: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext, middleware> &
      ContextCompatibility<context, actionContext, middleware>,
  ): void
  /**
   * Maps either a single route target to an action or a route map to a controller.
   */
  map<
    target extends MapTarget,
    handlerContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
    const actionMiddleware = target extends RouteMap ? ControllerActionMiddleware<target> : never,
  >(
    target: target,
    handler: MapHandler<target, handlerContext, middleware, actionMiddleware> &
      ContextCompatibility<context, handlerContext, middleware>,
  ): void
  /**
   * Mounts a route installer at a route pattern prefix.
   */
  mount<pattern extends string>(
    prefix: pattern | RoutePattern<pattern>,
    installer: RouteInstaller<RouteContext<context, pattern>>,
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

/**
 * A function that registers a route group into a route builder.
 */
export interface RouteInstaller<context extends AnyContext = RequestContext> {
  (router: RouteBuilder<context>): void
}

/**
 * Extracts the request-context type handled by a router or route builder.
 *
 * This is useful when you want to configure `RouterTypes.context` from a router that uses inline
 * middleware arrays.
 */
export type RouterContext<router extends RouteBuilder<any>> =
  router extends RouteBuilder<infer context> ? context : never

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
   * Defaults to an internal matcher with `createMultiMatcher()` semantics.
   */
  matcher?: MultiMatcher<MatchData>
  /**
   * Middleware to run for every request handled by this router.
   *
   * Inline arrays are preferred. Use `createMiddleware()` only when a middleware chain is stored
   * before it is passed here and its exact tuple type must survive that boundary.
   */
  middleware?: readonly [...middleware]
}

/**
 * A router maps incoming requests to request handlers.
 */
export interface Router<context extends AnyContext = RequestContext> extends RouteBuilder<context> {
  /**
   * Fetch a response from the router.
   *
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The response from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

function noMethodMatchHandler(
  { method }: RequestContext,
  allowedMethods: RequestMethod[],
): Response {
  return new Response(`Method Not Allowed: ${method}`, {
    status: 405,
    headers: { Allow: allowedMethods.join(', ') },
  })
}

function headResponse(response: Response): Response {
  if (response.body === null) {
    return response
  }

  response.body.cancel().catch(() => {})

  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
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

type BuilderState = {
  prefix: RoutePattern<string> | undefined
}

function getPrefixedRoutePattern(target: RouteTarget, state: BuilderState): RoutePattern {
  let pattern = getRoutePattern(target)
  return state.prefix ? joinPatterns(state.prefix, pattern) : pattern
}

function assignMatchParams(context: RequestContext, params: Record<string, any> | undefined): void {
  if (params === undefined) return
  context.params =
    Reflect.ownKeys(context.params).length > 0 ? { ...context.params, ...params } : params
}

function createAllowedMethodsResponse(
  context: RequestContext,
  methods: Set<RequestMethod>,
): Response {
  // GET routes also serve HEAD requests, so advertise HEAD whenever GET is allowed
  let allow = RequestMethods.filter(
    (method) => methods.has(method) || (method === 'HEAD' && methods.has('GET')),
  )

  return noMethodMatchHandler(context, allow)
}

function finalizeDirectResult(
  result: Response | Promise<Response>,
  request: Request,
  headFallback: boolean,
  alreadyRaced: boolean,
): Promise<Response> {
  if (result instanceof Response) {
    if (request.signal.aborted) {
      cancelAbandonedResponse(result, request.signal.reason)
      return Promise.reject(request.signal.reason)
    }

    return Promise.resolve(headFallback ? headResponse(result) : result)
  }

  let promise = result instanceof Promise ? result : Promise.resolve(result)
  let raced = alreadyRaced ? promise : raceRequestAbort(promise, request)
  return headFallback ? raced.then(headResponse) : raced
}

/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export function createRouter<
  context extends AnyContext = RequestContext,
  const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
>(options?: RouterOptions<context, middleware>): Router<MiddlewareContext<middleware, context>> {
  type RouterContext = MiddlewareContext<middleware, context>

  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any>
  let customMatcher = options?.matcher
  let routeMatcher = customMatcher == null ? new RouteMatcher() : null
  let routerMiddleware = normalizeMiddleware(options?.middleware)

  function dispatchFromMatchAll(
    matches: ReadonlyArray<Match<string, MatchData>>,
    context: RequestContext,
    abortRace: AbortRace | undefined,
    onHeadFallback: () => void,
    onMiddlewareRan?: () => void,
  ): Response | Promise<Response> {
    // The most specific GET match that may serve a HEAD request when no HEAD (or ANY) route
    // matches with the same specificity
    let headFallback: Match<string, MatchData> | null = null
    let allowedMethods: Set<RequestMethod> | null = null

    for (let i = 0; i < matches.length; i++) {
      let match = matches[i]

      // Once a GET fallback is found, only an equally specific HEAD/ANY match may still win;
      // anything less specific means the fallback is the best match for this HEAD request
      if (headFallback !== null && !Specificity.equal(match, headFallback)) {
        break
      }

      let route = match.data

      if (route.method !== context.method && route.method !== 'ANY') {
        if (context.method === 'HEAD' && route.method === 'GET') {
          headFallback ??= match
        } else {
          allowedMethods ??= new Set()
          allowedMethods.add(route.method)
        }

        continue
      }

      return invokeRoute(route, match.params, context, abortRace, onMiddlewareRan)
    }

    if (headFallback !== null) {
      onHeadFallback()
      return invokeRoute(
        headFallback.data,
        headFallback.params,
        context,
        abortRace,
        onMiddlewareRan,
      )
    }

    if (allowedMethods !== null) {
      return createAllowedMethodsResponse(context, allowedMethods)
    }

    return defaultHandler(context)
  }

  function invokeRoute(
    route: RouteEntry,
    params: Record<string, any> | undefined,
    context: RequestContext,
    abortRace: AbortRace | undefined,
    onMiddlewareRan?: () => void,
  ): Response | Promise<Response> {
    assignMatchParams(context, params)

    if (route.middleware) {
      onMiddlewareRan?.()
      return runMiddleware(route.middleware, context, route.handler, abortRace)
    }

    return route.handler(context)
  }

  function dispatchMatched(
    context: RequestContext,
    initialUrl: string | undefined,
    abortRace: AbortRace | undefined,
    onHeadFallback: () => void,
  ): Response | Promise<Response> {
    if (routeMatcher !== null) {
      let contextUrl = peekContextUrl(context)
      let status = routeMatcher.match(context.method, initialUrl, contextUrl, context)

      if (status === MATCH_HIT) {
        let matched = routeMatcher.result
        let route = matched.entry!
        let params = matched.params
        if (matched.isHeadFallback) onHeadFallback()
        matched.entry = undefined
        matched.params = undefined
        return invokeRoute(route, params, context, abortRace)
      }

      if (status === MATCH_MISS) {
        let allowed = routeMatcher.findAllowedMethodsFast(context.method, initialUrl, contextUrl)
        if (allowed !== undefined) {
          return allowed !== null
            ? createAllowedMethodsResponse(context, allowed)
            : defaultHandler(context)
        }
      }

      return dispatchFromMatchAll(
        routeMatcher.matchAllFallback(context.url),
        context,
        abortRace,
        onHeadFallback,
      )
    }

    return dispatchFromMatchAll(
      customMatcher!.matchAll(context.url),
      context,
      abortRace,
      onHeadFallback,
    )
  }

  function dispatchDirect(context: RequestContext): Promise<Response> {
    let request = context.request
    // Only trust raw request.url as WHATWG-canonicalized for native Request instances
    let rawUrl = request.constructor === Request ? request.url : undefined

    try {
      // With no router middleware, context.url, context.method, and context.params cannot have
      // been modified yet, so raw request.url and direct param assignment are safe.
      if (routeMatcher !== null) {
        let status = routeMatcher.match(context.method, rawUrl, undefined, context)

        if (status === MATCH_HIT) {
          let matched = routeMatcher.result
          let route = matched.entry!
          let params = matched.params
          let isHeadFallback = matched.isHeadFallback
          matched.entry = undefined
          matched.params = undefined

          if (params !== undefined) {
            context.params = params
          }

          if (route.middleware === undefined) {
            return finalizeDirectResult(route.handler(context), request, isHeadFallback, false)
          }

          return finalizeDirectResult(
            runMiddleware(route.middleware, context, route.handler),
            request,
            isHeadFallback,
            true,
          )
        }

        if (status === MATCH_MISS) {
          let allowed = routeMatcher.findAllowedMethodsFast(context.method, rawUrl, undefined)
          if (allowed !== undefined) {
            let response =
              allowed !== null
                ? createAllowedMethodsResponse(context, allowed)
                : defaultHandler(context)
            return finalizeDirectResult(response, request, false, false)
          }
        }

        let headFallback = false
        let alreadyRaced = false
        let response = dispatchFromMatchAll(
          routeMatcher.matchAllFallback(context.url),
          context,
          undefined,
          () => {
            headFallback = true
          },
          () => {
            alreadyRaced = true
          },
        )
        return finalizeDirectResult(response, request, headFallback, alreadyRaced)
      }

      let headFallback = false
      let alreadyRaced = false
      let response = dispatchFromMatchAll(
        customMatcher!.matchAll(context.url),
        context,
        undefined,
        () => {
          headFallback = true
        },
        () => {
          alreadyRaced = true
        },
      )
      return finalizeDirectResult(response, request, headFallback, alreadyRaced)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  function dispatchWithRouterMiddleware(
    context: RequestContext,
    middleware: AnyMiddleware[],
  ): Promise<Response> {
    let request = context.request
    // Snapshot raw URL before router middleware so replacing context.request preserves initial URL semantics
    let initialUrl = request.constructor === Request ? request.url : undefined
    let abortRace = new AbortRace(request)
    let headFallback = false
    let markHeadFallback = () => {
      headFallback = true
    }

    let promise = runMiddleware(
      middleware,
      context,
      (ctx) => dispatchMatched(ctx, initialUrl, abortRace, markHeadFallback),
      abortRace,
    )

    // Strip the body after router middleware so it sees the same response as for GET
    return promise.then(
      (response) => {
        abortRace.dispose()
        return headFallback ? headResponse(response) : response
      },
      (error) => {
        abortRace.dispose()
        throw error
      },
    )
  }

  function registerRoute(
    method: RequestMethod | 'ANY',
    route: RouteTarget,
    action: NormalizedAction,
    state: BuilderState,
  ): void {
    let pattern = getPrefixedRoutePattern(route, state)
    let entry: RouteEntry = {
      pattern,
      handler: action.handler,
      method,
      middleware: action.middleware,
    }

    if (routeMatcher !== null) {
      let rawSource = typeof route === 'string' && state.prefix === undefined ? route : undefined
      routeMatcher.add(entry, rawSource)
    } else {
      customMatcher!.add(pattern, entry)
    }
  }

  function addRoute(
    method: RequestMethod | 'ANY',
    route: RouteTarget,
    action: unknown,
    state: BuilderState,
  ): void {
    registerRoute(method, route, normalizeAction(action), state)
  }

  function mapRoutes(target: MapTarget, handler: unknown, state: BuilderState): void {
    if (isRouteTarget(target)) {
      mapSingleRoute(target, handler, state)
      return
    }

    if (!isController(handler)) {
      throw new TypeError('Expected a controller with an object `actions` property')
    }

    mapController(target, handler, state)
  }

  function mapSingleRoute(target: RouteTarget, handler: unknown, state: BuilderState): void {
    registerRoute(getMappedRouteMethod(target), target, normalizeAction(handler), state)
  }

  function mapController(
    routes: RouteMap,
    controller: {
      middleware?: readonly AnyMiddleware[] | undefined
      actions: Record<string, unknown>
    },
    state: BuilderState,
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
        registerRoute(
          route.method,
          route,
          {
            handler: action.handler,
            middleware: mergeMiddleware(controllerMiddleware, action.middleware),
          },
          state,
        )
      }
    }
  }

  function createRouteBuilder<builderContext extends AnyContext>(
    state: BuilderState,
  ): RouteBuilder<builderContext> {
    function createVerbMethod<method extends RequestMethod>(method: method) {
      return <
        pattern extends string,
        actionContext extends AnyContext = builderContext,
        const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
      >(
        route: RouteTarget<pattern, method>,
        action: Action<RouteTarget<pattern, method>, actionContext, middleware> &
          ContextCompatibility<builderContext, actionContext, middleware>,
      ): void => {
        addRoute(method, route, action, state)
      }
    }

    return {
      route<
        method extends RequestMethod | 'ANY',
        pattern extends string,
        actionContext extends AnyContext = builderContext,
        const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
      >(
        method: method,
        route: RouteTarget<pattern, method>,
        action: Action<RouteTarget<pattern, method>, actionContext, middleware> &
          ContextCompatibility<builderContext, actionContext, middleware>,
      ): void {
        addRoute(method, route, action, state)
      },
      map(target: MapTarget, handler: unknown): void {
        mapRoutes(target, handler, state)
      },
      mount<pattern extends string>(
        prefix: pattern | RoutePattern<pattern>,
        installer: RouteInstaller<RouteContext<builderContext, pattern>>,
      ): void {
        let mountPrefix = typeof prefix === 'string' ? RoutePattern.parse(prefix) : prefix
        let childPrefix = state.prefix ? joinPatterns(state.prefix, mountPrefix) : mountPrefix
        installer(
          createRouteBuilder<RouteContext<builderContext, pattern>>({ prefix: childPrefix }),
        )
      },
      get: createVerbMethod('GET'),
      head: createVerbMethod('HEAD'),
      post: createVerbMethod('POST'),
      put: createVerbMethod('PUT'),
      patch: createVerbMethod('PATCH'),
      delete: createVerbMethod('DELETE'),
      options: createVerbMethod('OPTIONS'),
    }
  }

  let rootBuilder = createRouteBuilder<RouterContext>({ prefix: undefined })

  let router: Router<RouterContext> = {
    ...rootBuilder,
    // Rest tuple keeps router.fetch.length === 1 for single-argument FetchHandler adapters
    fetch(input: string | URL | Request, ...args: [init?: RequestInit]): Promise<Response> {
      let context: RequestContext
      try {
        let [init] = args
        context = createRequestContext(input, init)
      } catch (error) {
        return Promise.reject(error)
      }
      context.router = router

      return routerMiddleware === undefined
        ? dispatchDirect(context)
        : dispatchWithRouterMiddleware(context, routerMiddleware)
    },
  }

  return router
}

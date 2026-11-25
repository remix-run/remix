import { RoutePattern } from '@remix-run/route-pattern'
import { joinPatterns } from '@remix-run/route-pattern/join'
import { createMultiMatcher } from '@remix-run/route-pattern/match'
import type { Match, MatchParams, MultiMatcher } from '@remix-run/route-pattern/match'
import * as Specificity from '@remix-run/route-pattern/specificity'

import { runMiddleware } from './middleware.ts'
import type { AnyMiddleware, MiddlewareContext } from './middleware.ts'
import { getRejectionReason, throwIfRequestAborted } from './request-abort.ts'
import { getMatchUrl, mergeRouteParams, RequestContext } from './request-context.ts'
import type { ContextWithParams, requestContextTypes } from './request-context.ts'
import { RequestMethods } from './request-methods.ts'
import type { RequestMethod } from './request-methods.ts'
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
   * @default `createMultiMatcher()`
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
  throwIfRequestAborted(request.signal)
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

// Extracts the raw pathname from a canonical http(s) URL string without allocating a URL object.
// Unnormalized inputs (percent-encoding, dot-segments, fragments) will not match any key in the
// static map and fall back to full `route-pattern` matching.
function extractSimplePathname(url: string): string | null {
  let schemeEnd: number
  if (url.startsWith('https://')) {
    schemeEnd = 8
  } else if (url.startsWith('http://')) {
    schemeEnd = 7
  } else {
    return null
  }

  let pathStart = url.indexOf('/', schemeEnd)
  if (pathStart === -1) return null

  let queryIndex = url.indexOf('?', schemeEnd)
  if (queryIndex !== -1) {
    if (queryIndex < pathStart) return null
    return url.slice(pathStart, queryIndex)
  }

  return url.slice(pathStart)
}

// Returns the exact static pathname (with leading `/`) for a plain static route, `null` for a
// dynamic pathname route that cannot outrank or tie a static route, or `false` when the pattern
// has origin, search, optional, escape, or percent-encoded constraints that disable the static map.
function classifyStaticRoute(pattern: RoutePattern): string | null | false {
  let parts = pattern.toJSON()
  if (parts.protocol !== '' || parts.hostname !== '' || parts.port !== '' || parts.search !== '') {
    return false
  }

  let pathname = parts.pathname
  for (let i = 0; i < pathname.length; i++) {
    let c = pathname.charCodeAt(i)
    if (c === 40 || c === 41 || c === 92 || c === 37 || c === 35 || c === 63) {
      return false
    }
  }

  if (pathname.indexOf(':') !== -1 || pathname.indexOf('*') !== -1) {
    return null
  }

  // Keep dot-segment paths out of the static map so raw unnormalized dot-segment URLs can never hit
  if (pathname.startsWith('.') || pathname.indexOf('/.') !== -1) {
    return null
  }

  return '/' + pathname
}

type ResolvedRoute =
  | { kind: 'route'; route: RouteEntry; params: Record<string, any>; headFallback: boolean }
  | { kind: 'response'; response: Response | Promise<Response> }

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
): Promise<Response> {
  if (result instanceof Response) {
    throwIfRequestAborted(request.signal, result)
    return Promise.resolve(headFallback ? headResponse(result) : result)
  }

  let promise = result instanceof Promise ? result : Promise.resolve(result)
  return promise.then(
    (response) => {
      throwIfRequestAborted(request.signal, response)
      return headFallback ? headResponse(response) : response
    },
    (error) => {
      throw getRejectionReason(request.signal, error)
    },
  )
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
  let routerMiddleware = normalizeMiddleware(options?.middleware)

  // Default per-method route matchers backed directly by route-pattern
  let byMethod: Record<string, MultiMatcher<MatchData>> = Object.create(null)
  let registeredMethods: RequestMethod[] = []
  let anyMatcher: MultiMatcher<MatchData> | null = null
  let anyEntries: RouteEntry[] = []
  let allEntries: RouteEntry[] = []
  let allMatcher: MultiMatcher<MatchData> | null = null
  let hasExplicitHead = false

  // Exact static pathname fast path used when no origin/search/optional patterns are registered
  let canUseStaticMap = true
  let staticByMethod: Record<string, Map<string, RouteEntry>> = Object.create(null)
  let anyStaticEntries: Array<[string, RouteEntry]> = []
  let anyStaticMap: Map<string, RouteEntry> | null = null

  function getAllMatcher(): MultiMatcher<MatchData> {
    if (allMatcher === null) {
      let matcher = createMultiMatcher<MatchData>()
      for (let i = 0; i < allEntries.length; i++) {
        let entry = allEntries[i]
        matcher.add(entry.pattern, entry)
      }
      allMatcher = matcher
    }
    return allMatcher
  }

  function resolveFromMatchAll(
    matches: ReadonlyArray<Match<string, MatchData>>,
    context: RequestContext,
  ): ResolvedRoute {
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

      return { kind: 'route', route, params: match.params, headFallback: false }
    }

    if (headFallback !== null) {
      return {
        kind: 'route',
        route: headFallback.data,
        params: headFallback.params,
        headFallback: true,
      }
    }

    if (allowedMethods !== null) {
      return { kind: 'response', response: createAllowedMethodsResponse(context, allowedMethods) }
    }

    return { kind: 'response', response: defaultHandler(context) }
  }

  function matchStaticRoute(context: RequestContext): RouteEntry | undefined {
    if (!canUseStaticMap || customMatcher != null) return undefined

    let method = context.method
    if (method === 'HEAD' && (hasExplicitHead || anyMatcher !== null)) return undefined

    let staticMap =
      staticByMethod[method] ??
      (method === 'HEAD' ? staticByMethod['GET'] : undefined) ??
      anyStaticMap
    if (staticMap === undefined || staticMap === null) return undefined

    let rawUrl = getMatchUrl(context)
    let pathname: string | null
    if (typeof rawUrl === 'string') {
      pathname = extractSimplePathname(rawUrl)
    } else if (
      (rawUrl.protocol === 'https:' || rawUrl.protocol === 'http:') &&
      rawUrl.pathname.indexOf('%') === -1
    ) {
      pathname = rawUrl.pathname
    } else {
      return undefined
    }

    return pathname !== null ? staticMap.get(pathname) : undefined
  }

  function resolveRoute(context: RequestContext): ResolvedRoute {
    let url = context.url

    if (customMatcher != null) {
      return resolveFromMatchAll(customMatcher.matchAll(url), context)
    }

    let method = context.method

    // Explicit HEAD or ANY routes can tie with GET routes on specificity; use full matchAll()
    if (method === 'HEAD' && (hasExplicitHead || anyMatcher !== null)) {
      return resolveFromMatchAll(getAllMatcher().matchAll(url), context)
    }

    let methodMatcher =
      byMethod[method] ?? (method === 'HEAD' ? byMethod['GET'] : undefined) ?? anyMatcher

    if (methodMatcher != null) {
      let match = methodMatcher.match(url)
      if (match !== null) {
        return {
          kind: 'route',
          route: match.data,
          params: match.params,
          headFallback: method === 'HEAD' && match.data.method === 'GET',
        }
      }
    }

    // Method missed; check other registered methods to synthesize 405 Method Not Allowed
    let allowedMethods: Set<RequestMethod> | null = null
    for (let i = 0; i < registeredMethods.length; i++) {
      let otherMethod = registeredMethods[i]
      if (otherMethod === method) continue
      if (method === 'HEAD' && otherMethod === 'GET') continue
      if (byMethod[otherMethod].match(url) !== null) {
        allowedMethods ??= new Set()
        allowedMethods.add(otherMethod)
      }
    }

    if (allowedMethods !== null) {
      return { kind: 'response', response: createAllowedMethodsResponse(context, allowedMethods) }
    }

    return { kind: 'response', response: defaultHandler(context) }
  }

  function dispatchDirect(context: RequestContext): Promise<Response> {
    try {
      let staticRoute = matchStaticRoute(context)
      if (staticRoute !== undefined) {
        let headFallback = context.method === 'HEAD' && staticRoute.method === 'GET'
        if (staticRoute.middleware) {
          let response = runMiddleware(staticRoute.middleware, context, staticRoute.handler)
          return headFallback ? response.then(headResponse) : response
        }

        return finalizeDirectResult(staticRoute.handler(context), context.request, headFallback)
      }

      let resolved = resolveRoute(context)
      if (resolved.kind === 'response') {
        return finalizeDirectResult(resolved.response, context.request, false)
      }

      let route = resolved.route
      context.params = resolved.params

      if (route.middleware) {
        let response = runMiddleware(route.middleware, context, route.handler)
        return resolved.headFallback ? response.then(headResponse) : response
      }

      return finalizeDirectResult(route.handler(context), context.request, resolved.headFallback)
    } catch (error) {
      return Promise.reject(getRejectionReason(context.request.signal, error))
    }
  }

  function dispatchWithRouterMiddleware(
    context: RequestContext,
    middleware: AnyMiddleware[],
  ): Promise<Response> {
    let headFallback = false
    let routeResolved = false

    let promise = runMiddleware(middleware, context, (ctx) => {
      routeResolved = true
      let staticRoute = matchStaticRoute(ctx)
      if (staticRoute !== undefined) {
        headFallback = ctx.method === 'HEAD' && staticRoute.method === 'GET'
        return staticRoute.middleware
          ? runMiddleware(staticRoute.middleware, ctx, staticRoute.handler)
          : staticRoute.handler(ctx)
      }

      let resolved = resolveRoute(ctx)
      if (resolved.kind === 'response') {
        return resolved.response
      }

      headFallback = resolved.headFallback
      mergeRouteParams(ctx, resolved.params)
      return resolved.route.middleware
        ? runMiddleware(resolved.route.middleware, ctx, resolved.route.handler)
        : resolved.route.handler(ctx)
    })

    // Strip the body after router middleware so it sees the same response as for GET.
    // When the route already resolved synchronously, `headFallback` is already known.
    if (routeResolved) {
      return headFallback ? promise.then(headResponse) : promise
    }

    return promise.then((response) => (headFallback ? headResponse(response) : response))
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

    if (customMatcher != null) {
      customMatcher.add(pattern, entry)
      return
    }

    allEntries.push(entry)
    allMatcher = null

    let staticPath = canUseStaticMap ? classifyStaticRoute(pattern) : null
    if (staticPath === false) {
      canUseStaticMap = false
    }

    if (method === 'ANY') {
      anyEntries.push(entry)
      anyMatcher ??= createMultiMatcher<MatchData>()
      anyMatcher.add(pattern, entry)
      for (let i = 0; i < registeredMethods.length; i++) {
        byMethod[registeredMethods[i]].add(pattern, entry)
      }
      if (canUseStaticMap && typeof staticPath === 'string') {
        anyStaticEntries.push([staticPath, entry])
        anyStaticMap ??= new Map()
        if (!anyStaticMap.has(staticPath)) {
          anyStaticMap.set(staticPath, entry)
        }
        for (let i = 0; i < registeredMethods.length; i++) {
          let m = registeredMethods[i]
          let sMap = (staticByMethod[m] ??= new Map())
          if (!sMap.has(staticPath)) {
            sMap.set(staticPath, entry)
          }
        }
      }
      return
    }

    if (method === 'HEAD') {
      hasExplicitHead = true
    }

    let matcher = byMethod[method]
    if (matcher === undefined) {
      matcher = createMultiMatcher<MatchData>()
      for (let i = 0; i < anyEntries.length; i++) {
        let anyEntry = anyEntries[i]
        matcher.add(anyEntry.pattern, anyEntry)
      }
      byMethod[method] = matcher
      registeredMethods.push(method)

      if (canUseStaticMap && anyStaticEntries.length > 0) {
        let sMap = new Map<string, RouteEntry>()
        for (let i = 0; i < anyStaticEntries.length; i++) {
          let [anyPath, anyEntry] = anyStaticEntries[i]
          if (!sMap.has(anyPath)) {
            sMap.set(anyPath, anyEntry)
          }
        }
        staticByMethod[method] = sMap
      }
    }

    matcher.add(pattern, entry)

    if (canUseStaticMap && typeof staticPath === 'string') {
      let sMap = (staticByMethod[method] ??= new Map())
      if (!sMap.has(staticPath)) {
        sMap.set(staticPath, entry)
      }
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
    // Default parameter keeps router.fetch.length === 1 for single-argument FetchHandler adapters
    fetch(
      input: string | URL | Request,
      init: RequestInit | undefined = undefined,
    ): Promise<Response> {
      let context: RequestContext
      try {
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

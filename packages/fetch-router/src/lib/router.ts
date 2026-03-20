import { type Matcher, type Params, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import {
  type ApplyMiddlewareTuple,
  type Middleware,
  type MiddlewareContext,
  runMiddleware,
} from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import {
  type ContextParams,
  RequestContext,
  type WithContextParams,
} from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Controller,
  type ControllerInput,
  type ControllerShape,
  type ControllerWithMiddleware,
  type ControllerWithoutMiddleware,
  type Action,
  type RequestHandler,
  isController,
  isActionObject,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

type AnyMiddleware = Middleware<any, any, any>
type MiddlewareTuple = readonly AnyMiddleware[]
type AnyContext = RequestContext<any, any>

type RouteContext<
  current_context extends AnyContext,
  pattern extends string,
> = WithContextParams<current_context, Params<pattern>>

type RouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method | 'ANY', pattern>

type MapRouteTarget<method extends RequestMethod | 'ANY', pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<method, pattern>

type MountTarget<pattern extends string> =
  | pattern
  | RoutePattern<pattern>
  | Route<'ANY', pattern>

type RouteActionObjectWithoutMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  current_context extends AnyContext,
> = {
  middleware?: undefined
  action: RequestHandler<method, Params<pattern>, RouteContext<current_context, pattern>>
}

type RouteActionObjectWithMiddleware<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  current_context extends AnyContext,
  middleware extends MiddlewareTuple,
> = {
  middleware: readonly [...middleware]
  action: RequestHandler<
    method,
    Params<pattern>,
    ApplyMiddlewareTuple<RouteContext<current_context, pattern>, middleware>
  >
}

type RouteActionInput<
  method extends RequestMethod | 'ANY',
  pattern extends string,
  current_context extends AnyContext,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> =
  | RequestHandler<method, Params<pattern>, RouteContext<current_context, pattern>>
  | RouteActionObjectWithoutMiddleware<method, pattern, current_context>
  | RouteActionObjectWithMiddleware<method, pattern, current_context, middleware>

type CompatibleMountedRouter<provided_context extends AnyContext, child> =
  child extends Router<
    infer child_current_context extends AnyContext,
    infer child_incoming_context extends AnyContext
  >
    ? provided_context extends child_incoming_context
      ? Router<child_current_context, child_incoming_context>
      : never
    : never

type RouteMatchData = {
  kind: 'route'
  pattern: RoutePattern<string>
  handler: RequestHandler<any, any, any>
  method: RequestMethod | 'ANY'
  middleware: Middleware<any, any, any>[] | undefined
}

type MountMatchData = {
  kind: 'mount'
  pattern: RoutePattern<string>
  target: RoutePattern<string>
  router: unknown
}

/**
 * Normalized route match payload stored in the router matcher.
 */
export type MatchData = RouteMatchData | MountMatchData

type InternalMountMatchData = Omit<MountMatchData, 'router'> & {
  router: RouterRuntime
}

type InternalMatchData = RouteMatchData | InternalMountMatchData

type RouterRuntime = {
  defaultHandler: RequestHandler<any, any, any>
  matcher: Matcher<MatchData>
  matcherFactory: () => Matcher<MatchData>
  middleware: Middleware<any, any, any>[] | undefined
  entries: InternalMatchData[]
}

type NormalizedAction = {
  handler: RequestHandler<any, any, any>
  middleware: Middleware<any, any, any>[] | undefined
}

const routerRuntimeSymbol = Symbol('remix.fetch-router.runtime')

type RouterWithRuntime = {
  [routerRuntimeSymbol]: RouterRuntime
}

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
  current_context extends AnyContext = RequestContext,
> =
  target extends string ? Action<RequestMethod | 'ANY', target, current_context> :
  target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, current_context> :
  target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, current_context> :
  target extends RouteMap ? Controller<target, current_context> :
  never

/**
 * Options for creating a router.
 */
export interface RouterOptions<
  incoming_context extends AnyContext = RequestContext,
  global_middleware extends MiddlewareTuple = MiddlewareTuple,
> {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler<
    RequestMethod | 'ANY',
    ContextParams<ApplyMiddlewareTuple<incoming_context, global_middleware>>,
    ApplyMiddlewareTuple<incoming_context, global_middleware>
  >
  /**
   * The matcher to use for matching routes.
   *
   * @default `new ArrayMatcher()`
   */
  matcher?: Matcher<MatchData>
  /**
   * Middleware to run for every request that enters this router scope.
   */
  middleware?: readonly [...global_middleware]
}

export interface RouterScopeOptions<
  incoming_context extends AnyContext = RequestContext,
  middleware extends MiddlewareTuple = MiddlewareTuple,
> {
  /**
   * Middleware to run for every request that enters this scope.
   */
  middleware?: readonly [...middleware]
}

/**
 * A router maps incoming requests to request handlers and mounted child routers.
 */
export interface Router<
  current_context extends AnyContext = RequestContext,
  incoming_context extends AnyContext = RequestContext,
> {
  /**
   * Fetch a response from the router.
   *
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The response from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
  /**
   * Mount a callback-defined child router under the given pathname pattern.
   */
  mount<pattern extends string>(
    target: MountTarget<pattern>,
    child: (
      router: Router<RouteContext<current_context, pattern>, RouteContext<current_context, pattern>>,
    ) => void,
  ): void
  /**
   * Mount an existing child router under the given pathname pattern.
   */
  mount<pattern extends string, child extends Router<any, any>>(
    target: MountTarget<pattern>,
    child: CompatibleMountedRouter<RouteContext<current_context, pattern>, child>,
  ): void
  /**
   * Define a subtree scope that shares this router's pathname prefix.
   */
  scope(child: (router: Router<current_context, current_context>) => void): void
  /**
   * Define a subtree scope with router-scoped middleware.
   */
  scope<scope_middleware extends MiddlewareTuple>(
    options: RouterScopeOptions<current_context, scope_middleware>,
    child: (
      router: Router<ApplyMiddlewareTuple<current_context, scope_middleware>, current_context>,
    ) => void,
  ): void
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
    action: RequestHandler<method, Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  route<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithoutMiddleware<method, pattern, current_context>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionObjectWithMiddleware<method, pattern, current_context, middleware>,
  ): void
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: RouteActionInput<method, pattern, current_context, middleware>,
  ): void
  /**
   * Map a single route to an action.
   *
   * @param target The route/pattern to match
   * @param handler The action to invoke when the route matches
   */
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RequestHandler<method, Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  map<method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithoutMiddleware<method, pattern, current_context>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionObjectWithMiddleware<method, pattern, current_context, middleware>,
  ): void
  map<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends MiddlewareTuple = MiddlewareTuple,
  >(
    target: MapRouteTarget<method, pattern>,
    handler: RouteActionInput<method, pattern, current_context, middleware>,
  ): void
  /**
   * Map a route map to a controller.
   *
   * @param target The route map to match
   * @param handler The controller to invoke when the route(s) match
   */
  map<target extends RouteMap>(
    target: target,
    handler: ControllerWithoutMiddleware<target, current_context>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple>(
    target: target,
    handler: ControllerWithMiddleware<target, current_context, middleware>,
  ): void
  map<target extends RouteMap, middleware extends MiddlewareTuple = MiddlewareTuple>(
    target: target,
    handler: ControllerInput<target, current_context, middleware>,
  ): void
  /**
   * Map a `GET` route/pattern to an action.
   */
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RequestHandler<'GET', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  get<pattern extends string>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithoutMiddleware<'GET', pattern, current_context>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionObjectWithMiddleware<'GET', pattern, current_context, middleware>,
  ): void
  get<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'GET', pattern>,
    action: RouteActionInput<'GET', pattern, current_context, middleware>,
  ): void
  /**
   * Map a `HEAD` route/pattern to an action.
   */
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RequestHandler<'HEAD', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  head<pattern extends string>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithoutMiddleware<'HEAD', pattern, current_context>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionObjectWithMiddleware<'HEAD', pattern, current_context, middleware>,
  ): void
  head<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'HEAD', pattern>,
    action: RouteActionInput<'HEAD', pattern, current_context, middleware>,
  ): void
  /**
   * Map a `POST` route/pattern to an action.
   */
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RequestHandler<'POST', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  post<pattern extends string>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithoutMiddleware<'POST', pattern, current_context>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionObjectWithMiddleware<'POST', pattern, current_context, middleware>,
  ): void
  post<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'POST', pattern>,
    action: RouteActionInput<'POST', pattern, current_context, middleware>,
  ): void
  /**
   * Map a `PUT` route/pattern to an action.
   */
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RequestHandler<'PUT', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  put<pattern extends string>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PUT', pattern, current_context>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionObjectWithMiddleware<'PUT', pattern, current_context, middleware>,
  ): void
  put<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PUT', pattern>,
    action: RouteActionInput<'PUT', pattern, current_context, middleware>,
  ): void
  /**
   * Map a `PATCH` route/pattern to an action.
   */
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RequestHandler<'PATCH', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  patch<pattern extends string>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithoutMiddleware<'PATCH', pattern, current_context>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionObjectWithMiddleware<'PATCH', pattern, current_context, middleware>,
  ): void
  patch<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'PATCH', pattern>,
    action: RouteActionInput<'PATCH', pattern, current_context, middleware>,
  ): void
  /**
   * Map a `DELETE` route/pattern to an action.
   */
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RequestHandler<'DELETE', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  delete<pattern extends string>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithoutMiddleware<'DELETE', pattern, current_context>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionObjectWithMiddleware<'DELETE', pattern, current_context, middleware>,
  ): void
  delete<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'DELETE', pattern>,
    action: RouteActionInput<'DELETE', pattern, current_context, middleware>,
  ): void
  /**
   * Map an `OPTIONS` route/pattern to an action.
   */
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RequestHandler<'OPTIONS', Params<pattern>, RouteContext<current_context, pattern>>,
  ): void
  options<pattern extends string>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithoutMiddleware<'OPTIONS', pattern, current_context>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionObjectWithMiddleware<'OPTIONS', pattern, current_context, middleware>,
  ): void
  options<pattern extends string, middleware extends MiddlewareTuple = MiddlewareTuple>(
    route: RouteTarget<'OPTIONS', pattern>,
    action: RouteActionInput<'OPTIONS', pattern, current_context, middleware>,
  ): void
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

function hasRuntime(value: unknown): value is RouterWithRuntime {
  return typeof value === 'object' && value != null && routerRuntimeSymbol in value
}

function getRuntime(router: Router<any, any>): RouterRuntime {
  if (!hasRuntime(router)) {
    throw new TypeError('Expected a router created by createRouter()')
  }

  return router[routerRuntimeSymbol]
}

function createMatcherFactory(matcher?: Matcher<MatchData>): () => Matcher<MatchData> {
  if (matcher == null) {
    return () => new ArrayMatcher<MatchData>()
  }

  return () => cloneMatcher(matcher)
}

function cloneMatcher(source: Matcher<MatchData>): Matcher<MatchData> {
  let constructor = (source as unknown as { constructor?: new (...args: any[]) => Matcher<MatchData> }).constructor
  if (constructor) {
    try {
      return new constructor({ ignoreCase: source.ignoreCase })
    } catch {
      try {
        return new constructor()
      } catch {
        // Fall through to the default matcher.
      }
    }
  }

  return new ArrayMatcher<MatchData>({ ignoreCase: source.ignoreCase })
}

function normalizeAction(action: unknown): NormalizedAction {
  if (isActionObject(action)) {
    return {
      handler: action.action,
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

function getMountTargetPattern(target: MountTarget<string>): RoutePattern<string> {
  let pattern = getRoutePattern(target)

  if (pattern.protocol !== '' || pattern.hostname !== '' || pattern.port !== '' || pattern.search !== '') {
    throw new Error('Mount targets must be pathname-only patterns')
  }

  return pattern
}

function createMountPattern(target: RoutePattern<string>): RoutePattern<string> {
  let pathname = target.pathname.replace(/\/*$/, '')
  let source = pathname === '' ? '/(/*)' : `/${pathname}(/*)`
  return new RoutePattern(source)
}

function getPatternParamNames(pattern: RoutePattern<string>): Set<string> {
  let names = new Set<string>()

  for (let param of pattern.ast.hostname?.params ?? []) {
    if (param.name !== '*') {
      names.add(param.name)
    }
  }

  for (let param of pattern.ast.pathname.params) {
    if (param.name !== '*') {
      names.add(param.name)
    }
  }

  return names
}

function findDuplicateParamNames(left: Set<string>, right: Set<string>): string[] {
  let duplicates: string[] = []

  for (let name of right) {
    if (left.has(name)) {
      duplicates.push(name)
    }
  }

  return duplicates
}

function assertNoDuplicateDescendantParams(inheritedNames: Set<string>, router: RouterRuntime): void {
  for (let entry of router.entries) {
    let pattern = entry.kind === 'mount' ? entry.target : entry.pattern
    let entryNames = getPatternParamNames(pattern)
    let duplicates = findDuplicateParamNames(inheritedNames, entryNames)

    if (duplicates.length > 0) {
      throw new Error(`Duplicate route params across mounted routers: ${duplicates.join(', ')}`)
    }

    if (entry.kind === 'mount') {
      assertNoDuplicateDescendantParams(new Set([...inheritedNames, ...entryNames]), entry.router)
    }
  }
}

function snapshotRouter(router: RouterRuntime): RouterRuntime {
  let matcher = router.matcherFactory()
  let entries = router.entries.map((entry): InternalMatchData => {
    if (entry.kind === 'route') {
      let routeEntry: RouteMatchData = {
        ...entry,
        middleware: entry.middleware ? [...entry.middleware] : undefined,
      }
      matcher.add(routeEntry.pattern, routeEntry)
      return routeEntry
    }

    let mountEntry: InternalMountMatchData = {
      ...entry,
      router: snapshotRouter(entry.router),
    }
    matcher.add(mountEntry.pattern, mountEntry)
    return mountEntry
  })

  return {
    defaultHandler: router.defaultHandler,
    matcher,
    matcherFactory: router.matcherFactory,
    middleware: router.middleware ? [...router.middleware] : undefined,
    entries,
  }
}

function flattenScopedRuntime(
  runtime: RouterRuntime,
  inheritedMiddleware: Middleware<any, any, any>[] | undefined = undefined,
): RouterRuntime {
  let scopeMiddleware = mergeMiddleware(inheritedMiddleware, runtime.middleware)
  let matcher = runtime.matcherFactory()
  let entries = runtime.entries.map((entry): InternalMatchData => {
    if (entry.kind === 'route') {
      let routeEntry: RouteMatchData = {
        ...entry,
        middleware: mergeMiddleware(scopeMiddleware, entry.middleware),
      }
      matcher.add(routeEntry.pattern, routeEntry)
      return routeEntry
    }

    let mountEntry: InternalMountMatchData = {
      ...entry,
      router: flattenScopedRuntime(entry.router, scopeMiddleware),
    }
    matcher.add(mountEntry.pattern, mountEntry)
    return mountEntry
  })

  return {
    defaultHandler: runtime.defaultHandler,
    matcher,
    matcherFactory: runtime.matcherFactory,
    middleware: undefined,
    entries,
  }
}

async function withScopedContext(
  context: RequestContext,
  url: URL,
  params: Record<string, any>,
  handler: () => Promise<Response>,
): Promise<Response> {
  let previousUrl = context.url
  let previousParams = context.params

  context.url = url
  context.params = params

  try {
    return await handler()
  } finally {
    context.url = previousUrl
    context.params = previousParams
  }
}

function createMountedUrl(
  url: URL,
  pathnameMatch: Array<{ type: ':' | '*'; name: string; value: string }>,
): URL {
  let childUrl = new URL(url)
  let wildcard = pathnameMatch.find(param => param.type === '*' && param.name === '*')
  let pathname = wildcard?.value.replace(/^\/*/, '') ?? ''
  childUrl.pathname = pathname === '' ? '/' : `/${pathname}`
  return childUrl
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
export function createRouter<incoming_context extends AnyContext = RequestContext>(): Router<
  incoming_context,
  incoming_context
>
export function createRouter<
  incoming_context extends AnyContext = RequestContext,
  const global_middleware extends MiddlewareTuple = MiddlewareTuple,
>(
  options: RouterOptions<incoming_context, global_middleware>,
): Router<ApplyMiddlewareTuple<incoming_context, global_middleware>, incoming_context>
export function createRouter<
  incoming_context extends AnyContext = RequestContext,
  const global_middleware extends MiddlewareTuple = MiddlewareTuple,
>(
  options?: RouterOptions<incoming_context, global_middleware>,
): Router<ApplyMiddlewareTuple<incoming_context, global_middleware>, incoming_context> {
  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, any, any>
  let matcher = options?.matcher ?? new ArrayMatcher<MatchData>()
  let matcherFactory = createMatcherFactory(options?.matcher)
  let middleware = options?.middleware ? [...options.middleware] : undefined
  let entries: InternalMatchData[] = []

  async function dispatchRouter(runtime: RouterRuntime, context: RequestContext): Promise<Response> {
    let dispatch = () => dispatchMatches(runtime, context)

    if (runtime.middleware && runtime.middleware.length > 0) {
      return runMiddleware(runtime.middleware, context, dispatch)
    }

    return dispatch()
  }

  async function dispatchMatches(runtime: RouterRuntime, context: RequestContext): Promise<Response> {
    for (let match of runtime.matcher.matchAll(context.url)) {
      if (match.data.kind === 'route') {
        if (match.data.method !== context.method && match.data.method !== 'ANY') {
          continue
        }

        context.params = { ...context.params, ...match.params }

        if (match.data.middleware && match.data.middleware.length > 0) {
          return runMiddleware(match.data.middleware, context, match.data.handler)
        }

        return raceRequestAbort(Promise.resolve(match.data.handler(context)), context.request)
      }

      let childRouter = match.data.router as RouterRuntime
      let childUrl = createMountedUrl(context.url, match.paramsMeta.pathname)
      let childParams = { ...context.params, ...match.params }

      return withScopedContext(context, childUrl, childParams, () => dispatchRouter(childRouter, context))
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
      kind: 'route',
      pattern,
      handler: action.handler,
      method,
      middleware: action.middleware,
    }

    entries.push(entry)
    matcher.add(pattern, entry)
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    action: Action<method, pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>,
  ): void {
    registerRoute(method, route, normalizeAction(action))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute(
        getMappedRouteMethod(target as MapRouteTarget<any, any>) as any,
        target as any,
        handler as Action<any, any, ApplyMiddlewareTuple<incoming_context, global_middleware>>,
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
          action as Action<any, any, ApplyMiddlewareTuple<incoming_context, global_middleware>>,
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
    matcherFactory,
    middleware,
    entries,
  }

  let router: Router<ApplyMiddlewareTuple<incoming_context, global_middleware>, incoming_context> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router
      return dispatchRouter(runtime, context)
    },
    mount<pattern extends string>(
      target: MountTarget<pattern>,
      child:
        | ((
            router: Router<
              RouteContext<ApplyMiddlewareTuple<incoming_context, global_middleware>, pattern>,
              RouteContext<ApplyMiddlewareTuple<incoming_context, global_middleware>, pattern>
            >,
          ) => void)
        | Router<any, any>,
    ): void {
      let targetPattern = getMountTargetPattern(target)
      let childRouter: Router<any, any>

      if (typeof child === 'function') {
        childRouter = createRouter<
          RouteContext<ApplyMiddlewareTuple<incoming_context, global_middleware>, pattern>
        >()
        child(childRouter as Router<
          RouteContext<ApplyMiddlewareTuple<incoming_context, global_middleware>, pattern>,
          RouteContext<ApplyMiddlewareTuple<incoming_context, global_middleware>, pattern>
        >)
      } else {
        childRouter = child
      }

      let childRuntime = snapshotRouter(getRuntime(childRouter))
      assertNoDuplicateDescendantParams(getPatternParamNames(targetPattern), childRuntime)

      let entry: InternalMountMatchData = {
        kind: 'mount',
        target: targetPattern,
        pattern: createMountPattern(targetPattern),
        router: childRuntime,
      }

      entries.push(entry)
      matcher.add(entry.pattern, entry)
    },
    scope<const scope_middleware extends MiddlewareTuple = MiddlewareTuple>(
      optionsOrChild:
        | RouterScopeOptions<ApplyMiddlewareTuple<incoming_context, global_middleware>, scope_middleware>
        | ((
            router: Router<
              ApplyMiddlewareTuple<incoming_context, global_middleware>,
              ApplyMiddlewareTuple<incoming_context, global_middleware>
            >,
          ) => void),
      maybeChild?: (
        router: Router<
          ApplyMiddlewareTuple<
            ApplyMiddlewareTuple<incoming_context, global_middleware>,
            scope_middleware
          >,
          ApplyMiddlewareTuple<incoming_context, global_middleware>
        >,
      ) => void,
    ): void {
      let options: RouterScopeOptions<
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        scope_middleware
      >
      let child: (
        router: Router<
          ApplyMiddlewareTuple<
            ApplyMiddlewareTuple<incoming_context, global_middleware>,
            scope_middleware
          >,
          ApplyMiddlewareTuple<incoming_context, global_middleware>
        >,
      ) => void

      if (typeof optionsOrChild === 'function') {
        options = {}
        child = optionsOrChild as typeof child
      } else {
        options = optionsOrChild
        if (maybeChild == null) {
          throw new TypeError('Expected a scope callback')
        }

        child = maybeChild
      }

      let childRouter = createRouter<
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        scope_middleware
      >({
        middleware: options.middleware,
      })

      child(childRouter as Router<
        ApplyMiddlewareTuple<
          ApplyMiddlewareTuple<incoming_context, global_middleware>,
          scope_middleware
        >,
        ApplyMiddlewareTuple<incoming_context, global_middleware>
      >)

      let scopedRuntime = flattenScopedRuntime(snapshotRouter(getRuntime(childRouter)))
      for (let entry of scopedRuntime.entries) {
        entries.push(entry)
        matcher.add(entry.pattern, entry)
      }
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
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute(method, route, action as Action<method, pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    map: mapRoutes,
    get<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'GET', pattern>,
      action: RouteActionInput<
        'GET',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('GET', route, action as Action<'GET', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    head<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'HEAD', pattern>,
      action: RouteActionInput<
        'HEAD',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('HEAD', route, action as Action<'HEAD', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    post<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'POST', pattern>,
      action: RouteActionInput<
        'POST',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('POST', route, action as Action<'POST', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    put<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PUT', pattern>,
      action: RouteActionInput<
        'PUT',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('PUT', route, action as Action<'PUT', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    patch<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'PATCH', pattern>,
      action: RouteActionInput<
        'PATCH',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('PATCH', route, action as Action<'PATCH', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    delete<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'DELETE', pattern>,
      action: RouteActionInput<
        'DELETE',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('DELETE', route, action as Action<'DELETE', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
    options<pattern extends string, route_middleware extends MiddlewareTuple = MiddlewareTuple>(
      route: RouteTarget<'OPTIONS', pattern>,
      action: RouteActionInput<
        'OPTIONS',
        pattern,
        ApplyMiddlewareTuple<incoming_context, global_middleware>,
        route_middleware
      >,
    ): void {
      addRoute('OPTIONS', route, action as Action<'OPTIONS', pattern, ApplyMiddlewareTuple<incoming_context, global_middleware>>)
    },
  }

  Object.defineProperty(router, routerRuntimeSymbol, {
    value: runtime,
  })

  return router
}

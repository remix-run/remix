import { type Matcher, type Params, ArrayMatcher, RoutePattern } from '@remix-run/route-pattern'

import { type AnyMiddleware, type ApplyMiddlewareTuple, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import { type ContextParams, RequestContext, type WithParams } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import {
  type Action,
  type ActionInput,
  type ActionObjectWithMiddleware,
  type ActionObjectWithoutMiddleware,
  type Controller,
  type ControllerShape,
  type ControllerWithMiddleware,
  type ControllerWithoutMiddleware,
  type RequestHandler,
  isActionObject,
  isController,
} from './controller.ts'
import { type RouteMap, Route } from './route-map.ts'

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

type RouteMethod<context extends AnyContext> = {
  <method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends readonly AnyMiddleware[],
  >(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>,
  ): void
  <method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    pattern: RouteTarget<method, pattern>,
    action: Action<method, pattern, context>,
  ): void
}

type ActionMapping<context extends AnyContext> = {
  <method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <
    method extends RequestMethod | 'ANY',
    pattern extends string,
    middleware extends readonly AnyMiddleware[],
  >(
    target: MapRouteTarget<method, pattern>,
    action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>,
  ): void
  <method extends RequestMethod | 'ANY', pattern extends string>(
    target: MapRouteTarget<method, pattern>,
    action: Action<method, pattern, context>,
  ): void
}

type ControllerMapping<context extends AnyContext> = {
  <target extends RouteMap>(
    target: target,
    controller: ControllerWithoutMiddleware<target, context>,
  ): void
  <target extends RouteMap, middleware extends readonly AnyMiddleware[]>(
    target: target,
    controller: ControllerWithMiddleware<target, context, middleware>,
  ): void
  <target extends RouteMap>(target: target, controller: Controller<target, context>): void
}

type MapMethod<context extends AnyContext> = ActionMapping<context> & ControllerMapping<context>

type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
  <pattern extends string>(
    route: RouteTarget<method, pattern>,
    handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <pattern extends string>(
    route: RouteTarget<method, pattern>,
    action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>,
  ): void
  <pattern extends string, middleware extends readonly AnyMiddleware[]>(
    route: RouteTarget<method, pattern>,
    action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>,
  ): void
  <pattern extends string>(
    route: RouteTarget<method, pattern>,
    action: Action<method, pattern, context>,
  ): void
}

type RouteMatchData = {
  pattern: RoutePattern<string>
  handler: RequestHandler<any, any>
  method: RequestMethod | 'ANY'
  middleware: AnyMiddleware[] | undefined
}

/**
 * The normalized route-match payload stored in the router matcher.
 */
export type MatchData = RouteMatchData

type RouterRuntime = {
  defaultHandler: RequestHandler<any, any>
  matcher: Matcher<MatchData>
  middleware: AnyMiddleware[] | undefined
}

type NormalizedAction = {
  handler: RequestHandler<any, any>
  middleware: AnyMiddleware[] | undefined
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
  middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
> {
  /**
   * The default request handler that runs when no route matches.
   *
   * @default A 404 "Not Found" response
   */
  defaultHandler?: RequestHandler<
    ContextParams<ApplyMiddlewareTuple<context, middleware>>,
    ApplyMiddlewareTuple<context, middleware>
  >
  /**
   * The matcher to use for matching routes.
   *
   * @default `new ArrayMatcher()`
   */
  matcher?: Matcher<MatchData>
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
  route: RouteMethod<context>
  /**
   * Maps either a single route target to an action or a route map to a controller.
   */
  map: MapMethod<context>
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

function normalizeAction(action: unknown): NormalizedAction {
  if (isActionObject(action)) {
    return {
      handler: action.handler,
      middleware:
        action.middleware && action.middleware.length > 0 ? [...action.middleware] : undefined,
    }
  }

  return {
    handler: action as RequestHandler<any, any>,
    middleware: undefined,
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

function createRequestContext(input: string | URL | Request, init?: RequestInit): RequestContext {
  let request = new Request(input, init)

  if (request.signal.aborted) {
    throw request.signal.reason
  }

  return new RequestContext(request)
}

function getRoutePattern(
  target: string | RoutePattern<string> | Route<any, string>,
): RoutePattern<string> {
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
  const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
>(options: RouterOptions<context, middleware>): Router<ApplyMiddlewareTuple<context, middleware>>
export function createRouter<
  context extends AnyContext = RequestContext,
  const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
>(options?: RouterOptions<context, middleware>): Router<ApplyMiddlewareTuple<context, middleware>> {
  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, any>
  let matcher = options?.matcher ?? new ArrayMatcher<MatchData>()
  let routerMiddleware = options?.middleware ? [...options.middleware] : undefined

  async function dispatchRouter(
    runtime: RouterRuntime,
    context: RequestContext,
  ): Promise<Response> {
    let dispatch = () => dispatchMatches(runtime, context)

    if (runtime.middleware && runtime.middleware.length > 0) {
      return runMiddleware(runtime.middleware, context, dispatch)
    }

    return dispatch()
  }

  async function dispatchMatches(
    runtime: RouterRuntime,
    context: RequestContext,
  ): Promise<Response> {
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
    normalizedAction: NormalizedAction,
  ): void {
    let pattern = getRoutePattern(route)
    let entry: RouteMatchData = {
      pattern,
      handler: normalizedAction.handler,
      method,
      middleware: normalizedAction.middleware,
    }

    matcher.add(pattern, entry)
  }

  function addRoute<method extends RequestMethod | 'ANY', pattern extends string>(
    method: method,
    route: RouteTarget<method, pattern>,
    handler: Action<method, pattern, ApplyMiddlewareTuple<context, middleware>>,
  ): void {
    registerRoute(method, route, normalizeAction(handler))
  }

  function mapRoutes(target: MapTarget, handler: unknown): void {
    if (typeof target === 'string' || target instanceof RoutePattern || target instanceof Route) {
      addRoute(
        getMappedRouteMethod(target as MapRouteTarget<any, any>) as any,
        target as any,
        handler as Action<any, any, ApplyMiddlewareTuple<context, middleware>>,
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
    parentMiddleware: AnyMiddleware[] = [],
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
          action as Action<any, any, ApplyMiddlewareTuple<context, middleware>>,
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

  type RouterContext = ApplyMiddlewareTuple<context, middleware>

  function createVerbMethod<method extends RequestMethod>(
    method: method,
  ): VerbMethod<method, RouterContext> {
    return (<
      pattern extends string,
      actionMiddleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
    >(
      route: RouteTarget<method, pattern>,
      handler: ActionInput<Params<pattern>, RouteContext<RouterContext, pattern>, actionMiddleware>,
    ): void => {
      addRoute(method, route, handler as Action<method, pattern, RouterContext>)
    }) as VerbMethod<method, RouterContext>
  }

  let runtime: RouterRuntime = {
    defaultHandler,
    matcher,
    middleware: routerMiddleware,
  }

  let router: Router<RouterContext> = {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      let context = createRequestContext(input, init)
      context.router = router
      return dispatchRouter(runtime, context)
    },
    route<
      method extends RequestMethod | 'ANY',
      pattern extends string,
      actionMiddleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[],
    >(
      method: method,
      route: RouteTarget<method, pattern>,
      handler: ActionInput<Params<pattern>, RouteContext<RouterContext, pattern>, actionMiddleware>,
    ): void {
      addRoute(method, route, handler as Action<method, pattern, RouterContext>)
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

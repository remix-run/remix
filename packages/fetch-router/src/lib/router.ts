import { RoutePattern } from '@remix-run/route-pattern'
import { joinPatterns } from '@remix-run/route-pattern/join'
import {
  createMultiMatcher,
  type MatchParams,
  type MultiMatcher,
} from '@remix-run/route-pattern/match'

import { type AnyMiddleware, type MiddlewareContext, runMiddleware } from './middleware.ts'
import { raceRequestAbort } from './request-abort.ts'
import {
  type ContextWithOutput,
  type ContextWithParams,
  RequestContext,
  type requestContextTypes,
} from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import { type RouteMap, Route } from './route-map.ts'
import type { DefaultOutput } from './router-types.ts'
import type { Defined } from './type-utils.ts'
import {
  type RequestHandler,
  type Action,
  type Controller,
  isRequestHandler,
  isActionObject,
  isController,
} from './controller.ts'

type AnyContext = RequestContext<any, any, any>

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
  middleware extends readonly AnyMiddleware<any>[],
> = [providedContext] extends [requiredContext]
  ? unknown
  : ContextProvides<providedContext, requiredContext> extends true
    ? unknown
    : ContextProvides<MiddlewareContext<middleware, providedContext>, requiredContext> extends true
      ? unknown
      : never

type VerbMethod<method extends RequestMethod, context extends AnyContext, output> = {
  <
    pattern extends string,
    actionContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
  >(
    route: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> &
      ContextCompatibility<context, actionContext, middleware>,
  ): void
}

/**
 * The normalized route entry stored in the router matcher.
 */
export interface RouteEntry<output = DefaultOutput> {
  /**
   * The URL pattern used to match this route.
   */
  pattern: RoutePattern<string>
  /**
   * The handler that runs when this route matches.
   */
  handler: RequestHandler<any, output>
  /**
   * The request method this route handles, or `ANY` for method-agnostic routes.
   */
  method: RequestMethod | 'ANY'
  /**
   * Action middleware that runs before the handler.
   */
  middleware: AnyMiddleware<output>[] | undefined
}

export type MatchData<output = DefaultOutput> = RouteEntry<output>

type NormalizedAction<output> = {
  handler: RequestHandler<any, output>
  middleware: AnyMiddleware<output>[] | undefined
}

type MapTarget = RouteTarget | RouteMap

/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
// oxfmt-ignore
export type MapHandler<
  target extends MapTarget,
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
  middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
> =
  target extends string ? Action<target, context, middleware, output> :
  target extends RoutePattern<infer pattern extends string> ? Action<RoutePattern<pattern>, context, middleware, output> :
  target extends Route<any, any> ? Action<target, context, middleware, output> :
  target extends RouteMap ? Controller<target, context, middleware, output> :
  never

declare const routeBuilderContext: unique symbol
declare const routeBuilderOutput: unique symbol

/**
 * A route builder registers routes into a router.
 *
 * Route builders are useful for composing route groups with {@link RouteInstaller}. Unlike a
 * {@link Router}, a route builder cannot dispatch requests.
 */
export interface RouteBuilder<context extends AnyContext = RequestContext, output = DefaultOutput> {
  readonly [routeBuilderContext]?: context
  readonly [routeBuilderOutput]?: output
  /**
   * Registers a handler for a specific request method and route target.
   *
   * Accepts either a plain request handler or an action object with optional action middleware.
   */
  route<
    method extends RequestMethod | 'ANY',
    pattern extends string,
    actionContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
  >(
    method: method,
    pattern: RouteTarget<pattern, method>,
    action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> &
      ContextCompatibility<context, actionContext, middleware>,
  ): void
  /**
   * Maps either a single route target to an action or a route map to a controller.
   */
  map<
    target extends MapTarget,
    handlerContext extends AnyContext = context,
    const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
  >(
    target: target,
    handler: MapHandler<target, handlerContext, output, middleware> &
      ContextCompatibility<context, handlerContext, middleware>,
  ): void
  /**
   * Mounts a route installer at a route pattern prefix.
   */
  mount<pattern extends string>(
    prefix: pattern | RoutePattern<pattern>,
    installer: RouteInstaller<RouteContext<context, pattern>, output>,
  ): void
  /**
   * Shorthand for registering a `GET` route.
   */
  get: VerbMethod<'GET', context, output>
  /**
   * Shorthand for registering a `HEAD` route.
   */
  head: VerbMethod<'HEAD', context, output>
  /**
   * Shorthand for registering a `POST` route.
   */
  post: VerbMethod<'POST', context, output>
  /**
   * Shorthand for registering a `PUT` route.
   */
  put: VerbMethod<'PUT', context, output>
  /**
   * Shorthand for registering a `PATCH` route.
   */
  patch: VerbMethod<'PATCH', context, output>
  /**
   * Shorthand for registering a `DELETE` route.
   */
  delete: VerbMethod<'DELETE', context, output>
  /**
   * Shorthand for registering an `OPTIONS` route.
   */
  options: VerbMethod<'OPTIONS', context, output>
}

/**
 * A function that registers a route group into a route builder.
 */
export interface RouteInstaller<
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
> {
  (router: RouteBuilder<context, output>): void
}

/**
 * Extracts the request-context type handled by a router or route builder.
 *
 * This is useful when you want to configure `RouterTypes.context` from a router that uses inline
 * middleware arrays.
 */
export type RouterContext<router> = router extends {
  readonly [routeBuilderContext]?: infer context
}
  ? context
  : never

/**
 * Extracts the output type returned by a router or route builder.
 */
export type RouterOutput<router> = router extends { readonly [routeBuilderOutput]?: infer output }
  ? Defined<output>
  : never

/**
 * Options for creating a router.
 */
export interface RouterOptions<
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
  middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
> {
  /**
   * The default request handler that runs when no route matches.
   * Response routers default to a 404 `Not Found` response. Routers with a custom output must
   * provide this handler.
   */
  defaultHandler?: NoInfer<
    RequestHandler<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>
  >
  /**
   * The matcher to use for matching routes.
   *
   * @default `createMultiMatcher()`
   */
  matcher?: NoInfer<MultiMatcher<MatchData<output>>>
  /**
   * Middleware to run for every request handled by this router.
   *
   * Inline arrays are preferred. Use `createMiddleware()` only when a middleware chain is stored
   * before it is passed here and its exact tuple type must survive that boundary.
   */
  middleware?: readonly [...middleware]
}

/**
 * A router maps incoming requests to request handlers and returns their output.
 */
export interface Router<
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
> extends RouteBuilder<context, output> {
  /**
   * Fetch an output from the router.
   *
   * @param input The request input to fetch
   * @param init The request init options
   * @returns The output from the route that matched the request
   */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Defined<output>>
}

function noMatchHandler({ url }: RequestContext): Response {
  return new Response(`Not Found: ${url.pathname}`, { status: 404 })
}

function normalizeMiddleware<output>(
  middleware: readonly AnyMiddleware<output>[] | undefined,
): AnyMiddleware<output>[] | undefined {
  return middleware == null || middleware.length === 0 ? undefined : [...middleware]
}

function normalizeAction<output>(action: unknown): NormalizedAction<output> {
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

function mergeMiddleware<output>(
  upstream: AnyMiddleware<output>[] | undefined,
  downstream: AnyMiddleware<output>[] | undefined,
): AnyMiddleware<output>[] | undefined {
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

function createRequestContext<output>(
  input: string | URL | Request,
  init?: RequestInit,
): RequestContext<{}, [], output> {
  let request = input instanceof Request && init == null ? input : new Request(input, init)

  if (request.signal.aborted) {
    throw request.signal.reason
  }

  return new RequestContext<{}, [], output>(request)
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

/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
type CreateRouterArgs<
  context extends AnyContext,
  output,
  middleware extends readonly AnyMiddleware<output>[],
> = [Defined<output>] extends [Response]
  ? [options?: RouterOptions<context, output, middleware>]
  : [
      options: RouterOptions<context, output, middleware> & {
        defaultHandler: NoInfer<
          RequestHandler<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>
        >
      },
    ]

export function createRouter<
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
  const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
>(
  ...args: CreateRouterArgs<context, output, middleware>
): Router<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>
export function createRouter(): Router
export function createRouter<
  context extends AnyContext = RequestContext,
  output = DefaultOutput,
  const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[],
>(
  ...args: CreateRouterArgs<context, output, middleware>
): Router<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output> {
  type RouterContext = MiddlewareContext<middleware, ContextWithOutput<context, output>>

  let options = args[0]
  let defaultHandler = (options?.defaultHandler ?? noMatchHandler) as RequestHandler<any, output>
  let matcher = options?.matcher ?? createMultiMatcher<MatchData<output>>()
  let routerMiddleware = normalizeMiddleware(options?.middleware)

  async function dispatchRouter(
    context: RequestContext<any, any, output>,
  ): Promise<Defined<output>> {
    let dispatch = () => dispatchMatches(context)

    if (routerMiddleware) {
      return runMiddleware(routerMiddleware, context, dispatch)
    }

    return dispatch()
  }

  async function dispatchMatches(
    context: RequestContext<any, any, output>,
  ): Promise<Defined<output>> {
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
    action: NormalizedAction<output>,
    state: BuilderState,
  ): void {
    let pattern = getPrefixedRoutePattern(route, state)
    let entry: RouteEntry<output> = {
      pattern,
      handler: action.handler,
      method,
      middleware: action.middleware,
    }

    matcher.add(pattern, entry)
  }

  function addRoute(
    method: RequestMethod | 'ANY',
    route: RouteTarget,
    action: unknown,
    state: BuilderState,
  ): void {
    registerRoute(method, route, normalizeAction<output>(action), state)
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
    registerRoute(getMappedRouteMethod(target), target, normalizeAction<output>(handler), state)
  }

  function mapController(
    routes: RouteMap,
    controller: {
      middleware?: readonly AnyMiddleware<output>[] | undefined
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

        let action = normalizeAction<output>(controller.actions[key])
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
  ): RouteBuilder<builderContext, output> {
    function createVerbMethod<method extends RequestMethod>(method: method) {
      return <
        pattern extends string,
        actionContext extends AnyContext = builderContext,
        const middleware extends readonly AnyMiddleware<output>[] =
          readonly AnyMiddleware<output>[],
      >(
        route: RouteTarget<pattern, method>,
        action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> &
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
        const middleware extends readonly AnyMiddleware<output>[] =
          readonly AnyMiddleware<output>[],
      >(
        method: method,
        route: RouteTarget<pattern, method>,
        action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> &
          ContextCompatibility<builderContext, actionContext, middleware>,
      ): void {
        addRoute(method, route, action, state)
      },
      map(target: MapTarget, handler: unknown): void {
        mapRoutes(target, handler, state)
      },
      mount<pattern extends string>(
        prefix: pattern | RoutePattern<pattern>,
        installer: RouteInstaller<RouteContext<builderContext, pattern>, output>,
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

  let router: Router<RouterContext, output> = {
    ...rootBuilder,
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Defined<output>> {
      let context = createRequestContext<output>(input, init)
      context.router = router

      return dispatchRouter(context)
    },
  }

  return router
}

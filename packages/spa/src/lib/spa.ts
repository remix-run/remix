import type { Middleware, RequestContext } from '@remix-run/fetch-router'
import { renderWith, type Renderer } from '@remix-run/render-middleware'
import {
  run as runRuntime,
  type AppRuntime,
  type RemixNode,
  type ResolveFrameOptions,
} from '@remix-run/ui'
import { nodeFromSpaResponse, setSpaResponseRedirect, spaResponse } from '@remix-run/ui/spa'

/** Creates a response that the SPA runtime can render. */
export interface Render {
  /**
   * Creates a renderable route response.
   *
   * @param node Node to render.
   * @param init Optional response status and headers.
   * @returns A response understood by the SPA runtime.
   */
  (node: RemixNode, init?: ResponseInit): Response
}

/** Transforms a route node before the SPA runtime renders it. */
export interface RenderTransform {
  /**
   * Transforms a node using the active request context.
   *
   * @param node Node returned by the route.
   * @param context Active request context.
   * @returns The node to render.
   */
  (node: RemixNode, context: RequestContext): RemixNode
}

/** Minimal router contract used by {@link run}. */
export interface Router {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

/** Client runtime returned by {@link run}. */
export type Runtime = Omit<AppRuntime, 'ready'> & {
  /** Resolves after the client runtime starts and the initial route renders. */
  ready(): Promise<void>
}

/** Options for starting a client-rendered Remix application. */
export interface RunOptions {
  /** Remix node to display while the initial route loads. */
  fallback?: RemixNode
}

type RenderMiddleware = Middleware<{
  key: typeof Renderer
  value: Render
  property: 'render'
}>

const redirectStatuses = new Set([301, 302, 303, 307, 308])
const maxRedirects = 10

/**
 * Creates middleware that exposes `context.render()` for SPA route responses.
 *
 * @param transform Optional transform that wraps or replaces route nodes.
 * @returns Middleware that installs the SPA renderer on request context.
 */
export function render(transform?: RenderTransform): RenderMiddleware {
  return renderWith(
    (context) =>
      function render(node: RemixNode, init?: ResponseInit): Response {
        return spaResponse(transform ? transform(node, context) : node, init)
      },
  )
}

/**
 * Starts a client-rendered Remix application for the current document.
 *
 * The current URL and subsequent same-origin navigations are dispatched through `router`. Route
 * handlers return responses created by the {@link render} middleware, and their associated nodes
 * are rendered into the document's top frame.
 *
 * @param router Router that resolves browser requests to SPA route responses.
 * @param options Options for the initial render.
 * @returns The running application runtime.
 */
export function run(router: Router, options: RunOptions = {}): Runtime {
  let app = runRuntime({
    loadModule() {
      throw new Error('SPA responses cannot hydrate client entries')
    },
    async resolveFrame(src, options) {
      let url = new URL(src, document.baseURI)
      let method = options?.method?.toUpperCase() ?? 'GET'
      let body = ['GET', 'HEAD'].includes(method) ? undefined : getRequestBody(options)
      let { response, redirectedTo } = await followFrameRedirects(router, url, {
        method,
        body,
        signal: options?.signal,
      })

      nodeFromSpaResponse(response)
      if (redirectedTo) setSpaResponseRedirect(response, redirectedTo)
      return response
    },
  })

  let readyPromise = app.ready().then(async () => {
    if (options.fallback !== undefined) {
      await app.frames.top.replace(options.fallback)
    }
    await app.frames.top.reload()
  })

  return Object.assign(app, {
    ready: () => readyPromise,
  })
}

async function followFrameRedirects(
  router: Router,
  url: URL,
  init: RequestInit,
): Promise<{ response: Response; redirectedTo?: string }> {
  let initialOrigin = url.origin
  let method = init.method?.toUpperCase() ?? 'GET'
  let body = init.body
  let redirectedTo: string | undefined

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    let response = await router.fetch(url, { ...init, method, body })
    if (!redirectStatuses.has(response.status)) {
      return { response, redirectedTo }
    }

    let location = response.headers.get('Location')
    if (!location) return { response }
    if (redirectCount === maxRedirects) {
      throw new TypeError(`SPA route exceeded ${maxRedirects} redirects`)
    }

    let nextUrl = new URL(location, url)
    if (nextUrl.origin !== initialOrigin) {
      throw new TypeError('SPA routes cannot redirect to another origin')
    }

    if (
      (response.status === 303 && method !== 'GET' && method !== 'HEAD') ||
      ((response.status === 301 || response.status === 302) && method === 'POST')
    ) {
      method = 'GET'
      body = undefined
    }

    url = nextUrl
    redirectedTo = url.href
  }

  throw new TypeError(`SPA route exceeded ${maxRedirects} redirects`)
}

function getRequestBody(options?: ResolveFrameOptions): BodyInit | undefined {
  let formData = options?.formData
  if (!formData) return
  let encType = options?.encType

  if (encType === 'application/x-www-form-urlencoded') {
    let body = new URLSearchParams()
    for (let [name, value] of formData) {
      body.append(name, typeof value === 'string' ? value : value.name)
    }
    return body
  }

  if (encType === 'text/plain') {
    let lines: string[] = []
    for (let [name, value] of formData) {
      lines.push(`${name}=${typeof value === 'string' ? value : value.name}`)
    }
    return lines.join('\r\n')
  }

  return formData
}

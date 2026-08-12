import type { AppRuntime } from './runtime/run.ts'
import { run as runRuntime } from './runtime/run.ts'
import type { ResolveFrameOptions } from './runtime/frame.ts'
import { nodeFromResponse, nodeResponse, setNodeResponseRedirect } from './runtime/node-response.ts'

export { nodeFromResponse, nodeResponse }

/**
 * Minimal router contract used by {@link run}.
 *
 * Fetch routers satisfy this interface without coupling the UI runtime to a specific router
 * implementation.
 */
export interface SPARouter {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

/** Client runtime returned by {@link run}. */
export type SPARuntime = Omit<AppRuntime, 'ready'> & {
  /** Resolves after the client runtime starts and the initial route renders. */
  ready(): Promise<void>
}

const redirectStatuses = new Set([301, 302, 303, 307, 308])
const maxRedirects = 20

/**
 * Starts a client-rendered Remix application for the current document.
 *
 * The current URL and subsequent same-origin navigations are dispatched through `router`. Route
 * handlers return bodyless responses created with {@link nodeResponse}; their associated nodes are
 * rendered into the document's top frame.
 *
 * @param router Router that resolves browser requests to responses created by
 * {@link nodeResponse}.
 * @returns The running application runtime.
 */
export function run(router: SPARouter): SPARuntime {
  let app = runRuntime({
    loadModule() {
      throw new Error('SPA node responses cannot hydrate client entries')
    },
    resolveFrame: (src, options) => resolveSPARoute(router, src, options),
  })
  let readyPromise = app
    .ready()
    .then(() => app.frames.top.reload())
    .then(() => undefined)

  return Object.assign(app, {
    ready: () => readyPromise,
  })
}

async function resolveSPARoute(
  router: SPARouter,
  src: string,
  options?: ResolveFrameOptions,
): Promise<Response> {
  let url = new URL(src, document.baseURI)
  let initialOrigin = url.origin
  let method = options?.method?.toUpperCase() ?? 'GET'
  let body = method === 'GET' || method === 'HEAD' ? undefined : getRequestBody(options)
  let redirectedTo: string | undefined

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    let response = await router.fetch(url, {
      method,
      body,
      signal: options?.signal,
    })
    if (!redirectStatuses.has(response.status)) {
      nodeFromResponse(response)
      if (redirectedTo) setNodeResponseRedirect(response, redirectedTo)
      return response
    }

    let location = response.headers.get('Location')
    if (!location) {
      nodeFromResponse(response)
      return response
    }
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

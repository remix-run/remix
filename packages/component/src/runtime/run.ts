import { createFrame, NamedFrameRegistry, type Frame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { createStyleManager } from '../style/index.ts'
import type { FrameHandle, Handle } from './component.ts'
import { createComponentErrorEvent } from './error-event.ts'
import type { ComponentErrorEvent } from './error-event.ts'
import type { LoadModule, ResolveFrame, ResolveFrameOptions } from './frame.ts'
import { startNavigationListener } from './navigation.ts'
import { TypedEventTarget } from './typed-event-target.ts'
import type { ProcessClientEntryPreloads } from './module-preloader.ts'

/**
 * Options for starting the client runtime with {@link run}.
 */
export interface RunInit {
  /**
   * Loads the named browser module export for a hydrated `clientEntry()`.
   *
   * Implementations usually call dynamic `import(moduleUrl)` and return
   * `mod[exportName]`.
   */
  loadModule: LoadModule

  /**
   * Resolves browser-loaded frame content, including top-frame navigation and reloads.
   *
   * Defaults to fetching the frame source as HTML with the submitted form data, method, encoding,
   * and abort signal. All requests send `X-Remix-Frame: true`, plus `X-Remix-Target` when named.
   * The default resolver only fetches from the document origin, including
   * redirects, but does not sanitize the returned HTML. Custom resolvers own their request,
   * redirect, and content trust policies.
   */
  resolveFrame?: ResolveFrame

  /** Processes module preloads discovered in late client entry responses before activation. */
  processClientEntryPreloads?: ProcessClientEntryPreloads
}

/**
 * Events emitted by the application runtime.
 */
export type AppRuntimeEventMap = {
  error: ComponentErrorEvent
}

/**
 * Client runtime returned by {@link run}.
 */
export type AppRuntime = TypedEventTarget<AppRuntimeEventMap> & {
  /** Access top-level and named frames in the application runtime. */
  frames: Handle['frames']
  /** Resolves after the current document finishes hydrating. */
  ready(): Promise<void>
  /** Flushes any queued component updates synchronously. */
  flush(): void
  /** Stops runtime listeners and disposes the top-level frame. */
  dispose(): void
}

let topFrame: Frame
/**
 * Returns the top-level frame handle for the running application.
 *
 * @returns The top-level frame handle.
 */
export function getTopFrame(): FrameHandle {
  if (!topFrame) throw new Error('app runtime not initialized')
  return topFrame.handle
}

const namedFrames = new NamedFrameRegistry()
/**
 * Returns a named frame handle.
 *
 * @param name Name of the frame to look up.
 * @returns The matching frame handle, or `undefined` when not found.
 */
export function getNamedFrame(name: string): FrameHandle | undefined {
  return namedFrames.get(name)
}

function getRequestBody(options?: ResolveFrameOptions): {
  body?: BodyInit
  encType?: string
} {
  let requestBody = options?.body
  let formData =
    requestBody instanceof FormData || requestBody instanceof URLSearchParams
      ? requestBody
      : options?.formData
  if (!formData) {
    return {
      body: requestBody ?? undefined,
      encType: requestBody == null ? undefined : options?.encType,
    }
  }
  if (['get', 'head'].includes((options?.method ?? 'get').toLowerCase())) return {}

  let encType = options?.encType?.toLowerCase()

  if (encType === 'multipart/form-data') {
    if (formData instanceof FormData) return { body: formData }
    let body = new FormData()
    for (let [name, value] of formData) body.append(name, value)
    return { body }
  }

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return { body: new Blob([body], { type: 'text/plain' }) }
  }

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(
      normalizeLineBreaks(name),
      normalizeLineBreaks(typeof value === 'string' ? value : value.name),
    )
  }
  return { body }
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}

async function defaultResolveFrame(src: string, options?: ResolveFrameOptions): Promise<Response> {
  let headers = new Headers({ Accept: 'text/html', 'X-Remix-Frame': 'true' })
  if (options?.target != null) headers.set('X-Remix-Target', options.target)

  let { body, encType } = getRequestBody(options)
  if (encType) headers.set('Content-Type', encType)
  let requestInit: RequestInit & { duplex?: 'half' } = {
    body,
    headers,
    method: options?.method,
    mode: 'same-origin',
    signal: options?.signal,
  }
  if (body instanceof ReadableStream) requestInit.duplex = 'half'
  let response = await fetch(src, requestInit)

  let isHtml = response.headers.get('Content-Type')?.toLowerCase().includes('text/html')
  if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }

  return response
}

/**
 * Starts the client-side Remix component runtime for the current document.
 *
 * @param init Runtime options for loading modules and customizing frame resolution.
 * @returns The running application runtime.
 */
export function run(init: RunInit): AppRuntime {
  let styleManager = createStyleManager()
  let errorTarget = new TypedEventTarget<AppRuntimeEventMap>()
  let scheduler = createScheduler(document, errorTarget, styleManager)

  let resolveFrame = init.resolveFrame ?? defaultResolveFrame

  topFrame = createFrame(document, {
    src: document.location.href,
    errorTarget,
    loadModule: init.loadModule,
    resolveFrame,
    pendingClientEntries: new Map(),
    scheduler,
    styleManager,
    data: {},
    moduleCache: new Map(),
    moduleLoads: new Map(),
    frameInstances: new WeakMap(),
    namedFrames,
    processClientEntryPreloads: init.processClientEntryPreloads,
  })

  let appController = new AbortController()
  let frames: Handle['frames'] = {
    top: topFrame.handle,
    get(name) {
      return namedFrames.get(name)
    },
  }
  startNavigationListener(appController.signal)
  let readyPromise = topFrame.ready().catch((error) => {
    errorTarget.dispatchEvent(createComponentErrorEvent(error))
    throw error
  })

  return Object.assign(errorTarget, {
    frames,
    ready: () => readyPromise,
    flush: () => topFrame.flush(),
    dispose: () => {
      appController.abort()
      topFrame.dispose()
      styleManager.dispose()
    },
  })
}

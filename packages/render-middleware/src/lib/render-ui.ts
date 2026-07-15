import type { AssetServer } from '@remix-run/assets'
import type { Middleware, RequestContext } from '@remix-run/fetch-router'
import { createHtmlResponse } from '@remix-run/response/html'
import { renderToStream, type ResolveFrameContext } from '@remix-run/ui/server'

import { renderWith, type Renderer } from './render.ts'

type RenderRequestContext = Pick<RequestContext, 'headers' | 'request' | 'router' | 'url'>
type RemixNode = Parameters<typeof renderToStream>[0]

const FRAME_HEADER = 'X-Remix-Frame'
const FRAME_TARGET_HEADER = 'X-Remix-Target'
const TOP_FRAME_SRC_HEADER = 'X-Remix-Top-Frame-Src'
const MAX_FRAME_REDIRECTS = 20
const FRAME_REQUEST_HEADERS_TO_REMOVE = [
  'Connection',
  'Content-Encoding',
  'Content-Language',
  'Content-Length',
  'Content-Location',
  'Content-Type',
  'Expect',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Keep-Alive',
  'Range',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
] as const
const CROSS_ORIGIN_FRAME_HEADERS = [
  'Accept',
  'Accept-Encoding',
  FRAME_HEADER,
  FRAME_TARGET_HEADER,
  TOP_FRAME_SRC_HEADER,
] as const

/** Options for the standard Remix UI renderer. */
export interface RenderOptions {
  /** Asset server used to turn source-based client entry IDs into browser module URLs. */
  assets?: Pick<AssetServer, 'getHref'>
  /** Error hook invoked when server rendering fails. */
  onError?: (error: unknown) => void
}

/** Renders a Remix UI node as an HTML response. */
export type RenderFunction = (node: RemixNode, init?: ResponseInit) => Response

/**
 * Adds the standard Remix UI renderer to request context.
 *
 * @param options Rendering integration options.
 * @returns Middleware that installs `context.render(node, init)` for the current request.
 */
export function render(
  options: RenderOptions = {},
): Middleware<{ key: typeof Renderer; value: RenderFunction; property: 'render' }> {
  return renderWith((context) => {
    let request = context.request
    let topFrameSrc = getTopFrameSrc(request)
    let assets = options.assets

    return function render(node: RemixNode, init?: ResponseInit): Response {
      let stream = renderToStream(node, {
        frameSrc: request.url,
        topFrameSrc,
        signal: request.signal,
        onError: options.onError,
        resolveFrame: (src, target, frameContext) =>
          resolveFrame(context, src, target, frameContext),
        ...(assets == null
          ? {}
          : {
              resolveClientEntry: (entryId: string, component: { readonly name: string }) =>
                resolveClientEntry(assets, entryId, component),
            }),
      })

      return createHtmlResponse(stream, init)
    }
  })
}

function getTopFrameSrc(request: Request): string {
  if (request.headers.get(FRAME_HEADER) !== 'true') return request.url
  return request.headers.get(TOP_FRAME_SRC_HEADER) ?? request.url
}

async function resolveFrame(
  context: RenderRequestContext,
  src: string,
  target?: string,
  frameContext?: ResolveFrameContext,
): Promise<string | ReadableStream<Uint8Array>> {
  let currentFrameSrc = frameContext?.currentFrameSrc ?? context.request.url
  let topFrameSrc = frameContext?.topFrameSrc ?? getTopFrameSrc(context.request)
  let frameUrl = new URL(src, currentFrameSrc)
  let headers = createFrameRequestHeaders(context.headers, target, topFrameSrc)
  let response = await followFrameRedirects(context, frameUrl, headers)

  if (response.body != null) return response.body
  if (response.ok) return ''

  return `<pre>Frame error: ${response.status} ${escapeHtml(response.statusText)}</pre>`
}

function createFrameRequestHeaders(
  requestHeaders: Headers,
  target: string | undefined,
  topFrameSrc: string,
): Headers {
  let headers = new Headers(requestHeaders)

  for (let name of FRAME_REQUEST_HEADERS_TO_REMOVE) {
    headers.delete(name)
  }
  for (let name of headers.keys()) {
    if (name.startsWith('sec-fetch-')) headers.delete(name)
  }

  headers.set('Accept', 'text/html')
  headers.set('Accept-Encoding', 'identity')
  headers.set(FRAME_HEADER, 'true')
  headers.set(TOP_FRAME_SRC_HEADER, topFrameSrc)

  if (target == null) {
    headers.delete(FRAME_TARGET_HEADER)
  } else {
    headers.set(FRAME_TARGET_HEADER, target)
  }

  return headers
}

async function followFrameRedirects(
  context: RenderRequestContext,
  initialUrl: URL,
  headers: Headers,
): Promise<Response> {
  let url = initialUrl

  for (let redirectCount = 0; redirectCount <= MAX_FRAME_REDIRECTS; redirectCount++) {
    if (url.origin !== context.url.origin) {
      headers = createCrossOriginFrameHeaders(headers)
    }

    let response = await context.router.fetch(
      new Request(url, {
        method: 'GET',
        headers,
        signal: context.request.signal,
      }),
    )
    let location = response.headers.get('Location')

    if (location == null || response.status < 300 || response.status >= 400) {
      return response
    }
    if (redirectCount === MAX_FRAME_REDIRECTS) {
      throw new Error(`Too many frame redirects while resolving ${initialUrl.href}`)
    }

    await response.body?.cancel()
    url = new URL(location, url)
  }

  throw new Error(`Too many frame redirects while resolving ${initialUrl.href}`)
}

function createCrossOriginFrameHeaders(headers: Headers): Headers {
  let crossOriginHeaders = new Headers()

  for (let name of CROSS_ORIGIN_FRAME_HEADERS) {
    let value = headers.get(name)
    if (value != null) crossOriginHeaders.set(name, value)
  }

  return crossOriginHeaders
}

async function resolveClientEntry(
  assets: Pick<AssetServer, 'getHref'>,
  entryId: string,
  component: { readonly name: string },
): Promise<{ href: string; exportName: string }> {
  let hashIndex = entryId.lastIndexOf('#')
  let sourceId = hashIndex === -1 ? entryId : entryId.slice(0, hashIndex)
  let explicitExportName = hashIndex === -1 ? '' : entryId.slice(hashIndex + 1)
  let exportName = explicitExportName || component.name

  if (!exportName) {
    throw new Error(
      `clientEntry() requires either an export name in the entry ID (e.g., "/js/module.js#ComponentName") or a named component function. Received "${entryId}".`,
    )
  }

  return {
    href: sourceId.startsWith('file:') ? await assets.getHref(sourceId) : sourceId,
    exportName,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

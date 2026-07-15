import {
  createFetchProxy as createRemixFetchProxy,
  type FetchProxy,
  type FetchProxyOptions,
} from 'remix/fetch-proxy'

export function createFetchProxy(target: string | URL, options?: FetchProxyOptions): FetchProxy {
  let proxyFetch = createRemixFetchProxy(target, options)

  return async (input, init) => {
    let request = patchProxyRequest(input, init)
    let response = await proxyFetch(request)

    return patchProxyResponse(request, response)
  }
}

function patchProxyRequest(input: URL | RequestInfo, init?: RequestInit): Request {
  let request = isRequestLike(input) ? input : new Request(input, init)
  let headers = new Headers(request.headers)

  // Temporary workaround until fetch-proxy stops forwarding final-client
  // Accept-Encoding headers to proxy targets.
  headers.delete('Accept-Encoding')

  // Temporary workaround until fetch-proxy accepts the lazy Request objects
  // provided by node-fetch-server.
  return new Request(request.url, {
    body: request.body,
    headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal,
    ...getRequestDuplex(request),
  })
}

function patchProxyResponse(request: Request, response: Response): Response {
  let headers = new Headers(response.headers)
  let hasContentEncoding = headers.has('Content-Encoding')
  let hasTransferEncoding = headers.has('Transfer-Encoding')
  let hasProxiedResponseBody = request.method !== 'HEAD' && response.body != null

  // Temporary workaround until fetch-proxy strips hop-by-hop/body-specific
  // response headers that may no longer match the proxied response body.
  headers.delete('Transfer-Encoding')
  if (hasTransferEncoding || (hasProxiedResponseBody && hasContentEncoding)) {
    headers.delete('Content-Length')
  }

  if (hasProxiedResponseBody && hasContentEncoding) {
    headers.delete('Content-Encoding')
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function getRequestDuplex(request: Request): { duplex: 'half' } | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  return { duplex: 'half' }
}

function isRequestLike(input: URL | RequestInfo): input is Request {
  return typeof input === 'object' && 'url' in input
}

import { Accept, Vary } from 'remix/headers'

export const agentGuideContentType = 'text/markdown; charset=utf-8'

/**
 * Returns whether a request ranks Markdown above HTML.
 */
export function prefersMarkdown(headers: Headers): boolean {
  let accept = Accept.from(headers.get('Accept'))
  // Accept#getPreferred picks the highest-weight match rather than the most specific one, so a
  // header like `text/html;q=0, */*` would still choose HTML.
  let wildcardWeight = accept.get('text/*') ?? accept.get('*/*') ?? 0
  let markdownWeight = accept.get('text/markdown') ?? wildcardWeight
  let htmlWeight = accept.get('text/html') ?? wildcardWeight
  return markdownWeight > htmlWeight
}

/**
 * Serves `/agents.md` for homepage requests that prefer Markdown from a static file server, such
 * as the static preview or the Workers `ASSETS` binding. The app router negotiates in its `home`
 * action instead.
 */
export async function serveAgentGuide(
  request: Request,
  fetchAsset: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  let url = new URL(request.url)
  if (url.pathname !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return fetchAsset(request)
  }

  let markdown = prefersMarkdown(request.headers)
  if (markdown) {
    url.pathname = '/agents.md'
    url.search = ''
  }
  let response = await fetchAsset(markdown ? new Request(url, request) : request)
  let headers = new Headers(response.headers)
  let vary = Vary.from(headers.get('Vary'))
  vary.add('Accept')
  headers.set('Vary', vary.toString())
  if (markdown && (response.ok || response.status === 304)) {
    headers.set('Content-Type', agentGuideContentType)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

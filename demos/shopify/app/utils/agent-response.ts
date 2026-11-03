import { Accept, Vary } from 'remix/headers'

export async function serveAgentGuide(
  request: Request,
  fetchAsset: (request: Request) => Response | Promise<Response>,
): Promise<Response> {
  let url = new URL(request.url)
  if (url.pathname !== '/' || (request.method !== 'GET' && request.method !== 'HEAD')) {
    return fetchAsset(request)
  }

  let accept = Accept.from(request.headers.get('Accept'))
  let wildcardWeight = accept.get('text/*') ?? accept.get('*/*') ?? 0
  let markdownWeight = accept.get('text/markdown') ?? wildcardWeight
  let htmlWeight = accept.get('text/html') ?? wildcardWeight
  let markdown = markdownWeight > htmlWeight
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
    headers.set('Content-Type', 'text/markdown; charset=utf-8')
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

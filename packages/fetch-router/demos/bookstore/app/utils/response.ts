/**
 * Creates an HTML Response with proper Content-Type header
 */
export function html(content: string | ReadableStream, init?: ResponseInit): Response {
  return new Response(content, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      ...init?.headers,
    },
  })
}

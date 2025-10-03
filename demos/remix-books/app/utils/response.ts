/**
 * Helper to create a redirect response with an absolute URL
 */
export function redirect(path: string, baseUrl: string | URL, status: number = 302): Response {
  let url = new URL(path, baseUrl)
  return Response.redirect(url.href, status)
}

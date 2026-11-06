/**
 * Returns the same-origin page that submitted a form, so non-JavaScript submissions land back
 * where the visitor started.
 */
export function getReturnPath(request: Request, fallback: string): string {
  let referer = request.headers.get('Referer')
  if (referer == null) return fallback

  let url = new URL(request.url)
  let returnUrl = new URL(referer, url)
  return returnUrl.origin === url.origin ? returnUrl.pathname + returnUrl.search : fallback
}

import { getApiRouteHref } from './routes.ts'

export function getVersionedLookupHref(href: string, version: string): string {
  return getApiRouteHref(href, version) ?? href
}

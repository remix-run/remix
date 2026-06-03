import { getDocsRouteHref } from './routes.ts'

export function getVersionedLookupHref(href: string, version: string): string {
  return getDocsRouteHref(href, version) ?? href
}

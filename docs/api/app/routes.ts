import { route } from 'remix/routes'

export const routes = route({
  assets: '/assets/*asset',
  home: '/',
  lookup: '/api.json',
  // Docs used to live under `/api/`. Keep old links working.
  legacy: '/api/*slug',
  api: route({
    document: '*slug/',
    markdown: '*slug.md',
  }),
})

export function getVersionPathname(version: string): string {
  return `/${encodePathSegment(version)}`
}

export function withVersion(href: string, version: string | undefined): string {
  return version === undefined ? href : `${getVersionPathname(version)}${href}`
}

// Matches docs paths like `/remix/router/type/Route` and legacy `/api/@remix-run/ui/...` links.
const docsPathnamePattern = /^\/(api\/)?(?:@|%40)?(remix(?:-run)?\/.+)$/

export function getApiRouteHref(href: string, version: string | undefined): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) return undefined

  let url = new URL(href, 'http://localhost')
  let match = docsPathnamePattern.exec(url.pathname)
  if (!match) return undefined

  let [, legacy, slug] = match
  // Legacy package overviews lived at `.../overview/`.
  let pathname = `/${legacy ? slug.replace(/\/overview(?=\/?$|\.md$)/, '') : slug}`
  if (!pathname.endsWith('.md')) {
    pathname = pathname.replace(/\/?$/, '/')
  }

  return `${withVersion(pathname, version)}${url.search}${url.hash}`
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

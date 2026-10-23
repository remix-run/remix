import { route } from 'remix/routes'

export const routes = route({
  // Underscored so no package (like `remix/assets`) can take the path.
  assets: '/_assets/*asset',
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

// Docs files live under their import path (`remix/router/...`, `remix-run/ui/...`), but URLs drop
// the scope: `/router/...`, `/ui/...`. The bare `remix` package stays at `/remix/`.
export function getDocsUrlPath(docsPath: string): string {
  return docsPath.replace(/^@?remix(?:-run)?\/(?=.)/, '')
}

// Matches docs paths like `/remix/router/type/Route` and legacy `/api/@remix-run/ui/...` links.
const docsPathnamePattern = /^\/(api\/)?(?:@|%40)?(remix(?:-run)?\/.+)$/

export function getApiRouteHref(href: string, version: string | undefined): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) return undefined

  let url = new URL(href, 'http://localhost')
  let pathname = url.pathname
  if (version !== undefined && pathname.startsWith(`${getVersionPathname(version)}/`)) return href
  let match = docsPathnamePattern.exec(pathname)
  if (match) {
    let [, legacy, slug] = match
    // Legacy package overviews lived at `.../overview/`.
    pathname = `/${getDocsUrlPath(legacy ? slug.replace(/\/overview(?=\/?$|\.md$)/, '') : slug)}`
  }
  // Pages end in a slash; files like `.md` and `api.json` don't.
  if (!/\.\w+$/.test(pathname)) {
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

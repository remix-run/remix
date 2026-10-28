import { get, route } from 'remix/routes'

export const routes = route({
  // Underscored so no package (like `remix/assets`) can take the path.
  assets: '/_assets/*asset',
  home: '/',
  api: '/api/',
  lookup: '/api.json',
  // Guides live at the URL root (`/start-here/`); unknown chapters fall through to the reference.
  guides: route({
    examples: route('examples', {
      show: get(':chapter/:example(/)'),
    }),
    markdown: get(':chapter.md'),
    chapter: get(':chapter(/)'),
  }),
  reference: route({
    document: '*slug/',
    markdown: '*slug.md',
  }),
})

// Docs files live under their import path (`remix/router/...`, `remix-run/ui/...`), but URLs drop
// the scope: `/router/...`, `/ui/...`. The bare `remix` package stays at `/remix/`.
export function getDocsUrlPath(docsPath: string): string {
  return docsPath.replace(/^@?remix(?:-run)?\/(?=.)/, '')
}

// Matches import-path links like `/remix/router/type/Route` and `/remix-run/ui/tabs/`.
const docsPathnamePattern = /^\/(remix(?:-run)?\/.+)$/

export function getApiRouteHref(href: string): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) return undefined

  let url = new URL(href, 'http://localhost')
  let pathname = url.pathname
  let match = docsPathnamePattern.exec(pathname)
  if (match) pathname = `/${getDocsUrlPath(match[1])}`
  // Pages end in a slash; files like `.md` and `api.json` don't.
  if (!/\.\w+$/.test(pathname)) {
    pathname = pathname.replace(/\/?$/, '/')
  }

  return `${pathname}${url.search}${url.hash}`
}

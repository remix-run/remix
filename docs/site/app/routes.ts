import { get, route } from 'remix/routes'

export const routes = route({
  // Underscored so no package (like `remix/assets`) can take the path.
  assets: '/_assets/*asset',
  home: '/',
  api: '/api/',
  lookup: '/api.json',
  // Guides live at the URL root (`/start-here/`).
  guides: route({
    examples: route('examples', {
      show: get(':chapter/:example(/)'),
    }),
    markdown: get(':chapter.md'),
    chapter: get(':chapter(/)'),
  }),
  // API reference pages live under `/api/` (`/api/router/`), next to the `/api/` index.
  reference: route('api', {
    document: '*slug/',
    markdown: '*slug.md',
  }),
})

// Docs files live under their import path (`remix/router/...`, `remix-run/ui/...`), but URL slugs
// drop the scope: `router/...`, `ui/...`. The bare `remix` package stays at `remix`.
export function getDocsUrlPath(docsPath: string): string {
  return docsPath.replace(/^@?remix(?:-run)?\/(?=.)/, '')
}

// Matches import-path links like `/remix/`, `/remix/router/type/Route`, and `/remix-run/ui/tabs/`.
const docsPathnamePattern = /^\/(remix(?:-run)?\/.*)$/

export function getApiRouteHref(href: string): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) return undefined

  let url = new URL(href, 'http://localhost')
  let pathname = url.pathname
  let match = docsPathnamePattern.exec(pathname)
  if (match) pathname = `${routes.api.href()}${getDocsUrlPath(match[1])}`
  // Pages end in a slash; files like `.md` and `api.json` don't.
  if (!/\.\w+$/.test(pathname)) {
    pathname = pathname.replace(/\/?$/, '/')
  }

  return `${pathname}${url.search}${url.hash}`
}

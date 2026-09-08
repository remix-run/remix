import { route } from 'remix/routes'

export const routes = route({
  assets: '/assets/*asset',
  home: '/',
  lookup: '/api.json',
  api: route('api', {
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

export function getApiRouteHref(href: string, version: string | undefined): string | undefined {
  if (!href.startsWith('/api/')) return undefined

  let url = new URL(href, 'http://localhost')
  let slug = url.pathname.slice('/api/'.length)
  if (slug.length === 0) return undefined

  let routeHref: string
  if (slug.endsWith('.md')) {
    routeHref = routes.api.markdown.href({ slug: slug.slice(0, -'.md'.length) })
  } else {
    routeHref = routes.api.document.href({ slug: slug.replace(/\/$/, '') })
  }

  return `${withVersion(routeHref, version)}${url.search}${url.hash}`
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

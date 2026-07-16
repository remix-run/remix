import { route } from 'remix/routes'

export const routes = route({
  assets: '/(:version/)assets/*asset',
  api: '/(:version/)api/*slug/',
  home: '/(:version/)',
  lookup: '/(:version/)api.json',
  markdown: '/(:version/)api/*slug.md',
})

export function getApiRouteHref(href: string, version: string | undefined): string | undefined {
  if (!href.startsWith('/api/')) return undefined

  let url = new URL(href, 'http://localhost')
  let slug = url.pathname.slice('/api/'.length)
  if (slug.length === 0) return undefined

  let routeHref: string
  if (slug.endsWith('.md')) {
    routeHref = routes.markdown.href({ version, slug: slug.slice(0, -'.md'.length) })
  } else {
    routeHref = routes.api.href({ version, slug: slug.replace(/\/$/, '') })
  }

  return `${routeHref}${url.search}${url.hash}`
}

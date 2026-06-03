import { routes } from './routes.ts'

export function getVersionedLookupHref(href: string, version: string): string {
  if (!href.startsWith('/api/')) return href

  let url = new URL(href, 'http://localhost')
  let slug = url.pathname.slice('/api/'.length)
  if (slug.length === 0) return href

  let routeHref: string
  if (slug.endsWith('.md')) {
    routeHref = routes.markdown.href({ version, slug: slug.slice(0, -'.md'.length) })
  } else {
    routeHref = routes.docs.href({ version, slug: slug.replace(/\/$/, '') })
  }

  return `${routeHref}${url.search}${url.hash}`
}

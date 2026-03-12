import { parse } from './html-parser.ts'
import type { HTMLElement } from './html-parser.ts'

const BASE_URL = 'http://localhost'

export interface CrawlResult {
  pathname: string
  filepath: string
  response: Response
}

export interface CrawlOptions {
  /**
   * Initial URL paths to put in the crawl queue.
   * @default ['/']
   */
  paths?: string[]
  /**
   * Whether to follow outbound links found in HTML documents.
   * @default true
   */
  spider?: boolean
}

export async function* crawl(
  router: { fetch(request: Request): Promise<Response> },
  options: CrawlOptions = {},
): AsyncIterableIterator<CrawlResult> {
  let { paths = ['/'], spider = true } = options

  let queue = new Set(paths)
  let visited = new Set<string>()

  for (let pathname of queue) {
    if (visited.has(pathname)) {
      continue
    }
    visited.add(pathname)

    let response = await router.fetch(new Request(`${BASE_URL}${pathname}`))
    let isHtml = response.headers.get('Content-Type')?.includes('text/html')
    let toQueue: string[] = []

    if (isHtml) {
      let cloned = response.clone()
      yield {
        pathname,
        // / -> /index.html, /about -> /about/index.html, /about/ -> /about/index.html
        // Always put `index.html` files into directories - this leads to the best
        // support with and without trailing slashes on github pages:
        // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
        filepath: pathname.replace(/\/?$/, '/index.html'),
        response,
      }

      let elements = parse(await cloned.text())

      // Always queue referenced assets (CSS, JS, images)
      toQueue.push(...extractAssetPaths(elements, pathname))

      // Only follow navigation links when spider mode is enabled
      if (spider) {
        toQueue.push(...extractLinkPaths(elements, pathname))
      }
    } else {
      yield { pathname, filepath: pathname, response }
    }

    toQueue.filter((p) => !visited.has(p)).forEach((p) => queue.add(p))
  }
}

function extractAssetPaths(elements: HTMLElement[], baseUrl: string): string[] {
  let linkAttrs = elements
    .filter(
      (el) =>
        el.name === 'link' &&
        !rel(el).includes('preload') &&
        !rel(el).includes('prefetch') &&
        !rel(el).includes('modulepreload'),
    )
    .map((el) => el.getAttribute('href'))

  let srcAttrs = elements
    .filter((el) => (el.name === 'script' || el.name === 'img') && el.getAttribute('src'))
    .map((el) => el.getAttribute('src'))

  return [...linkAttrs, ...srcAttrs]
    .filter((href): href is string => href != null)
    .filter((href) => !isNonNavigable(href))
    .filter(isRelativeUrl)
    .map((href) => resolveHref(href, baseUrl))
    .filter((href): href is string => href != null)
}

function extractLinkPaths(elements: HTMLElement[], baseUrl: string): string[] {
  return elements
    .filter((el) => el.name === 'a' && !rel(el).includes('nofollow'))
    .map((el) => el.getAttribute('href'))
    .filter((href): href is string => href != null)
    .filter((href) => !isNonNavigable(href))
    .filter(isRelativeUrl)
    .map((href) => resolveHref(href, baseUrl))
    .filter((href): href is string => href != null)
}

function rel(el: HTMLElement) {
  return el.getAttribute('rel')?.split(/\s+/) || []
}

function isNonNavigable(href: string): boolean {
  return (
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:') ||
    href.startsWith('data:')
  )
}

function isRelativeUrl(href: string): boolean {
  return !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')
}

function resolveHref(href: string, baseUrl: string): string | null {
  // Absolute URL — extract pathname
  if (/^https?:\/\//.test(href) || href.startsWith('//')) {
    try {
      return new URL(href).pathname
    } catch {
      return null
    }
  }

  // Relative URL — resolve against the current page's path
  try {
    return new URL(href, `${BASE_URL}${baseUrl}`).pathname
  } catch {
    return null
  }
}

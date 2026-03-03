import { parse } from './html-parser.ts'
import type { HTMLElement } from './html-parser.ts'

const BASE_URL = 'http://localhost'

export interface CrawlResult {
  pathname: string
  filePath: string
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
   * @default false
   */
  spider?: boolean
  /**
   * Controls which discovered href values are added to the crawl queue. Receives the raw href value
   * as found in the HTML (after non-navigable schemes like `mailto:` and `#` are excluded).
   * Return `true` to crawl the URL, `false` to skip it. Defaults to crawling any non-absolute URLs
   *
   * @default Only non-absolute href values (i.e. those not starting with `http://`, `https://`, or `//`)
   * @example Include same-origin absolute URLs:
   * ```ts
   * filter: (href) => !href.startsWith('http') || href.startsWith('https://mysite.com')
   * ```
   */
  filter?(href: string): boolean
  /**
   * Called for each crawled URL to produce additional path variants to queue.
   * Useful for paths that have known alternate representations without explicit links,
   * e.g. returning `[pathname + '.md']` to also fetch the markdown source of each page.
   */
  variants?(pathname: string): string[] | undefined | Promise<string[] | undefined>
}

const defaultFilter = (href: string): boolean =>
  !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')

export async function* runCrawl(
  fetchFn: (request: Request) => Promise<Response>,
  options: CrawlOptions,
): AsyncIterableIterator<CrawlResult> {
  let { paths = ['/'], spider = false, filter = defaultFilter, variants } = options

  let queue = new Set(paths)
  let visited = new Set<string>()

  for (let urlPath of queue) {
    if (visited.has(urlPath)) {
      continue
    }
    visited.add(urlPath)

    let response = await fetchFn(new Request(`${BASE_URL}${urlPath}`))
    let isHtml = response.headers.get('Content-Type')?.includes('text/html')
    let toQueue: string[] = []

    if (isHtml) {
      // Pass a clone so we can read the body for parsing
      yield { pathname: urlPath, filePath: getHtmlFilepath(urlPath), response: response.clone() }

      let elements = parse(await response.text())

      // Always queue referenced assets (CSS, JS, images)
      toQueue.push(...extractAssetPaths(elements, urlPath, filter))

      // Only follow navigation links when spider mode is enabled
      if (spider) {
        toQueue.push(...extractLinkPaths(elements, urlPath, filter))
      }
    } else {
      yield { pathname: urlPath, filePath: urlPath, response }
    }

    // Queue any path variants returned by the variants callback
    if (variants) {
      let variantPaths = await variants(urlPath)
      if (variantPaths) {
        toQueue.push(...variantPaths)
      }
    }

    for (let path of toQueue) {
      if (!visited.has(path)) {
        queue.add(path)
      }
    }
  }
}

// Always put `index.html` files into directories - this leads to the best
// support with and without trailing slashes on github pages:
// https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
function getHtmlFilepath(urlPath: string): string {
  // / -> /index.html, /about -> /about/index.html, /about/ -> /about/index.html
  return urlPath.replace(/\/?$/, '/index.html')
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

function hasRelValue(el: HTMLElement, value: string): boolean {
  return el.getAttribute('rel')?.split(/\s+/).includes(value) || false
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

const rel = (el: HTMLElement) => el.getAttribute('rel')?.split(/\s+/) || []

function extractAssetPaths(
  elements: HTMLElement[],
  baseUrl: string,
  filter: (href: string) => boolean,
): string[] {
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
    .filter(filter)
    .map((href) => resolveHref(href, baseUrl))
    .filter((href): href is string => href != null)
}

function extractLinkPaths(
  elements: HTMLElement[],
  baseUrl: string,
  filter: (href: string) => boolean,
): string[] {
  return elements
    .filter((el) => el.name === 'a' && !rel(el).includes('nofollow'))
    .map((el) => el.getAttribute('href'))
    .filter((href): href is string => href != null)
    .filter((href) => !isNonNavigable(href))
    .filter(filter)
    .map((href) => resolveHref(href, baseUrl))
    .filter((href): href is string => href != null)
}

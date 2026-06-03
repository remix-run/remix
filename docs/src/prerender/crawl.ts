import { parse } from './html-parser.ts'
import type { HTMLElement } from './html-parser.ts'
import type { Router } from 'remix/router'

const BASE_URL = 'http://localhost'

interface CrawlResult {
  pathname: string
  filepath: string
  response: Response
}

interface CrawlOptions {
  paths?: string[]
  spider?: boolean
  concurrency?: number
  ignorePageNofollow?: (pathname: string) => boolean
}

export async function* crawl(
  router: Router,
  options: CrawlOptions = {},
): AsyncIterableIterator<CrawlResult> {
  let { paths = ['/'], spider = true, concurrency = 1, ignorePageNofollow } = options

  let queue: string[] = []
  let visited = new Set<string>()
  let results: CrawlResult[] = []
  let active = 0
  let error: unknown

  let notify: () => void = () => {}
  let gate = new Promise<void>((r) => (notify = r))
  function bump() {
    let n = notify
    gate = new Promise<void>((r) => (notify = r))
    n()
  }

  enqueue(paths)

  while (true) {
    while (active < concurrency && queue.length > 0) {
      fetchOne(queue.shift()!)
    }

    if (error) throw error
    if (results.length > 0) {
      yield results.shift()!
      continue
    }
    if (active === 0 && queue.length === 0) break

    await gate
  }

  function enqueue(pathnames: string[]) {
    pathnames.forEach((p) => {
      if (!visited.has(p)) {
        visited.add(p)
        queue.push(p)
      }
    })
  }

  async function fetchOne(pathname: string) {
    active++
    try {
      let response = await router.fetch(new Request(`${BASE_URL}${pathname}`))

      if (!response.ok) {
        throw new Error(`Crawl failed: ${response.status} ${response.statusText} (${pathname})`)
      }

      let isHtml = response.headers.get('Content-Type')?.includes('text/html')

      if (isHtml) {
        let cloned = response.clone()
        results.push({
          pathname,
          filepath: pathname.replace(/\/?$/, '/index.html'),
          response,
        })

        let dom = parse(await cloned.text())

        enqueue(extractAssetPaths(dom.elements, pathname))

        if (spider && (ignorePageNofollow?.(pathname) || shouldCrawlLinks(dom.elements))) {
          enqueue(extractLinkPaths(dom.elements, pathname))
        }
      } else {
        results.push({ pathname, filepath: pathname, response })
      }
    } catch (e) {
      error = e
    } finally {
      active--
      bump()
    }
  }
}

function extractAssetPaths(elements: HTMLElement[], baseUrl: string): string[] {
  let linkAttrs = elements
    .filter((el) => {
      if (el.name !== 'link') return false
      let rels = rel(el)
      return !rels.includes('nofollow')
    })
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
    .filter(
      (el) =>
        !rel(el).includes('nofollow') &&
        (el.name === 'a' || (el.name === 'link' && rel(el).includes('alternate'))),
    )
    .map((el) => el.getAttribute('href'))
    .filter((href): href is string => href != null)
    .filter((href) => !isNonNavigable(href))
    .filter(isRelativeUrl)
    .map((href) => resolveHref(href, baseUrl))
    .filter((href): href is string => href != null)
}

function shouldCrawlLinks(elements: HTMLElement[]): boolean {
  let hasPageNoFollowDirective = elements.some((el) => {
    if (el.name !== 'meta') return false
    let name = el.getAttribute('name')?.toLowerCase()
    if (name !== 'robots' && name !== 'googlebot') return false
    let content = el.getAttribute('content')?.toLowerCase() ?? ''
    return content.split(/[\s,]+/).includes('nofollow')
  })
  return !hasPageNoFollowDirective
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
  if (/^https?:\/\//.test(href) || href.startsWith('//')) {
    try {
      return new URL(href).pathname
    } catch {
      return null
    }
  }

  if (href.startsWith('/')) return href

  try {
    return new URL(href, `${BASE_URL}${baseUrl}`).pathname
  } catch {
    return null
  }
}

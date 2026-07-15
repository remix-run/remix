import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const baseUrl = 'http://localhost'
const htmlTagPattern = /<(?:[^>"']|"[^"]*"|'[^']*')+>/g
const htmlUrlAttributePattern =
  /\b(href|src|action|formaction|poster|rmx-src|base-url|bundle-path)(\s*=\s*)(["'])(.*?)\3/gi
const remixDataScriptPattern = /(<script\b[^>]*\bid=(["'])rmx-data\2[^>]*>)([\s\S]*?)(<\/script>)/g
const scriptExtensionPattern = /\.(?:tsx?|jsx|mts)$/

export function normalizeBasePath(basePath: string): string {
  basePath = basePath.trim()
  if (basePath === '') return ''

  let url = new URL(basePath, baseUrl)
  if (url.origin !== baseUrl || url.search !== '' || url.hash !== '') {
    throw new Error(`Base path must be a pathname, received: ${basePath}`)
  }

  return url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
}

export async function resetOutputDir(outputDir: string): Promise<void> {
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })
}

export function createStaticAssetHrefMap(
  assetHrefs: Iterable<string>,
  basePath = '',
): Map<string, string> {
  return new Map(
    Array.from(assetHrefs, (href) => [href, addBasePath(toStaticAssetHref(href), basePath)]),
  )
}

export function rewriteAssetHrefs(content: string, hrefMap: ReadonlyMap<string, string>): string {
  let entries = Array.from(hrefMap).sort(([left], [right]) => right.length - left.length)

  for (let [sourceHref, staticHref] of entries) {
    if (sourceHref !== staticHref) {
      content = content.split(sourceHref).join(staticHref)
    }
  }

  return content
}

export function rewriteSiteHrefsInHtml(content: string, basePath: string): string {
  if (basePath === '') return content

  return content.replace(htmlTagPattern, (tag) =>
    tag.replace(
      htmlUrlAttributePattern,
      (_attribute, name: string, equals: string, quote: string, href: string) =>
        `${name}${equals}${quote}${addBasePath(href, basePath)}${quote}`,
    ),
  )
}

export function rewriteRemixDataHrefs(content: string, basePath: string): string {
  if (basePath === '') return content

  return content.replace(
    remixDataScriptPattern,
    (_script, open: string, _quote: string, json: string, close: string) => {
      let data: unknown = JSON.parse(json)
      if (!isRecord(data)) return `${open}${json}${close}`

      rewriteCollectionHrefs(data.h, 'moduleUrl', basePath)
      rewriteCollectionHrefs(data.f, 'src', basePath)
      return `${open}${JSON.stringify(data)}${close}`
    },
  )
}

export function rewriteSiteHrefsInCss(content: string, basePath: string): string {
  if (basePath === '') return content

  return content.replace(
    /(url\(\s*)(["']?)(\/(?!\/)[^"'()]*?)\2(\s*\))/g,
    (_url, open: string, quote: string, href: string, close: string) =>
      `${open}${quote}${addBasePath(href, basePath)}${quote}${close}`,
  )
}

export function getAssetOutputPath(outputDir: string, staticHref: string, basePath = ''): string {
  let pathname = new URL(staticHref, baseUrl).pathname

  if (basePath !== '') {
    if (pathname === basePath) {
      pathname = '/'
    } else if (pathname.startsWith(`${basePath}/`)) {
      pathname = pathname.slice(basePath.length)
    } else {
      throw new Error(`Asset href is outside the configured base path: ${staticHref}`)
    }
  }

  return path.join(outputDir, pathname.replace(/^\/+/, ''))
}

export function getPageOutputPath(outputDir: string, pathname: string): string {
  let normalizedPathname = new URL(pathname, baseUrl).pathname.replace(/^\/+|\/+$/g, '')
  return path.join(outputDir, normalizedPathname, 'index.html')
}

function toStaticAssetHref(href: string): string {
  let url = new URL(href, baseUrl)
  url.pathname = url.pathname.replace(scriptExtensionPattern, '.js')
  return `${url.pathname}${url.search}`
}

function addBasePath(href: string, basePath: string): string {
  if (basePath === '' || !href.startsWith('/') || href.startsWith('//')) return href
  if (href === basePath || href.startsWith(`${basePath}/`)) return href
  return href === '/' ? `${basePath}/` : `${basePath}${href}`
}

function rewriteCollectionHrefs(collection: unknown, key: string, basePath: string): void {
  if (!isRecord(collection)) return

  for (let value of Object.values(collection)) {
    if (!isRecord(value) || typeof value[key] !== 'string') continue
    value[key] = addBasePath(value[key], basePath)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

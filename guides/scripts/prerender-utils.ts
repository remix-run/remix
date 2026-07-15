import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const baseUrl = 'http://localhost'
const scriptExtensionPattern = /\.(?:tsx?|jsx|mts)$/

export async function resetOutputDir(outputDir: string): Promise<void> {
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.mkdir(outputDir, { recursive: true })
}

export function createStaticAssetHrefMap(assetHrefs: Iterable<string>): Map<string, string> {
  return new Map(Array.from(assetHrefs, (href) => [href, toStaticAssetHref(href)]))
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

export function getAssetOutputPath(outputDir: string, staticHref: string): string {
  let pathname = new URL(staticHref, baseUrl).pathname
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

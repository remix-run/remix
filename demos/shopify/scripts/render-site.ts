import { cp, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { parse } from 'node-html-parser'

import { pagePaths } from '../app/data/pages.ts'
import { publicDirectory, router } from '../app/router.ts'
import { routes } from '../app/routes.ts'

const assetBase = routes.assets.href({ path: '' })

// Workaround: Cloudflare Workers Static Assets re-encodes each path segment with
// `encodeURIComponent` and 307-redirects any request whose path changes. Fingerprinted asset URLs
// from remix/assets contain `.@` (for example `styles.@abc123.css`), and `@` encodes to `%40`, so
// every asset would cost an extra round trip and miss its `_headers` cache rule. The export writes
// the already-encoded `.%40` form into its HTML, CSS, and `_headers` instead. The files keep their
// `@` names because Cloudflare decodes the path before looking them up. Remove this once
// https://github.com/remix-run/remix/pull/12112 lands; it switches remix/assets to `.~`, which
// `encodeURIComponent` leaves unchanged (this rewrite only matches `.@`, so it becomes a no-op).
const fingerprintSeparator = new RegExp(`(${assetBase}[^\\s"'()]*?)\\.@`, 'g')

function encodeFingerprintSeparators(text: string): string {
  return text.replace(fingerprintSeparator, '$1.%40')
}

export async function renderSite(
  outputDirectory: string,
  fetchPage: (request: Request) => Response | Promise<Response> = router.fetch,
): Promise<number> {
  outputDirectory = path.resolve(outputDirectory)
  await mkdir(path.dirname(outputDirectory), { recursive: true })
  let stagingDirectory = await mkdtemp(path.join(path.dirname(outputDirectory), '.prerender-'))
  let documents = new Map<string, ReturnType<typeof parse>>()
  let origin = 'http://shopify-demo.local'

  try {
    await cp(publicDirectory, stagingDirectory, { recursive: true })

    let assetCacheControl = new Map<string, string | null>()

    function resolveOutput(pathname: string, referrer: string) {
      let file = path.resolve(stagingDirectory, `.${decodeURIComponent(pathname)}`)
      if (!file.startsWith(stagingDirectory + path.sep)) {
        throw new Error(`Asset outside the output directory on ${referrer}: ${pathname}`)
      }
      return file
    }

    // Writes an asset server response to the export, along with the files its CSS references.
    async function exportAsset(url: URL, referrer: string): Promise<void> {
      if (assetCacheControl.has(url.pathname)) return
      let response = await fetchPage(new Request(url))
      if (response.status !== 200) {
        throw new Error(`Missing local page or asset on ${referrer}: ${url.pathname}`)
      }
      assetCacheControl.set(url.pathname, response.headers.get('Cache-Control'))
      let destination = resolveOutput(url.pathname, referrer)
      await mkdir(path.dirname(destination), { recursive: true })
      if (!response.headers.get('Content-Type')?.includes('text/css')) {
        await writeFile(destination, new Uint8Array(await response.arrayBuffer()))
        return
      }
      let css = await response.text()
      await writeFile(destination, encodeFingerprintSeparators(css))
      for (let match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
        let reference = new URL(match[2], url)
        if (reference.origin === origin) await exportAsset(reference, url.pathname)
      }
    }

    for (let pathname of pagePaths) {
      let response = await fetchPage(new Request(new URL(pathname, origin)))
      if (response.status !== 200 || !response.headers.get('Content-Type')?.includes('text/html')) {
        throw new Error(
          `Cannot prerender ${pathname}: expected HTML with status 200, got ${response.status}`,
        )
      }
      let html = await response.text()
      documents.set(pathname, parse(html))
      let destination = path.join(stagingDirectory, pathname.slice(1), 'index.html')
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, encodeFingerprintSeparators(html))
    }

    let notFound = await fetchPage(new Request(new URL('/__not-found__', origin)))
    if (notFound.status !== 404) throw new Error('Expected a 404 response for the missing page')
    let notFoundHtml = await notFound.text()
    await writeFile(
      path.join(stagingDirectory, '404.html'),
      encodeFingerprintSeparators(notFoundHtml),
    )

    for (let [pathname, document] of [...documents, ['/404.html', parse(notFoundHtml)] as const]) {
      let references = document
        .querySelectorAll('a[href], link[href], [src], [srcset], [data-src], [poster]')
        .flatMap((element) => {
          let references = ['href', 'src', 'data-src', 'poster'].flatMap((attribute) => {
            let reference = element.getAttribute(attribute)
            return reference ? [reference] : []
          })
          let candidates = (element.getAttribute('srcset') ?? '')
            .split(',')
            .map((candidate) => candidate.trim().split(/\s+/)[0])
          return [...references, ...candidates]
        })
      for (let reference of references) {
        if (!reference) continue
        let url = new URL(reference, new URL(pathname, origin))
        if (url.origin !== origin) continue
        let targetPath = url.pathname.replace(/\/+$/, '') || '/'
        let targetDocument = documents.get(targetPath)
        if (targetDocument) {
          if (url.hash && !targetDocument.getElementById(decodeURIComponent(url.hash.slice(1)))) {
            throw new Error(`Broken fragment on ${pathname}: ${reference}`)
          }
        } else if (url.pathname.startsWith(assetBase)) {
          await exportAsset(url, pathname)
        } else {
          let file = await stat(resolveOutput(url.pathname, pathname)).catch(() => undefined)
          if (!file?.isFile()) {
            throw new Error(`Missing local page or asset on ${pathname}: ${reference}`)
          }
        }
      }
    }

    // Cloudflare Workers Static Assets reads cache rules from `_headers`, so fingerprinted assets
    // keep the asset server's long-lived Cache-Control header after export.
    let headerRules = [...assetCacheControl]
      .filter(([, cacheControl]) => cacheControl)
      .map(
        ([pathname, cacheControl]) =>
          `${encodeFingerprintSeparators(pathname)}\n  Cache-Control: ${cacheControl}\n`,
      )
    if (headerRules.length > 0) {
      await writeFile(path.join(stagingDirectory, '_headers'), headerRules.join(''))
    }

    // Publish only after every page and its local links have passed validation.
    await rm(outputDirectory, { recursive: true, force: true })
    await rename(stagingDirectory, outputDirectory)
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }

  return pagePaths.length
}

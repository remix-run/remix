import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import * as path from 'node:path'
import { transform } from 'esbuild'
import { parse } from 'node-html-parser'

import { publicDirectory, router } from '../app/router.ts'
import { pagePaths } from '../app/data/pages.ts'

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
    for (let filename of await readdir(stagingDirectory)) {
      let extension = path.extname(filename)
      if (extension !== '.css' && extension !== '.js') continue
      let file = path.join(stagingDirectory, filename)
      let { code } = await transform(await readFile(file, 'utf8'), {
        loader: extension === '.css' ? 'css' : 'js',
        minify: true,
      })
      await writeFile(file, code)
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
      await writeFile(destination, html)
    }

    for (let [pathname, document] of documents) {
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
        } else {
          let assetPath = path.resolve(stagingDirectory, `.${url.pathname}`)
          if (!assetPath.startsWith(stagingDirectory + path.sep)) {
            throw new Error(`Asset outside the output directory on ${pathname}: ${reference}`)
          }
          let file = await stat(assetPath).catch(() => undefined)
          if (!file?.isFile()) {
            throw new Error(`Missing local page or asset on ${pathname}: ${reference}`)
          }
        }
      }
    }

    let notFound = await fetchPage(new Request(new URL('/__not-found__', origin)))
    if (notFound.status !== 404) throw new Error('Expected a 404 response for the missing page')
    await writeFile(path.join(stagingDirectory, '404.html'), await notFound.text())
    // Publish only after every page and its local links have passed validation.
    await rm(outputDirectory, { recursive: true, force: true })
    await rename(stagingDirectory, outputDirectory)
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }

  return pagePaths.length
}

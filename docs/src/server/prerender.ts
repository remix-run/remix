import { parse } from 'node-html-parser'
import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { type Router } from 'remix/router'
import * as semver from 'semver'
import { assetServer } from './asset-server.ts'
import { createMatcher } from 'remix/route-pattern/match'
import { createRouter, getDefaultVersions } from './router.tsx'
import { routes } from './routes.ts'
import type { Versions } from './view.tsx'

let docsMatcher = createMatcher(routes.docs.pattern)

let { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: 'build/site',
    },
  },
})

const publicDir = path.join(process.cwd(), 'build', 'public')
const outputDir = path.join(process.cwd(), cliArgs.dir)
const versions = await getVersionsToBuild()
console.log('Prerendering versions:\n', JSON.stringify(versions, null, 2))

const docsRouter = createRouter(versions)

// Copy public files (favicons, wordmarks) to the output root. URLs are
// unversioned so a single copy at the output root covers every version.
await fs.cp(publicDir, outputDir, { recursive: true })

await spider(
  docsRouter,
  outputDir,
  new Set([
    '/',
    '/api.json',
    ...(versions
      ?.filter((v) => v.crawl)
      .flatMap((v) => [`/${v.version}/api.json`, `/${v.version}/`]) || []),
  ]),
)

// GitHub Pages serves `.ts`/`.tsx`/`.jsx`/`.mts` with a non-JS MIME type, which
// browsers refuse to execute as ES modules. Rename emitted source files to
// `.js` and rewrite extension-bearing URL references in HTML/JS to match.
await rewriteScriptExtensionsToJs(outputDir)

// Release the asset server's file watcher so the process can exit cleanly.
await assetServer.close()

// Spider the website served by router, beginning at /
async function spider(router: Router, outputDir: string, urlQueue = new Set(['/'])) {
  await fs.mkdir(outputDir, { recursive: true })

  // Track URLs we have already downloaded to avoid loops
  let downloadedUrls = new Set<string>()

  for (let urlPath of urlQueue) {
    if (urlPath && !downloadedUrls.has(urlPath)) {
      let { downloadedUrl, discoveredUrls } = await crawl(router, urlPath, outputDir)
      downloadedUrls.add(downloadedUrl)
      discoveredUrls
        .filter((href) => !downloadedUrls.has(href))
        .forEach((href) => urlQueue.add(href))
    }
  }

  console.log(`\nCrawling complete!`)
}

async function crawl(router: Router, urlPath: string, outputDir: string) {
  let response
  try {
    response = await router.fetch(new Request(`http://localhost${urlPath}`))
    if (!response.ok) {
      throw new Error(`Error fetching ${urlPath}: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.error('Error fetching', urlPath)
    throw error
  }

  let isHtmlFile = response.headers.get('Content-Type')?.includes('text/html')

  // Always put `index.html` files into directories - this leads to the best
  // support with and without trailing slashes on github pages:
  // https://github.com/slorber/trailing-slash-guide?tab=readme-ov-file#summary
  let outputPath = isHtmlFile
    ? path.join(outputDir, urlPath, 'index.html')
    : path.join(outputDir, urlPath)

  console.log(`Crawled ${urlPath} -> ./${path.relative(process.cwd(), outputPath)}`)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  if (isHtmlFile) {
    let html = await response.text()
    await fs.writeFile(outputPath, html, 'utf-8')

    let parsedHtml = parse(html, { comment: true })

    // <script src> and <link rel="modulepreload"> are resource fetches, not
    // link-graph edges — always follow so transitive asset URLs are
    // materialized even on pages that opt out of anchor crawling via
    // <meta name="robots" content="nofollow"> (demo and package-overview pages).
    let resourceHrefs = [
      ...parsedHtml
        .querySelectorAll('link[rel="modulepreload"]')
        .map((el) => el.getAttribute('href')),
      ...parsedHtml.querySelectorAll('script[src]').map((el) => el.getAttribute('src')),
    ]
      .filter((href): href is string => !!href && !isAbsoluteUrl(href))
      .map((href) => resolveRelativeLink(href, urlPath))

    // Honor `<meta name="robots" content="nofollow">` (e.g. on package
    // overview pages) by skipping anchor discovery. Per-link `rel="nofollow"`
    // is filtered separately in the selector below.
    let robots = parsedHtml.querySelector('meta[name="robots"]')?.getAttribute('content') || ''
    let noFollow = robots
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes('nofollow')

    if (noFollow) {
      return { downloadedUrl: urlPath, discoveredUrls: resourceHrefs }
    }

    // Parse HTML files for other resources/links to add to queue
    let anchorHrefs = parsedHtml
      .querySelectorAll(
        'a:not([rel="nofollow"]),link:not([rel="preload"]):not([rel="prefetch"]):not([rel="modulepreload"])',
      )
      .map((link) => link.getAttribute('href'))
      .filter((href): href is string => !!href && !isAbsoluteUrl(href))
      .map((href) => resolveRelativeLink(href, urlPath))
      .flatMap((href) => {
        let match = docsMatcher.match(`http://localhost${href}`)
        return match ? [href, routes.markdown.href(match.params)] : [href]
      })

    return {
      downloadedUrl: urlPath,
      discoveredUrls: [...resourceHrefs, ...anchorHrefs],
    }
  } else {
    let content = await response.arrayBuffer()
    await fs.writeFile(outputPath, new Uint8Array(content))
    return { downloadedUrl: urlPath, discoveredUrls: [] }
  }
}

async function rewriteScriptExtensionsToJs(rootDir: string): Promise<void> {
  let scriptFiles: string[] = []
  let htmlFiles: string[] = []

  async function walk(dir: string) {
    for (let entry of await fs.readdir(dir, { withFileTypes: true })) {
      let full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (/\.(?:tsx?|jsx|mts)$/.test(entry.name)) {
        scriptFiles.push(full)
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(full)
      }
    }
  }
  await walk(rootDir)

  let extInPath = /\.(?:tsx?|jsx|mts)(?=[?#]|$)/

  // JS files: rewrite extensions in import-specifier strings. Imports always
  // appear as quoted strings, so the lookahead pins the match to string
  // terminators / URL-suffix chars only.
  let extInJsImport = /\.(?:tsx?|jsx|mts)(?=["'?#])/g
  for (let file of scriptFiles) {
    let content = await fs.readFile(file, 'utf-8')
    let rewritten = content.replace(extInJsImport, '.js')
    if (rewritten !== content) await fs.writeFile(file, rewritten, 'utf-8')
  }

  // HTML files: parse and rewrite *only* the asset attributes view.tsx emits,
  // plus inline <script> bodies (clientEntry's hydration JSON carries module
  // URLs as `"moduleUrl":"/assets/.../foo.tsx"` strings). A regex over the
  // whole document would also hit the `View Source` <a href> on
  // github.com/.../basic.demo.tsx and code examples inside <pre>/<code>
  // blocks.
  let htmlAssetTargets = [
    { selector: 'script[src]', attr: 'src' },
    { selector: 'link[rel="modulepreload"]', attr: 'href' },
  ]
  for (let file of htmlFiles) {
    let html = await fs.readFile(file, 'utf-8')
    // Preserve comments so Remix UI's hydration markers (`<!-- rmx:h:* -->`,
    // `<!-- /rmx:h -->`, `<!-- rmx:flush document -->`) survive the
    // parse/serialize round-trip. Without them, frame navigation fails with
    // a "Can't insert an element before a doctype" HierarchyRequestError.
    let dom = parse(html, { comment: true })
    let changed = false
    for (let { selector, attr } of htmlAssetTargets) {
      for (let el of dom.querySelectorAll(selector)) {
        let v = el.getAttribute(attr)
        if (!v) continue
        let next = v.replace(extInPath, '.js')
        if (next === v) continue
        el.setAttribute(attr, next)
        changed = true
      }
    }
    for (let el of dom.querySelectorAll('script:not([src])')) {
      let body = el.innerHTML
      let next = body.replace(extInJsImport, '.js')
      if (next === body) continue
      el.set_content(next, { comment: true })
      changed = true
    }
    if (changed) await fs.writeFile(file, dom.toString(), 'utf-8')
  }

  for (let file of scriptFiles) {
    await fs.rename(file, file.replace(/\.(?:tsx?|jsx|mts)$/, '.js'))
  }
}

function isAbsoluteUrl(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')
}

function resolveRelativeLink(link: string, url: string): string {
  if (link.startsWith('/')) {
    return link
  }

  // Handle relative paths like '../' or 'page'
  let base = url.endsWith('/') ? url : path.dirname(url)
  return path.posix.join(base, link)
}

async function getVersionsToBuild(): Promise<Versions> {
  // Get all Remix v3 tags, transform them to vX.Y.Z format, sort newest to oldest
  const remixVersions = cp
    .execSync('git tag', { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter((tag) => tag.startsWith('remix@3'))
    .map((tag) => tag.replace('remix@', 'v'))
    .filter((tag) => semver.valid(tag) && !semver.prerelease(tag))
    .sort((a, b) => semver.rcompare(a, b))

  // Crawl only the most recent tag
  return remixVersions.length > 0
    ? remixVersions.map((tag, i) => ({ version: tag, crawl: i === 0 }))
    : getDefaultVersions()
}

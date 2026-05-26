import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'
import { createMatcher } from 'remix/route-pattern/match'
import * as semver from 'semver'
import { assetServer } from '../server/asset-server.ts'
import { createRouter, getDefaultVersions } from '../server/router.tsx'
import { routes } from '../server/routes.ts'
import type { Versions } from '../server/view.tsx'
import { crawl } from './crawl.ts'
import { parse } from './html-parser.ts'

let docsMatcher = createMatcher(routes.docs.pattern)
let markdownMatcher = createMatcher(routes.markdown.pattern)

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
const SCRIPT_FILE_EXT = /\.(?:tsx?|jsx|mts)$/
const SCRIPT_EXT_IN_PATH = /\.(?:tsx?|jsx|mts)(?=[?#]|$)/
const SCRIPT_EXT_IN_JS_IMPORT = /\.(?:tsx?|jsx|mts)(?=["'?#])/g

const versions = await getVersionsToBuild()
console.log('Prerendering versions:\n', JSON.stringify(versions, null, 2))

const docsRouter = createRouter(versions)

// Copy public files (favicons, wordmarks) to the output root. URLs are
// unversioned so a single copy at the output root covers every version.
await fs.cp(publicDir, outputDir, { recursive: true })

// First pass: spider the site and collect markdown variant paths
let paths = [
  '/',
  '/api.json',
  ...(versions
    ?.filter((v) => v.crawl)
    .flatMap((v) => [`/${v.version}/api.json`, `/${v.version}/`]) || []),
]
let variantPaths: string[] = []
for await (let { pathname, filepath, response } of crawl(docsRouter, { paths })) {
  await writeResult(pathname, filepath, response)
  let url = `http://localhost${pathname}`
  let match = docsMatcher.match(url)
  if (match && !markdownMatcher.match(url)) {
    variantPaths.push(routes.markdown.href(match.params))
  }
}

// Second pass: fetch variant paths without spidering
for await (let { pathname, filepath, response } of crawl(docsRouter, {
  paths: variantPaths,
  spider: false,
})) {
  await writeResult(pathname, filepath, response)
}

// Release the asset server's file watcher so the process can exit cleanly.
await assetServer.close()

async function writeResult(pathname: string, filepath: string, response: Response) {
  let outputFilepath = SCRIPT_FILE_EXT.test(filepath)
    ? filepath.replace(SCRIPT_FILE_EXT, '.js')
    : filepath
  let outputPath = path.join(outputDir, outputFilepath)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  // GitHub Pages serves `.ts`/`.tsx`/`.jsx`/`.mts` with a non-JS MIME type, which
  // browsers refuse to execute as ES modules. HTML URL references, JS import
  // strings, and emitted script filenames are rewritten in `writeResult` before
  // anything is written to disk.
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    let html = await response.text()
    await fs.writeFile(outputPath, rewriteHtmlScriptExtensionsToJs(html), 'utf-8')
  } else if (SCRIPT_FILE_EXT.test(filepath)) {
    let content = await response.text()
    await fs.writeFile(outputPath, content.replace(SCRIPT_EXT_IN_JS_IMPORT, '.js'), 'utf-8')
  } else {
    await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))
  }

  console.log(`Crawled ${pathname} -> ./${path.relative(process.cwd(), outputPath)}`)
}

function rewriteHtmlScriptExtensionsToJs(html: string): string {
  // Parse and rewrite *only* link/script asset attributes, plus inline
  // <script> bodies (clientEntry's hydration JSON carries module URLs as
  // `"moduleUrl":"/assets/.../foo.tsx"` strings). A regex over the whole
  // document would also hit the `View Source` <a href> on
  // github.com/.../basic.demo.tsx and code examples inside <pre>/<code>
  // blocks.
  //
  // Preserve comments so Remix UI's hydration markers (`<!-- rmx:h:* -->`,
  // `<!-- /rmx:h -->`, `<!-- rmx:flush document -->`) survive the
  // parse/serialize round-trip. Without them, frame navigation fails with
  // a "Can't insert an element before a doctype" HierarchyRequestError.
  let dom = parse(html, { comment: true })
  let changed = false

  for (let el of dom.elements) {
    if (el.name === 'script') {
      let src = el.getAttribute('src')
      if (src) {
        let next = src.replace(SCRIPT_EXT_IN_PATH, '.js')
        if (next !== src) {
          el.setAttribute('src', next)
          changed = true
        }
        continue
      }

      let body = el.innerHTML
      let next = body.replace(SCRIPT_EXT_IN_JS_IMPORT, '.js')
      if (next !== body) {
        el.innerHTML = next
        changed = true
      }
      continue
    }

    if (el.name === 'link') {
      let href = el.getAttribute('href')
      if (!href) continue

      let next = href.replace(SCRIPT_EXT_IN_PATH, '.js')
      if (next === href) continue

      el.setAttribute('href', next)
      changed = true
    }
  }

  return changed ? dom.toString() : html
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

import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as util from 'node:util'

import { loadDocsChapterSummaries } from '../app/actions/docs/markdown-chapters.tsx'
import { readMarkdownFrameReferences } from '../app/actions/docs/markdown/frames.ts'
import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'
import { assetServer } from '../app/utils/assets.ts'
import {
  createStaticAssetHrefMap,
  getAssetOutputPath,
  getPageOutputPath,
  resetOutputDir,
  rewriteAssetHrefs,
} from './prerender-utils.ts'

const guidesDir = path.resolve(import.meta.dirname, '..')
const publicDir = path.join(guidesDir, 'public')
const defaultOutputDir = path.join(guidesDir, 'build', 'site')
const browserEntryPatterns = [
  'app/**/*.browser.ts',
  'app/**/*.browser.tsx',
  'app/**/*.demo.ts',
  'app/**/*.demo.tsx',
]
const textContentTypes = [
  'application/javascript',
  'application/json',
  'application/xml',
  'image/svg+xml',
  'text/',
]

const { values: cliArgs } = util.parseArgs({
  options: {
    dir: {
      type: 'string',
      short: 'd',
      default: defaultOutputDir,
    },
  },
})

const outputDir = path.resolve(guidesDir, cliArgs.dir)

try {
  await prerender()
} finally {
  await assetServer.close()
}

async function prerender() {
  await resetOutputDir(outputDir)
  await fs.cp(publicDir, outputDir, { recursive: true })

  let [{ documentPaths, framePaths }, browserEntries] = await Promise.all([
    discoverPagePaths(),
    discoverBrowserEntries(),
  ])
  let stylesheet = path.join(guidesDir, 'app', 'styles', 'docs.css')
  let assetHrefs = await assetServer.getPreloads([...browserEntries, stylesheet])
  let hrefMap = createStaticAssetHrefMap(assetHrefs)

  console.log(
    `Prerendering ${documentPaths.length + framePaths.length} pages and ${assetHrefs.length} assets to ${
      path.relative(process.cwd(), outputDir) || '.'
    }`,
  )

  for (let pathname of documentPaths) {
    await writePage(pathname, hrefMap)
  }

  let writtenAssetPaths = new Map<string, string>()
  for (let href of assetHrefs) {
    let staticHref = hrefMap.get(href)
    if (staticHref === undefined) {
      throw new Error(`Missing static href for asset: ${href}`)
    }

    let outputPath = getAssetOutputPath(outputDir, staticHref)
    let existingHref = writtenAssetPaths.get(outputPath)
    if (existingHref !== undefined && existingHref !== href) {
      throw new Error(`Asset output collision between ${existingHref} and ${href}: ${outputPath}`)
    }

    writtenAssetPaths.set(outputPath, href)
    await writeAsset(href, staticHref, outputPath, hrefMap)
  }

  await buildSearchIndex()

  for (let pathname of framePaths) {
    await writePage(pathname, hrefMap)
  }

  console.log(`Prerendered guides site at ${outputDir}`)
}

async function discoverPagePaths() {
  let chapters = await loadDocsChapterSummaries()
  let documentPaths = [routes.docs.index.href(), ...chapters.map((chapter) => chapter.href)].sort()
  let framePaths = new Set<string>()
  let chaptersDir = path.join(guidesDir, 'app', 'actions', 'docs', 'chapters')

  for await (let chapterFile of fs.glob('*.md', { cwd: chaptersDir })) {
    let source = await fs.readFile(path.join(chaptersDir, chapterFile), 'utf8')
    for (let frame of readMarkdownFrameReferences(source)) {
      framePaths.add(frame.src)
    }
  }

  return { documentPaths, framePaths: Array.from(framePaths).sort() }
}

async function discoverBrowserEntries(): Promise<string[]> {
  let entries = new Set<string>()

  for (let pattern of browserEntryPatterns) {
    for await (let entry of fs.glob(pattern, { cwd: guidesDir })) {
      if (entry.includes('.test.') || path.basename(entry).startsWith('dev-refresh.browser.')) {
        continue
      }
      entries.add(path.join(guidesDir, entry))
    }
  }

  return Array.from(entries).sort()
}

async function writePage(pathname: string, hrefMap: ReadonlyMap<string, string>) {
  let response = await fetchFromRouter(pathname)
  let contentType = response.headers.get('Content-Type')
  if (!contentType?.includes('text/html')) {
    throw new Error(
      `Expected an HTML response for ${pathname}, received ${contentType ?? 'unknown'}`,
    )
  }

  let outputPath = getPageOutputPath(outputDir, pathname)
  let html = rewriteAssetHrefs(await response.text(), hrefMap)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, html, 'utf8')
  console.log(`Prerendered ${pathname} -> ${relativeOutputPath(outputPath)}`)
}

async function writeAsset(
  href: string,
  staticHref: string,
  outputPath: string,
  hrefMap: ReadonlyMap<string, string>,
) {
  let response = await fetchFromRouter(href)
  let contentType = response.headers.get('Content-Type') ?? ''
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  if (textContentTypes.some((type) => contentType.includes(type))) {
    let content = rewriteAssetHrefs(await response.text(), hrefMap)
    await fs.writeFile(outputPath, content, 'utf8')
  } else {
    await fs.writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))
  }

  if (href !== staticHref) {
    console.log(`Prerendered ${href} -> ${relativeOutputPath(outputPath)}`)
  }
}

async function buildSearchIndex() {
  let pagefindOutputDir = path.join(outputDir, 'assets', 'pagefind')
  await fs.rm(pagefindOutputDir, { recursive: true, force: true })

  cp.execFileSync(
    'pnpm',
    ['exec', 'pagefind', '--site', outputDir, '--output-subdir', pagefindOutputDir],
    { stdio: 'inherit' },
  )
}

async function fetchFromRouter(href: string): Promise<Response> {
  let response = await router.fetch(new Request(new URL(href, 'http://localhost')))
  if (!response.ok) {
    throw new Error(`Unable to prerender ${href}: ${response.status} ${response.statusText}`)
  }
  return response
}

function relativeOutputPath(outputPath: string): string {
  return `./${path.relative(process.cwd(), outputPath)}`
}

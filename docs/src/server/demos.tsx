import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import * as prettier from 'prettier'
import type { RemixNode } from 'remix/ui'
import { codeToHtml } from 'shiki'
import ts from 'typescript'
import { hasRemixPackage, mapToRemixPackage } from '../generate/manifest.ts'
import type { DocsAssetServer } from './asset-server.ts'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const DEMO_BUILD_DIR = path.join(DOCS_DIR, 'build', 'demos')
const SOURCE_URL_BASE = 'https://github.com/remix-run/remix/blob/main'

export type DemoDocFile = {
  kind: 'demo'
  assetHref: string
  description: string
  importHref: string
  name: string
  order: number
  package: string
  path: string
  preloads: readonly string[]
  relativePath: string
  slug: string
  source: string
  sourceUrl: string
  urlPath: string
}

export async function discoverDemoFiles(assetServer: DocsAssetServer): Promise<DemoDocFile[]> {
  if (!fs.existsSync(DEMO_BUILD_DIR)) {
    throw new Error(
      `Demo build directory not found: ${DEMO_BUILD_DIR}. Run "pnpm build:demos" first.`,
    )
  }

  let demoPaths = walkBuiltDemos(DEMO_BUILD_DIR).sort()
  let demoFiles = await Promise.all(demoPaths.map((demoPath) => getDemoFile(demoPath, assetServer)))

  let seenUrls = new Map<string, string>()
  for (let demo of demoFiles) {
    let existingPath = seenUrls.get(demo.urlPath)
    if (existingPath) {
      throw new Error(
        `Duplicate demo url path "${demo.urlPath}" for "${existingPath}" and "${demo.relativePath}"`,
      )
    }
    seenUrls.set(demo.urlPath, demo.relativePath)
  }

  return demoFiles.sort((a, b) => a.urlPath.localeCompare(b.urlPath))
}

export async function loadDemoComponent(
  demo: Pick<DemoDocFile, 'importHref' | 'slug'>,
): Promise<() => () => RemixNode> {
  let version = fs.statSync(new URL(demo.importHref)).mtimeMs.toString(36)
  let mod: unknown = await import(`${demo.importHref}?v=${version}`)

  if (!mod || typeof mod !== 'object' || !('default' in mod) || typeof mod.default !== 'function') {
    throw new Error(`Demo "${demo.slug}" must default export a component function`)
  }

  return mod.default as () => () => RemixNode
}

export async function renderDemoSource(source: string): Promise<string> {
  return await codeToHtml(source, {
    lang: 'tsx',
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  })
}

async function getDemoFile(filePath: string, assetServer: DocsAssetServer): Promise<DemoDocFile> {
  let parts = path.relative(DEMO_BUILD_DIR, filePath).split(path.sep)
  if (parts.length < 3 || !parts.at(-1)?.endsWith('.demo.tsx')) {
    throw new Error(`Invalid built demo location: ${filePath}`)
  }
  let packageSegment = parts[0]
  if (packageSegment !== 'ui' && packageSegment !== 'components') {
    throw new Error(`Invalid built demo package: ${filePath}`)
  }

  let slug = parts.at(-1)!.slice(0, -'.demo.tsx'.length)
  let moduleParts = parts.slice(1, -1)
  let packageSpecifier = getDemoPackageSpecifier(packageSegment, moduleParts, slug)
  let packageName = mapToRemixPackage(packageSpecifier)
  let relativePath = `packages/${packageSegment}/src/${parts.slice(1).join('/')}`

  let source = fs.readFileSync(filePath, 'utf-8')
  let { name, description, order, displaySource } = extractDemoMetadata(source, relativePath)
  let formattedSource = await formatDemoSource(displaySource, filePath)
  let [assetHref, preloads] = await Promise.all([
    assetServer.getHref(filePath),
    assetServer.getPreloads(filePath),
  ])
  let importHref = url.pathToFileURL(filePath).href

  await loadDemoComponent({ importHref, slug })

  return {
    kind: 'demo',
    assetHref,
    description,
    importHref,
    name,
    order,
    package: packageName,
    path: filePath,
    preloads,
    relativePath,
    slug,
    source: formattedSource,
    sourceUrl: `${SOURCE_URL_BASE}/${relativePath}`,
    urlPath: `${packageName}/demos/${slug}`,
  }
}

async function formatDemoSource(source: string, filePath: string): Promise<string> {
  let config = await prettier.resolveConfig(filePath)
  return await prettier.format(source, {
    ...config,
    filepath: filePath,
    printWidth: 80,
  })
}

function getDemoPackageSpecifier(
  packageSegment: string,
  moduleParts: string[],
  slug: string,
): string {
  let modulePath = moduleParts.filter((part) => part !== 'demos').join('/')
  let packageSpecifier = `@remix-run/${packageSegment}/${modulePath}`

  if (packageSegment === 'ui' && moduleParts[0] === 'components') {
    let primitivesSpecifier = `${packageSpecifier}/primitives`
    if (
      (slug === 'primitives' || !hasRemixPackage(packageSpecifier)) &&
      hasRemixPackage(primitivesSpecifier)
    ) {
      return primitivesSpecifier
    }
  }

  return packageSpecifier
}

function extractDemoMetadata(
  source: string,
  relativePath: string,
): { name: string; description: string; order: number; displaySource: string } {
  let sf = ts.createSourceFile('demo.tsx', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)

  for (let stmt of sf.statements) {
    let jsDocs = (stmt as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc
    if (!jsDocs) continue

    for (let jsDoc of jsDocs) {
      let name = readJsdocTag(jsDoc, 'name')
      if (!name) continue

      let description = readJsdocTag(jsDoc, 'description')
      if (!description) {
        throw new Error(`Demo "${relativePath}" is missing a required @description tag`)
      }

      let orderRaw = readJsdocTag(jsDoc, 'order')
      let order = orderRaw !== undefined ? parseInt(orderRaw, 10) : Infinity
      if (orderRaw !== undefined && !Number.isFinite(order)) {
        throw new Error(
          `Demo "${relativePath}" has an invalid @order value "${orderRaw}" — must be a number`,
        )
      }

      let stripStart = source.indexOf('/**', jsDoc.pos)
      let stripEnd = jsDoc.end
      if (source[stripEnd] === '\n') stripEnd++
      let displaySource = source.slice(0, stripStart) + source.slice(stripEnd)
      return { name, description, order, displaySource }
    }
  }

  throw new Error(
    `Demo "${relativePath}" is missing a JSDoc block with @name and @description tags`,
  )
}

function readJsdocTag(
  jsDoc: ts.JSDoc,
  tagName: 'name' | 'description' | 'order',
): string | undefined {
  let tag = jsDoc.tags?.find((t) => t.tagName.text === tagName)
  if (!tag) return undefined
  let comment = tag.comment
  let text =
    typeof comment === 'string'
      ? comment
      : Array.isArray(comment)
        ? comment.map((c) => c.text).join('')
        : ''
  let trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function walkBuiltDemos(directory: string): string[] {
  let files: string[] = []
  function recurse(dir: string) {
    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
      let p = path.join(dir, entry.name)
      if (entry.isDirectory()) recurse(p)
      else if (entry.name.endsWith('.demo.tsx')) files.push(p)
    }
  }
  recurse(directory)
  return files
}

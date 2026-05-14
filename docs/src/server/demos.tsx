import * as esbuild from 'esbuild'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import * as prettier from 'prettier'
import type { RemixNode } from 'remix/ui'
import { codeToHtml } from 'shiki'
import ts from 'typescript'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const UI_COMPONENTS_DIR = path.join(REPO_DIR, 'packages', 'ui', 'src', 'components')
const UI_PACKAGE_DIR = path.join(REPO_DIR, 'packages', 'ui')
const DEMO_BUILD_DIR = path.join(DOCS_DIR, 'build', 'demos')
const DEMO_ASSETS_DIR = path.join(DOCS_DIR, 'build', 'assets', 'demos')
const REMIX_UI_ASSET_PATH = path.join(DOCS_DIR, 'build', 'assets', 'remix-ui.js')
export const REMIX_UI_ASSET_HREF = '/assets/remix-ui.js'
const SOURCE_URL_BASE = 'https://github.com/remix-run/remix/blob/main'

const UI_PACKAGE_JSON = path.join(UI_PACKAGE_DIR, 'package.json')

export type DemoImportMap = { imports: Record<string, string> }

export type DemoDocFile = {
  kind: 'demo'
  assetHref: string
  description: string
  importHref: string
  name: string
  order: number
  package: string
  path: string
  relativePath: string
  slug: string
  source: string
  sourceUrl: string
  urlPath: string
}

export async function discoverDemoFiles(): Promise<{
  demoFiles: DemoDocFile[]
  importMap: DemoImportMap
}> {
  let importMap = await buildDemoImportMap()
  let demoPaths = walkDemoFiles(UI_COMPONENTS_DIR).sort()
  let demoFiles = await Promise.all(demoPaths.map((demoPath) => getDemoFile(demoPath)))

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

  return {
    demoFiles: demoFiles.sort((a, b) => a.urlPath.localeCompare(b.urlPath)),
    importMap,
  }
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

async function getDemoFile(filePath: string): Promise<DemoDocFile> {
  let relativePath = path.relative(REPO_DIR, filePath).split(path.sep).join('/')
  let rawSource = fs.readFileSync(filePath, 'utf-8')
  let rewrittenSource = rewriteDemoImports(rawSource)
  let slug = path.basename(filePath, '.demo.tsx')
  let packageName = getDemoPackageName(relativePath)
  let componentName = packageName.split('/').at(-1)!
  let { name, description, order, displaySource } = extractDemoMetadata(rewrittenSource, relativePath)
  let formattedSource = await formatDemoSource(displaySource, filePath)
  let [importHref, assetHref] = await Promise.all([
    compileDemoModule(rewrittenSource, packageName, slug),
    buildDemoAsset(filePath, rawSource, componentName, slug, relativePath),
  ])

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

async function compileDemoModule(
  source: string,
  packageName: string,
  slug: string,
): Promise<string> {
  let result = await esbuild.transform(source, {
    loader: 'tsx',
    jsx: 'automatic',
    jsxImportSource: 'remix/ui',
    format: 'esm',
    target: 'esnext',
  })
  let outDir = path.join(DEMO_BUILD_DIR, packageName.replace(/\//g, '__'))
  fs.mkdirSync(outDir, { recursive: true })
  let outPath = path.join(outDir, `${slug}.js`)
  let existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : null
  if (existing !== result.code) {
    fs.writeFileSync(outPath, result.code)
  }
  return url.pathToFileURL(outPath).href
}

async function buildDemoImportMap(): Promise<DemoImportMap> {
  // Discover all subpaths from @remix-run/ui's package.json exports.
  let uiPkg = JSON.parse(fs.readFileSync(UI_PACKAGE_JSON, 'utf-8')) as {
    exports: Record<string, unknown>
  }
  let subpaths = Object.keys(uiPkg.exports).filter(
    (k) => k !== './package.json' && k !== './server',
  )

  // Build a single shared bundle re-exporting all subpaths.
  let entryContents = subpaths
    .map((subpath) => {
      let specifier = subpath === '.' ? '@remix-run/ui' : `@remix-run/ui/${subpath.slice(2)}`
      return `export * from '${specifier}'`
    })
    .join('\n')

  await esbuild.build({
    stdin: {
      contents: entryContents,
      loader: 'ts',
      resolveDir: UI_PACKAGE_DIR,
    },
    bundle: true,
    format: 'esm',
    jsx: 'automatic',
    jsxImportSource: '@remix-run/ui',
    platform: 'browser',
    target: 'es2022',
    outfile: REMIX_UI_ASSET_PATH,
  })

  // Map every subpath specifier to the same shared bundle URL —
  // both @remix-run/ui/* (used by demo files) and remix/ui* (used by entry.js).
  let imports: Record<string, string> = {}
  for (let subpath of subpaths) {
    let rmxSpecifier = subpath === '.' ? '@remix-run/ui' : `@remix-run/ui/${subpath.slice(2)}`
    let remixSpecifier = subpath === '.' ? 'remix/ui' : `remix/ui/${subpath.slice(2)}`
    imports[rmxSpecifier] = REMIX_UI_ASSET_HREF
    imports[remixSpecifier] = REMIX_UI_ASSET_HREF
  }

  return { imports }
}

async function buildDemoAsset(
  filePath: string,
  rawSource: string,
  componentName: string,
  slug: string,
  relativePath: string,
): Promise<string> {
  // Fail fast if any @remix-run/ import isn't @remix-run/ui — those aren't
  // covered by the import map and the browser can't resolve them.
  let unsupported = [...rawSource.matchAll(/from\s+['"](@remix-run\/(?!ui)[^'"]+)['"]/g)]
  if (unsupported.length > 0) {
    let specifiers = unsupported.map((m) => m[1]).join(', ')
    throw new Error(
      `Demo "${relativePath}" imports from unsupported packages: ${specifiers}. ` +
        `Only @remix-run/ui/* imports are supported in demos.`,
    )
  }

  // Transform-only (no bundling) — @remix-run/ui/* imports are left as bare
  // specifiers for the browser to resolve via the import map.
  let result = await esbuild.transform(rawSource, {
    loader: 'tsx',
    jsx: 'automatic',
    jsxImportSource: '@remix-run/ui',
    format: 'esm',
    target: 'es2022',
  })

  let outDir = path.join(DEMO_ASSETS_DIR, componentName)
  fs.mkdirSync(outDir, { recursive: true })
  let outfile = path.join(outDir, `${slug}.js`)
  fs.writeFileSync(outfile, result.code)

  return `/assets/demos/${componentName}/${slug}.js`
}

function getDemoPackageName(relativePath: string) {
  let parts = relativePath.split('/')
  if (
    parts.length !== 7 ||
    parts[0] !== 'packages' ||
    parts[1] !== 'ui' ||
    parts[2] !== 'src' ||
    parts[3] !== 'components' ||
    parts[5] !== 'demos' ||
    !parts[6]?.endsWith('.demo.tsx')
  ) {
    throw new Error(`Invalid demo location: ${relativePath}`)
  }

  return `remix/ui/${parts[4]}`
}

function rewriteDemoImports(source: string): string {
  return source.replace(
    /(from\s+['"]|import\s*\(\s*['"])@remix-run\//g,
    (_match, prefix) => `${prefix}remix/`,
  )
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

function readJsdocTag(jsDoc: ts.JSDoc, tagName: 'name' | 'description' | 'order'): string | undefined {
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

function walkDemoFiles(directory: string): string[] {
  let files: string[] = []

  for (let entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    let absolutePath = path.join(directory, entry.name)

    if (entry.name === 'demos') {
      for (let demoEntry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (demoEntry.isFile() && demoEntry.name.endsWith('.demo.tsx')) {
          files.push(path.join(absolutePath, demoEntry.name))
        }
      }
      continue
    }

    files.push(...walkDemoFiles(absolutePath))
  }

  return files
}

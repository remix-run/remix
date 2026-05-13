import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import * as esbuild from 'esbuild'
import * as prettier from 'prettier'
import type { RemixNode } from 'remix/ui'
import { codeToHtml } from 'shiki'
import ts from 'typescript'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const UI_COMPONENTS_DIR = path.join(REPO_DIR, 'packages', 'ui', 'src', 'components')
const DEMO_BUILD_DIR = path.join(DOCS_DIR, 'build', 'demos')
const SOURCE_URL_BASE = 'https://github.com/remix-run/remix/blob/main'

export type DemoDocFile = {
  kind: 'demo'
  description: string
  importHref: string
  name: string
  package: string
  path: string
  relativePath: string
  slug: string
  source: string
  sourceUrl: string
  urlPath: string
}

export async function discoverDemoFiles(): Promise<DemoDocFile[]> {
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

async function getDemoFile(filePath: string): Promise<DemoDocFile> {
  let relativePath = path.relative(REPO_DIR, filePath).split(path.sep).join('/')
  let rawSource = fs.readFileSync(filePath, 'utf-8')
  let rewrittenSource = rewriteDemoImports(rawSource)
  let slug = path.basename(filePath, '.demo.tsx')
  let packageName = getDemoPackageName(relativePath)
  let { name, description, displaySource } = extractDemoMetadata(rewrittenSource, relativePath)
  let formattedSource = await formatDemoSource(displaySource, filePath)
  let importHref = await compileDemoModule(rewrittenSource, packageName, slug)

  await loadDemoComponent({ importHref, slug })

  return {
    kind: 'demo',
    description,
    importHref,
    name,
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
): { name: string; description: string; displaySource: string } {
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

      let stripStart = source.indexOf('/**', jsDoc.pos)
      let stripEnd = jsDoc.end
      if (source[stripEnd] === '\n') stripEnd++
      let displaySource = source.slice(0, stripStart) + source.slice(stripEnd)
      return { name, description, displaySource }
    }
  }

  throw new Error(
    `Demo "${relativePath}" is missing a JSDoc block with @name and @description tags`,
  )
}

function readJsdocTag(jsDoc: ts.JSDoc, tagName: 'name' | 'description'): string | undefined {
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
    let absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkDemoFiles(absolutePath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.demo.tsx')) {
      files.push(absolutePath)
    }
  }

  return files
}

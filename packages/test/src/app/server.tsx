import type { RemixNode } from '@remix-run/component/jsx-runtime'
import { renderToString } from '@remix-run/component/server'
import { createRouter } from '@remix-run/fetch-router'
import { createRequestListener } from '@remix-run/node-fetch-server'
import { init as initEsModuleLexer, parse as parseEsModule } from 'es-module-lexer'
import MagicString from 'magic-string'
import * as fsp from 'node:fs/promises'
import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'
import { getBrowserTestRootDir, IS_RUNNING_FROM_SRC } from '../lib/config.ts'
import { transformTypeScript } from '../lib/ts-transform.ts'
import { Tests } from './client/components.tsx'
import { routes } from './client/routes.ts'

export async function startServer(
  browserFiles: string[],
): Promise<{ server: http.Server; port: number }> {
  let router = getRouter(browserFiles)
  let handler = createRequestListener(async (req) => await router.fetch(req))
  let port = 44101

  let lastError: unknown
  for (let i = 0; i < 5; i++) {
    try {
      let server = http.createServer(handler)
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, () => {
          server.removeListener('error', reject)
          console.log(`Test server running on http://localhost:${port}`)
          resolve()
        })
      })
      return { server, port }
    } catch (error: any) {
      if (error.code !== 'EADDRINUSE') throw error
      lastError = error
      console.log(`Port ${port} is in use, trying another port...`)
      port += 1
    }
  }

  throw lastError
}

function getRouter(browserFiles: string[]) {
  let router = createRouter()

  let rootDir = getBrowserTestRootDir()
  let srcDir = IS_RUNNING_FROM_SRC
    ? // Up one directory from src/app/
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    : // Directory of the published index.js file
      path.dirname(fileURLToPath(import.meta.resolve('@remix-run/test')))
  let clientDir = path.join(srcDir, 'app', 'client')
  let scriptExt = IS_RUNNING_FROM_SRC ? 'ts' : 'js'
  let entryUrl = filePathToUrl(path.join(clientDir, `entry.${scriptExt}`), rootDir)
  let iframeUrl = filePathToUrl(path.join(clientDir, `iframe.${scriptExt}`), rootDir)
  if (!entryUrl || !iframeUrl) {
    throw new Error(`Harness scripts in ${clientDir} are outside rootDir ${rootDir}`)
  }

  let testPaths = browserFiles.map((f) => filePathToUrl(f, rootDir)!)

  router.get(routes.scripts, async ({ request, params }) => {
    if (!params.path) return new Response('Not found', { status: 404 })
    let urlPath = new URL(request.url).pathname
    let filePath = urlPathToFilePath(urlPath, rootDir)
    if (!filePath) return new Response('Not found', { status: 404 })
    try {
      return await serveScript(filePath, urlPath, rootDir)
    } catch (error) {
      console.error(`[remix-test] Error serving ${urlPath}:`, error)
      return new Response(String(error), { status: 500 })
    }
  })

  router.get(routes.home, async () =>
    html(
      <Doc title="Tests">
        <Tests setup={{ testPaths, baseDir: process.cwd() }} />
        <script type="module" src={entryUrl} />
      </Doc>,
    ),
  )

  router.get(routes.iframe, async ({ request }) => {
    let test = decodeURIComponent(new URL(request.url).searchParams.get('file') || '')
    return html(
      <Doc title={`Test: ${test}`}>
        <script type="module" src={iframeUrl} />
      </Doc>,
    )
  })

  return router
}

function filePathToUrl(filePath: string, rootDir: string): string | null {
  let rel = path.relative(rootDir, filePath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return '/scripts/' + rel.split(path.sep).join('/')
}

// `/scripts/<rel>` → `<rootDir>/<rel>` (URL space mirrors the filesystem
// rooted at rootDir, with `..` segments rejected so requests can't escape).
function urlPathToFilePath(urlPath: string, rootDir: string): string | null {
  if (!urlPath.startsWith('/scripts/')) return null
  let relative = urlPath.slice('/scripts/'.length)
  if (!relative) return null
  let filePath = path.resolve(rootDir, relative)
  if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) return null
  return filePath
}

const TS_EXTS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const JS_EXTS = new Set(['.js', '.mjs', '.cjs', '.jsx'])

async function serveScript(filePath: string, urlPath: string, rootDir: string): Promise<Response> {
  let ext = path.extname(filePath)
  let isTs = TS_EXTS.has(ext)
  let isJs = JS_EXTS.has(ext)
  if (!isTs && !isJs) {
    let body = await fsp.readFile(filePath)
    return new Response(body)
  }

  let source = await fsp.readFile(filePath, 'utf-8')
  let code: string
  if (isTs) {
    try {
      let result = await transformTypeScript(source, filePath)
      code = result.code
    } catch (error) {
      let msg = error instanceof Error ? error.message : String(error)
      console.error(`[remix-test] Failed to transform ${urlPath}: ${msg}`)
      return new Response(msg, { status: 500 })
    }
  } else {
    code = source
  }

  try {
    code = await rewriteImports(code, filePath, rootDir)
  } catch (error) {
    let msg = error instanceof Error ? error.message : String(error)
    console.error(`[remix-test] Failed to rewrite imports for ${urlPath}: ${msg}`)
    return new Response(msg, { status: 500 })
  }

  return new Response(code, {
    headers: { 'Content-Type': 'application/javascript' },
  })
}

// Rewrite every import/export specifier in the (already-transformed) source so
// it points at an absolute `/scripts/<rel>` URL the harness can serve. Bare
// specifiers go through Node's resolver; relative specifiers resolve against
// the importer file's directory. This keeps the URL space === filesystem
// layout so harness scripts (under clientDir) and source files (anywhere
// under rootDir) can import each other without URL-relative confusion.
//
// Uses es-module-lexer (purpose-built ESM scanner) + magic-string so that the
// edits compose cleanly with the inline TS→JS source map from
// transformTypeScript: the resulting inline map is a true rewrittenJS → TS
// map, not just the original TS → JS map slapped on top of mutated bytes.
async function rewriteImports(
  code: string,
  importerFile: string,
  rootDir: string,
): Promise<string> {
  await initEsModuleLexer

  let { code: codeNoMap, map: tsToJsMap } = extractInlineSourceMap(code)
  let [imports] = parseEsModule(codeNoMap)
  let s = new MagicString(codeNoMap)
  let edited = false

  for (let imp of imports) {
    // n is the parsed specifier value (with escapes resolved); undefined when
    // the dynamic import argument isn't a static string literal.
    if (imp.n == null) continue
    let url = resolveSpecifier(imp.n, importerFile, rootDir)
    if (url == null || url === imp.n) continue
    s.overwrite(imp.s, imp.e, url)
    edited = true
  }

  if (!edited) return code

  let rewrittenCode = s.toString()
  let rewriteMap = JSON.parse(s.generateMap({ hires: true }).toString())

  let finalMap = tsToJsMap ? composeSourceMaps(rewriteMap, tsToJsMap) : rewriteMap
  let mapJson = JSON.stringify(finalMap)
  let mapBase64 = Buffer.from(mapJson).toString('base64')
  return `${rewrittenCode}\n//# sourceMappingURL=data:application/json;base64,${mapBase64}`
}

// Strip the trailing `//# sourceMappingURL=data:application/json;base64,...`
// comment and decode the embedded JSON.
function extractInlineSourceMap(code: string): { code: string; map: unknown | null } {
  let re =
    /\n?\/\/# sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?[;,]base64,([A-Za-z0-9+/=]+)\s*$/
  let match = code.match(re)
  if (!match || match.index == null) return { code, map: null }
  try {
    let decoded = Buffer.from(match[1], 'base64').toString('utf-8')
    return { code: code.slice(0, match.index), map: JSON.parse(decoded) }
  } catch {
    return { code, map: null }
  }
}

// Compose two source maps so positions in `secondMap`'s generated code map all
// the way back to `firstMap`'s original sources. `secondMap`'s "original" must
// be in the same coordinate space as `firstMap`'s "generated" — i.e. for our
// case the input to magic-string is the output of transformTypeScript.
function composeSourceMaps(secondMap: unknown, firstMap: unknown): unknown {
  let secondConsumer = new SourceMapConsumer(secondMap as any)
  let firstConsumer = new SourceMapConsumer(firstMap as any)
  let gen = new SourceMapGenerator()

  secondConsumer.eachMapping((mapping) => {
    if (mapping.originalLine == null || mapping.originalColumn == null) return
    let original = firstConsumer.originalPositionFor({
      line: mapping.originalLine,
      column: mapping.originalColumn,
    })
    if (original.line == null || original.column == null || original.source == null) return
    gen.addMapping({
      generated: { line: mapping.generatedLine, column: mapping.generatedColumn },
      original: { line: original.line, column: original.column },
      source: original.source,
      name: original.name ?? mapping.name ?? undefined,
    })
  })

  for (let source of firstConsumer.sources) {
    let content = firstConsumer.sourceContentFor(source, true)
    if (content !== null) gen.setSourceContent(source, content)
  }

  return gen.toJSON()
}

function resolveSpecifier(spec: string, importerFile: string, rootDir: string): string | null {
  if (
    spec.startsWith('node:') ||
    spec.startsWith('http:') ||
    spec.startsWith('https:') ||
    spec.startsWith('data:') ||
    spec.startsWith('/scripts/')
  ) {
    return null
  }

  let resolvedPath: string
  if (spec.startsWith('.') || spec.startsWith('/')) {
    resolvedPath = path.resolve(path.dirname(importerFile), spec)
  } else {
    let importerUrl = pathToFileURL(importerFile).href
    let resolvedUrl: string
    try {
      resolvedUrl = import.meta.resolve(spec, importerUrl)
    } catch {
      return null
    }
    if (!resolvedUrl.startsWith('file://')) return null
    resolvedPath = fileURLToPath(resolvedUrl)
  }

  return filePathToUrl(resolvedPath, rootDir)
}

async function html(node: RemixNode) {
  return new Response(`<!DOCTYPE html>` + (await renderToString(node)), {
    headers: { 'Content-Type': 'text/html' },
  })
}

function Doc() {
  return ({ title, children }: { title: string; children: RemixNode }) => (
    <html>
      <head>
        <meta charset="utf-8" />
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}

import { init as initEsModuleLexer, parse as parseEsModule } from 'es-module-lexer'
import MagicString from 'magic-string'
import * as fsp from 'node:fs/promises'
import * as http from 'node:http'
import { createRequire } from 'node:module'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'
import { getBrowserTestRootDir, IS_RUNNING_FROM_SRC } from '../lib/config.ts'
import { transformTypeScript } from '../lib/ts-transform.ts'

export async function startServer(
  browserFiles: string[],
): Promise<{ server: http.Server; port: number }> {
  let handle = createRequestHandler(browserFiles)
  let port = 44101

  let lastError: unknown
  for (let i = 0; i < 5; i++) {
    try {
      let server = http.createServer((req, res) => {
        handle(req, res).catch((error) => {
          console.error(`[remix-test] Unhandled error for ${req.url}:`, error)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
          }
          if (!res.writableEnded) res.end()
        })
      })
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

function createRequestHandler(
  browserFiles: string[],
): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
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

  return async (req, res) => {
    let url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method !== 'GET') {
      sendText(res, 405, 'Method Not Allowed')
      return
    }

    if (url.pathname === '/') {
      let setupJson = JSON.stringify({ testPaths, baseDir: process.cwd() })
      let body =
        `<script type="application/json" id="test-setup">` +
        `${escapeJsonForScript(setupJson)}` +
        `</script>` +
        `<div id="test-root"></div>` +
        `<script type="module" src="${entryUrl}"></script>`
      sendHtml(res, 'Tests', body)
      return
    }

    if (url.pathname === '/iframe') {
      let test = decodeURIComponent(url.searchParams.get('file') || '')
      sendHtml(res, `Test: ${test}`, `<script type="module" src="${iframeUrl}"></script>`)
      return
    }

    if (url.pathname.startsWith('/scripts/')) {
      let filePath = urlPathToFilePath(url.pathname, rootDir)
      if (filePath) {
        try {
          await serveScript(res, filePath, url.pathname, rootDir)
          return
        } catch (error) {
          console.error(`[remix-test] Error serving ${url.pathname}:`, error)
          sendText(res, 500, String(error))
          return
        }
      }
    }

    sendText(res, 404, 'Not found')
  }
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

async function serveScript(
  res: http.ServerResponse,
  filePath: string,
  urlPath: string,
  rootDir: string,
): Promise<void> {
  let ext = path.extname(filePath)
  let isTs = TS_EXTS.has(ext)
  let isJs = JS_EXTS.has(ext)
  if (!isTs && !isJs) {
    sendText(res, 400, `Unsupported script extension "${ext}" for ${urlPath}`)
    return
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
      sendText(res, 500, msg)
      return
    }
  } else {
    code = source
  }

  try {
    code = await rewriteImports(code, filePath, rootDir)
  } catch (error) {
    let msg = error instanceof Error ? error.message : String(error)
    console.error(`[remix-test] Failed to rewrite imports for ${urlPath}: ${msg}`)
    sendText(res, 500, msg)
    return
  }

  res.writeHead(200, { 'Content-Type': 'application/javascript' })
  res.end(code)
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
    // Bare specifiers must be resolved from the importer's filesystem
    // location, not this module's. `import.meta.resolve(spec, parent)` looks
    // like the right tool but its `parent` argument is gated behind
    // `--experimental-import-meta-resolve` through at least Node 24 —
    // without the flag, the parent argument is silently ignored and
    // resolution happens from `import.meta.url` of the calling module. That
    // made bare specifiers only resolvable when they were direct deps of
    // `@remix-run/test` itself (so `remix/assert` failed even when the
    // importing package depended on `remix`). `createRequire` walks
    // node_modules from the importer's actual location and has been stable
    // since Node 12 with no flags.
    try {
      resolvedPath = createRequire(importerFile).resolve(spec)
    } catch {
      return null
    }
  }

  return filePathToUrl(resolvedPath, rootDir)
}

function sendHtml(res: http.ServerResponse, title: string, body: string): void {
  let doc =
    `<!DOCTYPE html>` +
    `<html>` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<title>${escapeHtml(title)}</title>` +
    `</head>` +
    `<body>${body}</body>` +
    `</html>`
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(doc)
}

function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain' })
  res.end(body)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Prevent the embedded JSON from terminating the surrounding <script> element
// or being interpreted as HTML. Only `</` needs escaping inside an
// `application/json` block; the leading `<` is preserved as `<` in the
// emitted JSON so JSON.parse round-trips it unchanged.
function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c')
}

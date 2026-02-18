import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import MagicString from 'magic-string'
import type { BuildOptions, InternalTransformConfig } from './options.ts'
import type { ResolveContext } from './resolve.ts'
import { resolvedPathToUrl, resolveSpecifiersToPaths } from './resolve.ts'
import { transformFile } from './transform.ts'
import { rewriteImports } from './rewrite.ts'
import { extractImportSpecifiers } from './import-rewriter.ts'
import { isExternalSpecifier } from './rewrite.ts'
import { fixSourceMapSources } from './source-map.ts'
import { hashCode } from './etag.ts'
import type { AssetsManifest } from './manifest-types.ts'
import { toPosixPath } from './path-resolver.ts'
import {
  compileFileRules,
  findFileRule,
  normalizeSourcePath,
  runFileRule,
  selectVariant,
  type CompiledFileRule,
} from './files.ts'
import { GENERATED_MARKER, toCodegenFilePath, writeIfChanged } from './codegen.ts'

/**
 * Discover the full module graph from entry points.
 * Fills resolutionCache for use in pass 1. Returns URLs in topological order (dependencies first).
 * Transforms each file with esbuild before extracting specifiers so we parse JS (lexer does not handle TS/JSX).
 *
 * @param scripts Script paths relative to root
 * @param root Project root
 * @param ctx Resolve context
 * @param externalSpecifiers Specifiers to skip
 * @param resolutionCache Cache to fill (specifier\0dir -> url)
 * @param transformConfig Config for transform
 * @returns Ordered URLs, path maps, and entry URLs
 */
async function discoverGraph(
  scripts: string[],
  root: string,
  ctx: ResolveContext,
  externalSpecifiers: string[],
  resolutionCache: Map<string, string>,
  transformConfig: InternalTransformConfig | undefined,
): Promise<{
  orderedUrls: string[]
  urlToAbsolutePath: Map<string, string>
  urlToStaticImports: Map<string, string[]>
  urlToImportSpecifiers: Map<string, Array<{ specifier: string; resolvedUrl: string }>>
  entryUrls: string[]
}> {
  let urlToAbsolutePath = new Map<string, string>()
  let urlToStaticImports = new Map<string, string[]>()
  let urlToImportSpecifiers = new Map<string, Array<{ specifier: string; resolvedUrl: string }>>()
  let seenPaths = new Set<string>()
  let seenUrls = new Set<string>()
  let queue: string[] = []

  for (let entry of scripts) {
    let normalized = entry.replace(/^\.\/+/, '').replace(/^\/+/, '')
    let absolutePath = path.resolve(root, normalized)
    queue.push(absolutePath)
  }

  while (queue.length > 0) {
    let absolutePath = path.normalize(queue.shift()!)
    if (seenPaths.has(absolutePath)) continue

    let url = resolvedPathToUrl(absolutePath, ctx)
    if (url === absolutePath) continue
    let readPath = absolutePath
    let stat = await fsp.stat(readPath).catch(() => null)
    if (!stat) continue
    if (stat.isDirectory()) {
      let found = false
      for (let name of ['index.ts', 'index.tsx', 'index.js']) {
        let candidate = path.join(readPath, name)
        try {
          await fsp.stat(candidate)
          readPath = candidate
          found = true
          break
        } catch {
          /* try next */
        }
      }
      if (!found) {
        seenPaths.add(absolutePath)
        continue
      }
    }

    if (seenPaths.has(readPath)) continue
    seenPaths.add(readPath)
    seenPaths.add(absolutePath)
    seenUrls.add(url)
    urlToAbsolutePath.set(url, readPath)

    let code: string
    try {
      let transformed = await transformFile(readPath, transformConfig)
      code = transformed.code
    } catch (err) {
      continue
    }

    let specifiers = (await extractImportSpecifiers(code)).map((s) => s.specifier)
    let importerDir = path.dirname(readPath)
    let toResolve = specifiers.filter((s) => !isExternalSpecifier(s, externalSpecifiers))
    let resolved = await resolveSpecifiersToPaths(
      specifiers,
      importerDir,
      ctx,
      resolutionCache,
      externalSpecifiers,
      (s) => isExternalSpecifier(s, externalSpecifiers),
    )

    let staticImportUrls: string[] = []
    let importSpecifiers: Array<{ specifier: string; resolvedUrl: string }> = []
    for (let i = 0; i < resolved.length; i++) {
      let r = resolved[i]
      if (r.url.startsWith('/') || r.url.startsWith('/__@workspace/')) {
        staticImportUrls.push(r.url)
        if (toResolve[i]) importSpecifiers.push({ specifier: toResolve[i], resolvedUrl: r.url })
        if (!seenPaths.has(r.absolutePath)) {
          queue.push(r.absolutePath)
        }
      }
    }
    urlToStaticImports.set(url, staticImportUrls)
    urlToImportSpecifiers.set(url, importSpecifiers)
  }

  let entryUrls = scripts.map((e) => {
    let normalized = e.replace(/^\.\/+/, '').replace(/^\/+/, '')
    let absolutePath = path.resolve(root, normalized)
    return resolvedPathToUrl(absolutePath, ctx)
  })

  let orderedUrls = topologicalOrder(Array.from(seenUrls), urlToStaticImports)
  return { orderedUrls, urlToAbsolutePath, urlToStaticImports, urlToImportSpecifiers, entryUrls }
}

function topologicalOrder(urls: string[], urlToStaticImports: Map<string, string[]>): string[] {
  let visited = new Set<string>()
  let result: string[] = []

  function visit(url: string) {
    if (visited.has(url)) return
    visited.add(url)
    for (let imp of urlToStaticImports.get(url) ?? []) {
      if (urls.includes(imp)) visit(imp)
    }
    result.push(url)
  }

  for (let url of urls) {
    visit(url)
  }
  return result
}

const DEFAULT_FILE_NAMES = '[name]-[hash]'

/**
 * Extract [dir] and [name] from a module URL path (e.g. /app/entry.tsx -> dir: "app", name: "entry").
 * @param url Module URL path (e.g. /app/entry.tsx)
 * @returns Object with dir and name (no trailing slash on dir)
 */
function urlToDirAndName(url: string): { dir: string; name: string } {
  let p = url.replace(/^\//, '')
  let slash = p.lastIndexOf('/')
  let dir = slash >= 0 ? p.slice(0, slash) : ''
  let base = slash >= 0 ? p.slice(slash + 1) : p
  let dot = base.lastIndexOf('.')
  let name = dot >= 0 ? base.slice(0, dot) : base
  return { dir, name }
}

/**
 * Substitute [dir], [name], [hash] in template; append .js; normalize slashes.
 * @param template Path template with placeholders
 * @param dir Directory segment (no trailing slash)
 * @param name Base name without extension
 * @param hash Content hash (first 8 chars used) or null
 * @returns Resolved path with .js appended
 */
function substituteFileNames(
  template: string,
  dir: string,
  name: string,
  hash: string | null,
): string {
  let out = template
    .replace(/\[dir\]/g, dir)
    .replace(/\[name\]/g, name)
    .replace(/\[hash\]/g, hash != null ? hash.slice(0, 8) : '')
  out = toPosixPath(out).replace(/^\/+/, '').replace(/\/+/g, '/')
  return out.endsWith('.js') ? out : out + '.js'
}

function urlToOutputPath(
  url: string,
  contentHash: string | null,
  fileNamesTemplate: string,
): string {
  let { dir, name } = urlToDirAndName(url)
  return substituteFileNames(fileNamesTemplate, dir, name, contentHash)
}

function sourcePathToDirAndName(sourcePath: string): { dir: string; name: string; ext: string } {
  let normalized = normalizeSourcePath(sourcePath)
  let slash = normalized.lastIndexOf('/')
  let dir = slash >= 0 ? normalized.slice(0, slash) : ''
  let filename = slash >= 0 ? normalized.slice(slash + 1) : normalized
  let dot = filename.lastIndexOf('.')
  let name = dot >= 0 ? filename.slice(0, dot) : filename
  let ext = dot >= 0 ? filename.slice(dot + 1) : ''
  return { dir, name, ext }
}

function fileOutputPath(
  sourcePath: string,
  contentHash: string,
  variant: string | undefined,
  ext: string,
): string {
  let { dir, name } = sourcePathToDirAndName(sourcePath)
  let segment = variant
    ? `${name}-@${variant}-${contentHash.slice(0, 8)}`
    : `${name}-${contentHash.slice(0, 8)}`
  let fileName = ext ? `${segment}.${ext}` : segment
  return [dir, fileName].filter(Boolean).join('/')
}

async function listAllFiles(root: string): Promise<string[]> {
  let files: string[] = []

  async function walk(dir: string) {
    let entries = await fsp.readdir(dir, { withFileTypes: true })
    await Promise.all(
      entries.map(async (entry) => {
        let absolutePath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') {
            return
          }
          await walk(absolutePath)
          return
        }
        if (!entry.isFile()) return
        files.push(normalizeSourcePath(path.relative(root, absolutePath)))
      }),
    )
  }

  await walk(root)
  return files
}

async function buildFilesOutputs(
  root: string,
  outDir: string,
  filesRules: CompiledFileRule[],
): Promise<AssetsManifest['files']['outputs']> {
  let sourceFiles = await listAllFiles(root)
  let outputs: AssetsManifest['files']['outputs'] = {}

  await Promise.all(
    sourceFiles.map(async (sourcePath) => {
      let rule = findFileRule(sourcePath, undefined, filesRules)
      if (!rule) return

      let absolutePath = path.join(root, ...sourcePath.split('/'))
      let sourceData = await fsp.readFile(absolutePath)

      if (rule.variants) {
        let variants: Record<string, { path: string }> = {}
        await Promise.all(
          Object.keys(rule.variants).map(async (variant) => {
            let result = await runFileRule(sourcePath, sourceData, rule, variant)
            let contentHash = await hashCode(
              result.data.toString('base64'),
              `${sourcePath}\0${variant}`,
            )
            let outputPath = fileOutputPath(sourcePath, contentHash, variant, result.ext)
            let fullPath = path.join(outDir, outputPath)
            await fsp.mkdir(path.dirname(fullPath), { recursive: true })
            await fsp.writeFile(fullPath, result.data)
            variants[variant] = { path: outputPath }
          }),
        )
        outputs[sourcePath] = rule.defaultVariant
          ? { variants, defaultVariant: rule.defaultVariant }
          : { variants }
        return
      }

      let result = await runFileRule(sourcePath, sourceData, rule, undefined)
      let contentHash = await hashCode(result.data.toString('base64'), sourcePath)
      let outputPath = fileOutputPath(sourcePath, contentHash, undefined, result.ext)
      let fullPath = path.join(outDir, outputPath)
      await fsp.mkdir(path.dirname(fullPath), { recursive: true })
      await fsp.writeFile(fullPath, result.data)
      outputs[sourcePath] = { path: outputPath }
    }),
  )

  return outputs
}

/**
 * Relative import specifier from one output path to another (e.g. ./chunk.js).
 * @param fromOutPath Path of the file containing the import
 * @param toOutPath Path of the target file
 * @returns Relative specifier (e.g. ./chunk.js or ../dir/chunk.js)
 */
function toRelativeImportSpecifier(fromOutPath: string, toOutPath: string): string {
  let fromDir = path.dirname(fromOutPath)
  let rel = toPosixPath(path.relative(fromDir, toOutPath))
  return rel.startsWith('.') ? rel : './' + rel
}

function toAssetUrl(outputPath: string, baseUrl: string): string {
  let segment = outputPath.replace(/^\.?\//, '')
  if (baseUrl !== '') {
    let base = baseUrl.replace(/\/+$/, '')
    return base ? `${base}/${segment}` : `/${segment}`
  }
  return `/${segment}`
}

function formatPreloads(urls: string[]): string {
  if (urls.length === 0) return '[]'
  if (urls.length === 1) return `['${urls[0]}']`
  return `[\n${urls.map((u) => `  '${u}'`).join(',\n')},\n]`
}

function generateBuildFileContent(
  sourcePath: string,
  output: AssetsManifest['files']['outputs'][string],
  baseUrl: string,
): string {
  let lines = [GENERATED_MARKER, `// source: ${sourcePath}`]

  if ('variants' in output) {
    let variantEntries = Object.entries(output.variants)
    if (output.defaultVariant) {
      let defaultPath = output.variants[output.defaultVariant].path
      lines.push(`export const href = '${toAssetUrl(defaultPath, baseUrl)}'`)
    }
    lines.push(`export const variants = {`)
    for (let [variant, variantOutput] of variantEntries) {
      lines.push(`  ${variant}: { href: '${toAssetUrl(variantOutput.path, baseUrl)}' },`)
    }
    lines.push(`}`)
  } else {
    lines.push(`export const href = '${toAssetUrl(output.path, baseUrl)}'`)
  }

  return lines.join('\n') + '\n'
}

function generateBuildScriptContent(
  sourcePath: string,
  outputPath: string,
  preloadUrls: string[],
  baseUrl: string,
): string {
  let href = toAssetUrl(outputPath, baseUrl)
  return (
    [
      GENERATED_MARKER,
      `// source: ${sourcePath}`,
      `export const href = '${href}'`,
      `export const preloads = ${formatPreloads(preloadUrls)}`,
    ].join('\n') + '\n'
  )
}

function collectPreloadUrls(
  entryUrl: string,
  urlToStaticImports: Map<string, string[]>,
  urlToOutPathMap: Map<string, string>,
  baseUrl: string,
): string[] {
  let visited = new Set<string>()
  let urls: string[] = []

  function visit(url: string) {
    if (visited.has(url)) return
    visited.add(url)
    let outPath = urlToOutPathMap.get(url)
    if (outPath) {
      urls.push(toAssetUrl(outPath, baseUrl))
    }
    for (let importedUrl of urlToStaticImports.get(url) ?? []) {
      visit(importedUrl)
    }
  }

  visit(entryUrl)
  return urls
}

/**
 * Programmatic build: discover graph from entries, two-pass transform + write, optional manifest.
 *
 * Phase 1: Build and write file assets, generate file asset .build.ts files.
 * Phase 2: Discover module graph from script entries (can now resolve #assets/... imports to
 * the .build.ts files generated in Phase 1), transform and write script files, generate script
 * entry .build.ts files.
 *
 * @param options Build options (scripts, root, outDir, etc.)
 */
export async function build(options: BuildOptions): Promise<void> {
  let root = path.resolve(process.cwd(), options.root ?? '.')
  let outDir = path.resolve(root, options.outDir)
  let scripts = options.scripts ?? []
  let fileNames = options.fileNames ?? DEFAULT_FILE_NAMES
  let includeHash = fileNames.includes('[hash]')
  let manifestPath = options.manifest === false ? null : (options.manifest ?? null)
  let codegenAbsDir = path.resolve(root, options.codegenDir ?? '.assets')
  let baseUrl = options.baseUrl ?? ''

  let workspaceRoot = options.workspaceRoot ? path.resolve(root, options.workspaceRoot) : null
  let ctx: ResolveContext = {
    root,
    workspaceRoot,
    allowPatterns: ['**'],
    denyPatterns: [],
    workspaceAllowPatterns: ['**'],
    workspaceDenyPatterns: [],
  }

  let externalRaw = options.external
  let externalSpecifiers: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []

  let transformConfig: InternalTransformConfig | undefined = undefined
  if (
    options.minify !== undefined ||
    options.sourcemap !== undefined ||
    options.sourcesContent !== undefined ||
    options.sourceRoot !== undefined
  ) {
    transformConfig = {
      minify: options.minify,
      sourcemap: options.sourcemap,
      sourcesContent: options.sourcesContent,
      sourceRoot: options.sourceRoot,
    }
  }

  let filesRules = compileFileRules(options.files)

  let emptyOutDir: boolean
  if (options.emptyOutDir !== undefined) {
    emptyOutDir = options.emptyOutDir
  } else {
    let rootNorm = path.normalize(root)
    let outDirNorm = path.normalize(outDir)
    emptyOutDir = outDirNorm === rootNorm || outDirNorm.startsWith(rootNorm + path.sep)
  }
  if (emptyOutDir) {
    await fsp.rm(outDir, { recursive: true, force: true })
  }
  await fsp.mkdir(outDir, { recursive: true })

  // Phase 1: File assets — hash, transform, write outputs, generate .build.ts files.
  // Must run before discoverGraph so that esbuild can resolve #assets/... imports to
  // the generated .build.ts files when discovering the script module graph.
  let filesOutputs = filesRules.length > 0 ? await buildFilesOutputs(root, outDir, filesRules) : {}

  await Promise.all(
    Object.entries(filesOutputs).map(async ([sourcePath, output]) => {
      let buildFilePath = toCodegenFilePath(sourcePath, codegenAbsDir, 'build')
      await writeIfChanged(buildFilePath, generateBuildFileContent(sourcePath, output, baseUrl))
    }),
  )

  // Phase 2: Script assets — discover module graph (now able to resolve #assets/... imports),
  // transform files, assign output paths, write outputs, generate script entry .build.ts files.
  let resolutionCache = new Map<string, string>()

  let { orderedUrls, urlToAbsolutePath, urlToStaticImports, entryUrls } = await discoverGraph(
    scripts,
    root,
    ctx,
    externalSpecifiers,
    resolutionCache,
    transformConfig,
  )

  let sourcemap = options.sourcemap
  let sourceMapEnabled = sourcemap === 'inline' || sourcemap === 'external'
  let sourceMapInline = sourcemap === 'inline'
  let sourceMapExternal = sourcemap === 'external'

  // Pass 1: transform all in parallel (in memory)
  let urlToTransformed = new Map<string, { code: string; map: string | null }>()
  await Promise.all(
    orderedUrls.map(async (url) => {
      let absolutePath = urlToAbsolutePath.get(url)
      if (!absolutePath) return
      let { code, map } = await transformFile(absolutePath, transformConfig)
      let rewritten = await rewriteImports(
        code,
        map ?? '{}',
        url,
        absolutePath,
        resolutionCache,
        ctx,
        externalSpecifiers,
      )
      let fixedMap: string | null = null
      if (rewritten.map && rewritten.map !== '{}' && sourceMapEnabled) {
        let fixed = fixSourceMapSources(rewritten.map, url)
        if (fixed !== null) fixedMap = fixed
      }
      let codeOut = rewritten.code
      if (fixedMap && sourceMapInline) {
        codeOut += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(fixedMap).toString('base64')}`
      }
      urlToTransformed.set(url, { code: codeOut, map: fixedMap })
    }),
  )

  // Pass 2: assign output paths (and hashes) so we have a complete url -> outPath map,
  // then rewrite all imports to relative paths in one pass. Building the map first
  // avoids order-dependence: with cycles, a single rewrite pass can resolve every
  // in-graph import because the map is already complete.
  let urlToOutPathMap = new Map<string, string>()
  let urlToFinalCode = new Map<string, string>()

  for (let url of orderedUrls) {
    let transformed = urlToTransformed.get(url)!
    let code = transformed.code
    let contentHash: string | null = null
    if (includeHash) {
      contentHash = await hashCode(code, url)
    }
    let outPath = urlToOutputPath(url, contentHash, fileNames)
    urlToOutPathMap.set(url, outPath)
    urlToFinalCode.set(url, code)
  }

  for (let url of orderedUrls) {
    let code = urlToFinalCode.get(url)!
    let outPath = urlToOutPathMap.get(url)!
    let specifiersWithPos = await extractImportSpecifiers(code)
    let ms: MagicString | null = null
    for (let { specifier, start, end } of specifiersWithPos) {
      if (isExternalSpecifier(specifier, externalSpecifiers)) continue
      let targetUrl = specifier.startsWith('/') ? specifier : '/' + specifier
      let targetOutPath = urlToOutPathMap.get(targetUrl)
      if (targetOutPath != null) {
        if (!ms) ms = new MagicString(code)
        let relativeSpecifier = toRelativeImportSpecifier(outPath, targetOutPath)
        ms.overwrite(start, end, relativeSpecifier)
      }
    }
    if (ms) urlToFinalCode.set(url, ms.toString())
  }

  for (let url of orderedUrls) {
    let outPath = urlToOutPathMap.get(url)!
    let code = urlToFinalCode.get(url)!
    let fullPath = path.join(outDir, outPath)
    await fsp.mkdir(path.dirname(fullPath), { recursive: true })
    if (sourceMapExternal) {
      let map = urlToTransformed.get(url)!.map
      if (map) {
        await fsp.writeFile(fullPath + '.map', map, 'utf-8')
        code += `\n//# sourceMappingURL=${path.basename(outPath)}.map`
      }
    }
    await fsp.writeFile(fullPath, code, 'utf-8')
  }

  // Generate script entry .build.ts files
  await Promise.all(
    entryUrls.map(async (entryUrl) => {
      let outPath = urlToOutPathMap.get(entryUrl)
      if (!outPath) return
      let sourcePath = normalizeSourcePath(entryUrl.replace(/^\//, ''))
      let preloadUrls = collectPreloadUrls(entryUrl, urlToStaticImports, urlToOutPathMap, baseUrl)
      let buildFilePath = toCodegenFilePath(sourcePath, codegenAbsDir, 'build')
      await writeIfChanged(
        buildFilePath,
        generateBuildScriptContent(sourcePath, outPath, preloadUrls, baseUrl),
      )
    }),
  )

  if (manifestPath) {
    let manifest: AssetsManifest = { scripts: { outputs: {} }, files: { outputs: filesOutputs } }
    let entryPathNorm = (u: string) => u.replace(/^\//, '')
    for (let url of orderedUrls) {
      let outPath = urlToOutPathMap.get(url)!
      let staticImports = urlToStaticImports.get(url) ?? []
      let imports: Array<{ path: string; kind: string }> = []
      for (let u of staticImports) {
        let depOutPath = urlToOutPathMap.get(u)
        if (depOutPath) imports.push({ path: depOutPath, kind: 'import-statement' })
      }
      let outputEntry: { entryPoint?: string; imports?: Array<{ path: string; kind: string }> } = {
        imports,
      }
      if (entryUrls.includes(url)) {
        outputEntry.entryPoint = entryPathNorm(url)
      }
      manifest.scripts.outputs[outPath] = outputEntry
    }
    let manifestFullPath = path.isAbsolute(manifestPath)
      ? manifestPath
      : path.join(root, manifestPath)
    await fsp.mkdir(path.dirname(manifestFullPath), { recursive: true })
    await fsp.writeFile(manifestFullPath, JSON.stringify(manifest, null, 2), 'utf-8')
  }
}

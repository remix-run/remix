// loader.ts - Node loader hook for HMR transforms
//
// Module Resolution Strategy:
// ===========================
// To build an accurate module graph, we need proper Node.js module resolution
// that handles package.json exports, conditional exports, etc.
//
// The solution uses TWO hooks working together:
//
// 1. RESOLVE HOOK: Caches all resolutions using Node's actual algorithm
//    - Called for every import statement
//    - Uses nextResolve() to get proper Node.js resolution
//    - Caches result keyed by "specifier|parentUrl"
//    - This gives us package.json exports, conditions, etc. for FREE
//
// 2. LOAD HOOK: Builds module graph using cached resolutions
//    - Parses transformed code with es-module-lexer (static analysis)
//    - For each parsed import, looks up resolution from cache
//    - Builds accurate module graph with correct file paths
//
// Why this works:
// - Resolve hook is async-friendly (no deadlocks)
// - We get Node's full resolution algorithm via nextResolve
// - Static parsing gives us accurate import list
// - Cache lookup is fast and synchronous

import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as swc from '@swc/core'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import {
  transformComponent,
  maybeHasComponent,
  HMR_RUNTIME_PATH,
} from '@remix-run/component-hmr/transform'
import { getTsconfig } from 'get-tsconfig'

// Initialize es-module-lexer
let lexerReady = lexerInit

// Cache jsxImportSource per directory to avoid repeated file system lookups
let jsxImportSourceCache = new Map<string, string>()

// Get jsxImportSource from tsconfig.json for the given file
function getJsxImportSource(filePath: string): string {
  let dir = dirname(filePath)

  if (jsxImportSourceCache.has(dir)) {
    return jsxImportSourceCache.get(dir)!
  }

  // Look for tsconfig.json starting from the file's directory
  let tsconfig = getTsconfig(dir)
  let importSource = tsconfig?.config.compilerOptions?.jsxImportSource ?? '@remix-run/component'

  jsxImportSourceCache.set(dir, importSource)
  return importSource
}

// Module graph: url -> { importers: Set<url>, imports: Set<url>, isComponent: boolean, filePath: string }
// Built from static analysis of transformed code + proper Node.js resolution
let moduleGraph = new Map<
  string,
  {
    importers: Set<string>
    imports: Set<string>
    isComponent: boolean
    filePath: string
  }
>()

// Resolution cache: Map<"specifier|parentUrl", resolvedUrl>
// Populated by resolve hook with Node's actual resolutions
// Used by load hook to build accurate module graph
let resolutionCache = new Map<string, string>()

// Track if we've injected HMR setup into entry point
let hmrSetupInjected = false

// Parse imports from transformed code and update module graph
async function updateModuleGraphFromCode(
  code: string,
  moduleUrl: string,
  graphEntry: {
    importers: Set<string>
    imports: Set<string>
    isComponent: boolean
    filePath: string
  },
) {
  // Ensure lexer is ready
  await lexerReady

  try {
    // Parse imports with es-module-lexer
    let [imports] = parseImports(code)

    // Clear old import relationships (we'll rebuild them)
    for (let oldImportUrl of graphEntry.imports) {
      let oldImportEntry = moduleGraph.get(oldImportUrl)
      if (oldImportEntry) {
        oldImportEntry.importers.delete(moduleUrl)
      }
    }
    graphEntry.imports.clear()

    // Build new relationships from parsed imports
    for (let imp of imports) {
      // imp.n is the specifier (null for dynamic imports with non-string argument)
      if (imp.n != null) {
        let specifier = imp.n

        // Skip the HMR runtime import (we'll inject it separately)
        if (specifier.includes('/runtime.ts') || specifier === HMR_RUNTIME_PATH) {
          continue
        }

        // Skip node: built-in modules
        if (specifier.startsWith('node:')) {
          continue
        }

        // Look up the resolution from the resolve hook's cache
        // The resolve hook has already resolved this import using Node's full algorithm
        // (including package.json exports, conditional exports, etc.)
        let cacheKey = `${specifier}|${moduleUrl}`
        let resolvedUrl = resolutionCache.get(cacheKey)

        if (!resolvedUrl) {
          // Resolution not in cache - might be a dynamic import or edge case
          // Fall back to simple resolution for relative/absolute paths
          try {
            if (specifier.startsWith('.')) {
              resolvedUrl = new URL(specifier, moduleUrl).href
            } else if (specifier.startsWith('/')) {
              resolvedUrl = pathToFileURL(specifier).href
            } else {
              // Bare specifier without cached resolution - skip
              continue
            }
          } catch {
            // Failed to resolve, skip
            continue
          }
        }

        // Normalize by removing query strings and hashes
        resolvedUrl = resolvedUrl.split('?')[0].split('#')[0]

        // Skip node_modules - we don't track external dependencies for HMR
        if (resolvedUrl.includes('/node_modules/')) {
          continue
        }

        // Initialize entry for imported module if needed
        if (!moduleGraph.has(resolvedUrl)) {
          try {
            let importedFilePath = fileURLToPath(resolvedUrl)
            moduleGraph.set(resolvedUrl, {
              importers: new Set(),
              imports: new Set(),
              isComponent: false,
              filePath: importedFilePath,
            })
          } catch {
            // Can't convert to file path, skip
            continue
          }
        }

        // Add bidirectional relationship
        graphEntry.imports.add(resolvedUrl)
        moduleGraph.get(resolvedUrl)!.importers.add(moduleUrl)
      }
    }
  } catch (error) {
    // If parsing fails, just log and continue
    console.error(`[remix-watch] Failed to parse imports for ${moduleUrl}:`, error)
  }
}

// Resolve hook to map browser runtime path to server runtime module
export async function resolve(specifier: string, context: any, nextResolve: any) {
  // Map /__@remix/hmr-runtime.ts to @remix-run/watch/runtime
  if (specifier === HMR_RUNTIME_PATH) {
    return {
      url: new URL('./runtime.ts', import.meta.url).href,
      shortCircuit: true,
    }
  }

  // Get actual resolution from Node.js
  let result = await nextResolve(specifier, context)

  // Cache the resolution for use in load hook
  // This gives us proper Node.js resolution (exports, conditions, etc.)
  if (context.parentURL) {
    let cacheKey = `${specifier}|${context.parentURL}`
    resolutionCache.set(cacheKey, result.url)
  }

  return result
}

export async function load(url: string, context: any, nextLoad: any) {
  // Skip node_modules and built-ins
  if (url.includes('node_modules') || url.startsWith('node:')) {
    return nextLoad(url, context)
  }

  // Get the file path
  let filePath
  try {
    filePath = fileURLToPath(url)
  } catch {
    return nextLoad(url, context)
  }

  // Normalize URL by removing query strings and hashes for stable module identity
  let normalizedUrl = url.split('?')[0].split('#')[0]

  // Initialize graph entry for this module
  if (!moduleGraph.has(normalizedUrl)) {
    moduleGraph.set(normalizedUrl, {
      importers: new Set(),
      imports: new Set(),
      isComponent: false,
      filePath,
    })
  }

  let graphEntry = moduleGraph.get(normalizedUrl)!

  // Read source
  let source
  try {
    source = await readFile(filePath, 'utf-8')
  } catch {
    return nextLoad(url, context)
  }

  // Strip TypeScript types if this is a .ts or .tsx file
  // Component transform needs JS input, not TS
  if ((filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.d.ts')) {
    try {
      let transformConfig: any = {
        filename: filePath,
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: filePath.endsWith('.tsx'),
            decorators: false,
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
        sourceMaps: false,
      }

      // For .tsx files, configure JSX transform
      if (filePath.endsWith('.tsx')) {
        transformConfig.jsc.transform = {
          react: {
            runtime: 'automatic',
            importSource: getJsxImportSource(filePath),
          },
        }
      }

      let result = await swc.transform(source, transformConfig)
      source = result.code
    } catch (err) {
      console.error(`[remix-watch] Failed to strip types from ${filePath}:`, err)
      // Continue with original source and let Node.js handle the error
    }
  }

  let isComponent = false
  let transformedSource = source

  // Quick check if this might be a component file
  if (maybeHasComponent(source)) {
    // Try to transform as a component
    try {
      let result = await transformComponent(source, url)

      // If transformation produced different code, it's a component
      if (result.code !== source) {
        console.log(`[remix-watch] HMR boundary: ${filePath}`)
        isComponent = true
        transformedSource = result.code

        // Mark as component in graph
        graphEntry.isComponent = true
      }
    } catch (error) {
      console.error(`[remix-watch] Transform error for ${filePath}:`, error)
    }
  }

  // Parse imports from the transformed code to build the module graph
  // This is the KEY CHANGE: we parse statically instead of relying on runtime tracking
  await updateModuleGraphFromCode(transformedSource, normalizedUrl, graphEntry)

  // Get absolute file URL for runtime module (so user code can always resolve it)
  let runtimeUrl = new URL('../runtime.ts', import.meta.url).href

  // Inject module registration (executes when module loads) - but skip for remix packages and node_modules
  let moduleRegistration = ''
  let isRemixPackage = filePath.includes('/remix/packages/') && !filePath.includes('/.tmp/')
  if (!isRemixPackage && !url.includes('node_modules')) {
    // Get the imports for this module (what it imports) from static analysis
    let imports = graphEntry.imports.size > 0 ? Array.from(graphEntry.imports) : []

    moduleRegistration = `import { registerModule } from '${runtimeUrl}'
registerModule(${JSON.stringify(url)}, ${JSON.stringify(filePath)}, ${isComponent}, ${JSON.stringify(imports)})

`
  }

  // Inject HMR setup into entry point (server.ts/js)
  if (!hmrSetupInjected && /server\.(ts|js)$/.test(filePath)) {
    console.log('[remix-watch] Setting up HMR runtime')
    hmrSetupInjected = true

    let transformed = `import { setupHMR } from '${runtimeUrl}'
${moduleRegistration}setupHMR()

${transformedSource}`

    return {
      format: 'module',
      source: transformed,
      shortCircuit: true,
    }
  }

  // Return module with registration
  return {
    format: 'module',
    source: moduleRegistration + transformedSource,
    shortCircuit: true,
  }
}

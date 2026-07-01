/**
 * Runtime Worker - Runs the Just Node runtime in a Web Worker
 *
 * This worker receives code execution requests from the main thread
 * and runs them in isolation, preventing UI blocking.
 */

import type * as NodeFS from 'node:fs'

import { getServerBridge, Runtime, VirtualFS } from '@jacob-ebey/almostnode'
import type { IExecuteResult, IRuntimeOptions, VFSSnapshot } from '@jacob-ebey/almostnode'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { expose } from 'comlink'
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve'
import { type ImportDeclaration, type ImportExpression, parse } from 'acorn'
import * as walk from 'acorn-walk'
import MagicString from 'magic-string'
import * as ts from 'typescript'

/**
 * Adapt a {@link VirtualFS} to the synchronous + asynchronous `FileSystem`
 * interface expected by enhanced-resolve.
 *
 * enhanced-resolve (via `CachedInputFileSystem`) needs both sync and async
 * variants of `stat`/`lstat`/`readdir`/`readFile`/`readlink`/`realpath`, and
 * it derives `readJson` by doing `buffer.toString("utf8")` on the result of
 * `readFile`. A bare `Uint8Array` does not honor the encoding argument, so we
 * provide a proper `readJson`/`readJsonSync` (and a string-returning
 * `readFile` when an encoding is requested) to make package.json resolution
 * work correctly.
 */
function createVfsFileSystem(vfs: VirtualFS) {
  let decoder = new TextDecoder()

  let toPath = (p: unknown): string => (typeof p === 'string' ? p : String(p))

  let getEncoding = (options: unknown): string | null => {
    if (typeof options === 'string') return options
    if (options && typeof options === 'object' && 'encoding' in options) {
      return (options as { encoding?: string | null }).encoding ?? null
    }
    return null
  }

  let readFileSync = (path: unknown, options?: unknown) => {
    let data = vfs.readFileSync(toPath(path))
    return Buffer.from(data)
    // return getEncoding(options) ? decoder.decode(data) : data;
  }

  let readJsonSync = (path: unknown) => JSON.parse(decoder.decode(vfs.readFileSync(toPath(path))))

  let statSync = (path: unknown) => vfs.statSync(toPath(path))
  let lstatSync = (path: unknown) => vfs.lstatSync(toPath(path))
  let readdirSync = (path: unknown) => vfs.readdirSync(toPath(path))
  let realpathSync = (path: unknown) => vfs.realpathSync(toPath(path))

  // Our VFS has no symlinks; readlink should fail the way Node does so that
  // enhanced-resolve's SymlinkPlugin treats the entry as a regular file.
  let readlinkSync = (path: unknown): never => {
    let err = new Error(`EINVAL: invalid argument, readlink '${toPath(path)}'`) as Error & {
      code: string
    }
    err.code = 'EINVAL'
    throw err
  }

  /**
   * Wrap a sync function so it can be called with the Node-style
   * `(path, [options], callback)` async signature.
   */
  let asyncify =
    <T>(fn: (path: unknown, options?: unknown) => T) =>
    (path: unknown, options: unknown, callback?: unknown): void => {
      let cb = (typeof options === 'function' ? options : callback) as (
        err: Error | null,
        result?: T,
      ) => void
      let opts = typeof options === 'function' ? undefined : options
      try {
        cb(null, fn(path, opts))
      } catch (err) {
        cb(err as Error)
      }
    }

  return {
    readFileSync,
    readJsonSync,
    statSync,
    lstatSync,
    readdirSync,
    realpathSync,
    readlinkSync,
    readFile: asyncify(readFileSync),
    readJson: asyncify(readJsonSync),
    stat: asyncify(statSync),
    lstat: asyncify(lstatSync),
    readdir: asyncify(readdirSync),
    realpath: asyncify(realpathSync),
    readlink: asyncify(readlinkSync),
  }
}

type DevServerResponse = {
  statusCode: number
  statusMessage: string
  headers: Record<string, string>
  body: any
}

declare module '@jacob-ebey/almostnode' {
  interface Process {
    __playgroundDevServer: ((url: URL) => Promise<DevServerResponse>) | null
    __sqlite3: Awaited<ReturnType<typeof sqlite3InitModule>> | null
  }
}

let runtime: Runtime | null = null
let vfs: VirtualFS | null = null
let devServer: ((url: URL) => Promise<DevServerResponse>) | null = null
let consoleCallback: ((method: string, args: unknown[]) => void) | null = null
let serverReadyCallback: ((port: number) => void) | null = null
const serverBridge = getServerBridge({
  baseUrl: `${location.protocol}//${location.host}`,
  onServerReady(port) {
    serverReadyCallback?.(port)
  },
})

/**
 * Worker API exposed via Comlink
 */
const workerApi = {
  /**
   * Initialize the worker with a VFS snapshot and runtime options
   */
  async init(vfsSnapshot: VFSSnapshot, options: IRuntimeOptions): Promise<void> {
    // Restore VFS from snapshot
    vfs = VirtualFS.fromSnapshot(vfsSnapshot)

    // Create runtime with console forwarding
    let runtimeOptions: IRuntimeOptions = {
      ...options,
      onConsole: (method, args) => {
        // Forward console output to main thread
        if (consoleCallback) {
          consoleCallback(method, args)
        }
      },
    }

    runtime = new Runtime(vfs, runtimeOptions)

    let res = await runtime!.executeSync(
      `const _fs = require("node:fs"); exports.fs = _fs;`,
      '/__get_fs__.js',
    )
    let fs = (res.exports as { fs: typeof NodeFS }).fs

    let resolverExtensionAlias = {
      '.js': ['.js', '.ts', '.tsx', '.jsx'],
      '.jsx': ['.jsx', '.tsx'],
      '.mjs': ['.mjs', '.mts'],
    } satisfies Record<string, string[]>
    let resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

    let resolver = ResolverFactory.createResolver({
      fileSystem: new CachedInputFileSystem(createVfsFileSystem(vfs) as any, 4000) as any,
      aliasFields: [['browser']],
      conditionNames: ['browser', 'import', 'module', 'default'],
      extensionAlias: resolverExtensionAlias,
      extensions: resolverExtensions,
      mainFields: ['browser', 'module', 'main'],
      tsconfig: { configFile: '/tsconfig.json' },
    })

    /**
     * Extract the package name from a bare import specifier.
     * e.g. "react" -> "react", "react/jsx-runtime" -> "react",
     * "@scope/pkg/sub" -> "@scope/pkg"
     */
    let getPackageName = (specifier: string): string => {
      let parts = specifier.split('/')
      if (specifier.startsWith('@')) {
        return parts.slice(0, 2).join('/')
      }
      return parts[0]
    }

    /** Determine whether a specifier is a bare import (not relative/absolute). */
    let isBareImport = (specifier: string): boolean =>
      !specifier.startsWith('.') &&
      !specifier.startsWith('/') &&
      !specifier.startsWith('http://') &&
      !specifier.startsWith('https://')

    /**
     * Look up the declared version for a package in the vfs package.json
     * and build an esm.sh URL for the specifier.
     */
    let rewriteBareToEsmSh = (specifier: string): string | null => {
      let pkgName = getPackageName(specifier)
      let pkgJson: Record<string, any>
      try {
        pkgJson = JSON.parse(new TextDecoder().decode(vfs!.readFileSync('/package.json')))
      } catch {
        return null
      }
      let version =
        pkgJson.dependencies?.[pkgName] ??
        pkgJson.devDependencies?.[pkgName] ??
        pkgJson.peerDependencies?.[pkgName] ??
        pkgJson.optionalDependencies?.[pkgName]
      if (!version) {
        return null
      }
      let subpath = specifier.slice(pkgName.length)
      return `https://esm.sh/${pkgName}@${version}${subpath}`
    }

    devServer = async (url) => {
      // await esbuildInitPromise;
      let previewPort = runtime!.getProcess().env.PREVIEW_PORT || '44100'

      let toResolve = url.pathname.replace(/^\/\//, '/')

      let entry = await resolver.resolvePromise({}, '/', toResolve)

      if (!entry) {
        return {
          statusCode: 404,
          statusMessage: 'Not Found',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: 'Not Found',
        }
      }

      let error: Error | null = null

      let contents = new TextDecoder().decode(vfs!.readFileSync(entry))

      let transformed = ts.transpileModule(contents, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2024,
          jsx: ts.JsxEmit.ReactJSX,
          jsxImportSource: 'remix/ui',
        },
        fileName: entry,
        reportDiagnostics: true,
      })

      if (transformed.diagnostics?.some((d) => d.category === ts.DiagnosticCategory.Error)) {
        return {
          statusCode: 500,
          statusMessage: 'Internal Server Error',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: `Error transforming module "${toResolve}": ${transformed.diagnostics
            ?.map((d) => d.messageText)
            .join('\n')}`,
        }
      }

      let ast = parse(transformed.outputText, {
        sourceType: 'module',
        ecmaVersion: 'latest',
      })
      let toRewrite: (ImportDeclaration | ImportExpression)[] = []
      walk.simple(ast, {
        ImportDeclaration(node) {
          toRewrite.push(node)
        },
        ImportExpression(node) {
          toRewrite.push(node)
        },
      })

      let s = new MagicString(transformed.outputText)
      for (let node of toRewrite) {
        switch (node.type) {
          case 'ImportDeclaration': {
            let source = String(node.source.value)
            if (isBareImport(source)) {
              let esmShUrl = rewriteBareToEsmSh(source)
              if (esmShUrl) {
                s.overwrite(node.source.start, node.source.end, JSON.stringify(esmShUrl))
                break
              }
            }
            let resolved = await resolver.resolvePromise({}, entry, source)
            if (!resolved) {
              return {
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                headers: {
                  'Content-Type': 'text/plain',
                },
                body: `Error resolving import "${source}" in module "${toResolve}"`,
              }
            }
            let relativePath = '/' + resolved
            let newSource = `/__virtual__/${previewPort}/assets${relativePath}`
            s.overwrite(node.source.start, node.source.end, JSON.stringify(newSource))

            break
          }
          case 'ImportExpression': {
            if (node.source.type !== 'Literal') {
              continue
            }
            let source = String(node.source.value)
            if (isBareImport(source)) {
              let esmShUrl = rewriteBareToEsmSh(source)
              if (esmShUrl) {
                s.overwrite(node.source.start, node.source.end, JSON.stringify(esmShUrl))
                break
              }
            }
            let resolved = await resolver.resolvePromise({}, entry, source)
            if (!resolved) {
              return {
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                headers: {
                  'Content-Type': 'text/plain',
                },
                body: `Error resolving dynamic import "${source}" in module "${toResolve}"`,
              }
            }
            let newSource = `/__virtual__/${previewPort}/assets${resolved}`
            s.overwrite(node.source.start, node.source.end, JSON.stringify(newSource))
            break
          }
        }
      }

      return {
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'Content-Type': 'application/javascript',
        },
        body: s.toString(),
      }
    }

    let process = runtime.getProcess()
    process.__playgroundDevServer = devServer
    process.__sqlite3 = await sqlite3InitModule()
  },

  /**
   * Set the console callback for forwarding output to main thread
   */
  setConsoleCallback(callback: ((method: string, args: unknown[]) => void) | null): void {
    consoleCallback = callback
  },

  /**
   * Set the server ready callback for forwarding output to main thread
   */
  setServerReadyCallback(callback: ((port: number) => void) | null): void {
    serverReadyCallback = callback
  },

  /**
   * Update environment variables on the running process.
   *
   * The runtime's `process.env` object is created once at init and shared by
   * every subsequent `runFile`, so mutating it here is observed by the next
   * server run. The playground uses this to toggle `MIGRATE_DATABASE` around an
   * explicit migration run without recreating the worker.
   */
  setEnv(env: Record<string, string | undefined>): void {
    if (!runtime) {
      throw new Error('Worker runtime not initialized. Call init() first.')
    }
    let processEnv = runtime.getProcess().env
    for (let [key, value] of Object.entries(env)) {
      if (value === undefined || value === '') {
        delete processEnv[key]
      } else {
        processEnv[key] = value
      }
    }
  },

  /**
   * Reset the database by dropping every user table (including the migration
   * journal) from the shared in-memory SQLite file. Opening a fresh connection
   * to the same path sees the same data the server's driver uses, since both go
   * through the single `sqlite3` wasm instance created during init. Callers
   * should clear the module cache and re-run the server (with migrations) after
   * this to rebuild the schema.
   */
  resetDatabase(): void {
    if (!runtime) {
      throw new Error('Worker runtime not initialized. Call init() first.')
    }
    let sqlite3 = runtime.getProcess().__sqlite3
    if (!sqlite3) {
      throw new Error('SQLite is not initialized.')
    }

    let db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct')
    try {
      let tables: string[] = []
      db.exec({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        rowMode: 'array',
        callback: (row: unknown[]) => {
          tables.push(String(row[0]))
        },
      })

      db.exec('PRAGMA foreign_keys = OFF;')
      for (let name of tables) {
        db.exec(`DROP TABLE IF EXISTS "${name}";`)
      }
    } finally {
      db.close()
    }
  },

  /**
   * Sync a file change from the main thread
   */
  syncFile(path: string, content: string | null): void {
    if (!vfs) {
      console.warn('[Worker] VFS not initialized, cannot sync file:', path)
      return
    }

    if (content === null) {
      // File was deleted
      try {
        vfs.unlinkSync(path)
      } catch (err) {
        // File might not exist, that's ok
      }
    } else {
      // File was created or modified
      vfs.writeFileSync(path, content)
    }

    // Clear module cache for this file to pick up changes
    if (runtime) {
      runtime.clearCache()
    }
  },

  /**
   * Execute code in the worker
   */
  async execute(code: string, filename?: string): Promise<IExecuteResult> {
    if (!runtime) {
      throw new Error('Worker runtime not initialized. Call init() first.')
    }

    return runtime.execute(code, filename)
  },

  /**
   * Run a file from the VFS
   */
  async runFile(filename: string): Promise<IExecuteResult> {
    if (!runtime) {
      throw new Error('Worker runtime not initialized. Call init() first.')
    }

    return runtime.runFile(filename)
  },

  /**
   * Clear the module cache
   */
  clearCache(): void {
    if (runtime) {
      runtime.clearCache()
    }
  },

  /**
   * Get current VFS state (for debugging)
   */
  getVFSSnapshot(): VFSSnapshot | null {
    if (!vfs) return null
    return vfs.toSnapshot()
  },

  handleRequest(method: string, url: string, headers: Record<string, string>, body?: ArrayBuffer) {
    return serverBridge.handleRequest(44100, method, url, headers, body)
  },
}

// Expose the API via Comlink
expose(workerApi)

// Log that worker is ready
console.log('[Worker] Runtime worker loaded and ready')

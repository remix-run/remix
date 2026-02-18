import * as path from 'node:path'
import type { Middleware } from '@remix-run/fetch-router'
import {
  createDevAssetsHandler,
  createDevAssetResolver,
  codegenWatch,
  type CreateDevAssetsHandlerOptions,
  type CodegenWatcher,
} from '@remix-run/assets'

export interface DevAssetsMiddlewareOptions extends CreateDevAssetsHandlerOptions {
  /**
   * Script entry paths relative to root (e.g. ['app/entry.tsx']).
   * When provided, .dev.ts files are generated for these entries so they can
   * be imported via #assets/... subpath imports.
   */
  scripts?: string[]
  /**
   * Directory for generated .dev.ts asset files.
   * Default: '.assets'
   */
  codegenDir?: string
}

export interface DevAssetsHandler {
  /** The middleware to pass to createRouter(). */
  middleware: Middleware
  /** Stop the file watcher started by codegenWatch(). */
  close(): void
}

/**
 * Creates a dev assets middleware that serves and transforms source files for
 * development. When scripts or files options are provided, runs codegenWatch()
 * on startup to generate/update .dev.ts files before accepting requests, so
 * #assets/... imports resolve immediately.
 *
 * @param options Configuration options
 * @returns An object with middleware and a close() method to stop the watcher
 */
export function createDevAssets(options: DevAssetsMiddlewareOptions): DevAssetsHandler {
  let root = path.resolve(options.root ?? process.cwd())
  let codegenDir = options.codegenDir ?? '.assets'
  // Auto-allow the codegen directory so browsers can fetch resolved .dev.ts files.
  let resolvedOptions: CreateDevAssetsHandlerOptions = {
    ...options,
    root,
    allow: [...(options.allow ?? []), `${codegenDir}/**`],
  }
  let handler = createDevAssetsHandler(resolvedOptions)
  let resolveAsset = createDevAssetResolver({ root, files: options.files })

  let watcher: CodegenWatcher | null = null
  let codegenInit: Promise<void> | null = null

  if (options.scripts?.length || options.files?.length) {
    codegenInit = codegenWatch({
      scripts: options.scripts,
      files: options.files,
      root,
      codegenDir: options.codegenDir,
    }).then((w) => {
      watcher = w
    })
  }

  let middleware: Middleware = async (context, next) => {
    if (codegenInit) await codegenInit

    context.assets = { resolve: resolveAsset }

    let response = await handler.serve(context.request)
    if (response) {
      return response
    }
    return next()
  }

  return {
    middleware,
    close() {
      watcher?.close()
    },
  }
}

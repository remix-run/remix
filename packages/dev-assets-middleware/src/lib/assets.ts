import * as path from 'node:path'
import type { Middleware } from '@remix-run/fetch-router'
import {
  createDevAssetsHandler,
  createDevAssetResolver,
  watchCodegenPlaceholders,
  type CreateDevAssetsHandlerOptions,
  type CodegenWatcher,
  type AssetsSource,
} from '@remix-run/assets'

export interface DevAssetsMiddlewareOptions extends CreateDevAssetsHandlerOptions {
  /**
   * Source definition (scripts + file rules).
   * When provided, .placeholder.ts files are generated for these entries so
   * they can be imported via #assets/... subpath imports.
   */
  source?: AssetsSource
  /**
   * Directory for generated .placeholder.ts asset files.
   * Default: '.assets'
   */
  codegenDir?: string
}

export interface DevAssetsHandler {
  /** The middleware to pass to createRouter(). */
  middleware: Middleware
  /** Stop the file watcher started by watchCodegenPlaceholders(). */
  close(): void
}

/**
 * Creates a dev assets middleware that serves and transforms source files for
 * development. When a source option is provided, runs watchCodegenPlaceholders()
 * on startup to generate/update .placeholder.ts files before accepting requests,
 * so #assets/... imports resolve immediately.
 *
 * @param options Configuration options
 * @returns An object with middleware and a close() method to stop the watcher
 */
export function createDevAssets(options: DevAssetsMiddlewareOptions): DevAssetsHandler {
  let root = path.resolve(options.root ?? process.cwd())
  let codegenDir = options.codegenDir ?? '.assets'
  // Auto-allow the codegen directory so browsers can fetch resolved .placeholder.ts files.
  let resolvedOptions: CreateDevAssetsHandlerOptions = {
    ...options,
    root,
    allow: [...(options.allow ?? []), `${codegenDir}/**`],
  }
  let handler = createDevAssetsHandler(resolvedOptions)
  let resolveAsset = createDevAssetResolver({ root, source: options.source })

  let watcher: CodegenWatcher | null = null
  let codegenInit: Promise<void> | null = null

  if (options.source?.scripts?.length || options.source?.files?.length) {
    codegenInit = watchCodegenPlaceholders({
      source: options.source,
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

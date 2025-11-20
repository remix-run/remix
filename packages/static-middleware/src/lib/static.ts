import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { openFile } from '@remix-run/fs'
import type { Middleware } from '@remix-run/fetch-router'
import {
  file as sendFile,
  type FileResponseOptions,
} from '@remix-run/fetch-router/response-helpers'

export interface StaticFilesOptions extends FileResponseOptions {
  /**
   * Filter function to determine which files should be served.
   *
   * @param path The relative path being requested
   * @returns Whether to serve the file
   */
  filter?: (path: string) => boolean
  /**
   * Files to try and serve as the index file when the request path targets a directory.
   *
   * - `true` (default): Use default index files `['index.html', 'index.htm']`
   * - `false`: Disable index file serving
   * - `string[]`: Custom list of index files to try in order
   */
  index?: boolean | string[]
}

/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it
 * a relative path. The middleware always falls through to the handler if the file
 * is not found or an error occurs.
 *
 * @param root The root directory to serve files from (absolute or relative to cwd)
 * @param options (optional) configuration for file responses
 *
 * @example
 * let router = createRouter({
 *   middleware: [staticFiles('./public')],
 * })
 *
 * @example
 * // With cache control
 * let router = createRouter({
 *   middleware: [
 *     staticFiles('./public', {
 *       cacheControl: 'public, max-age=3600',
 *     }),
 *   ],
 * })
 */
export function staticFiles(root: string, options: StaticFilesOptions = {}): Middleware {
  // Ensure root is an absolute path
  root = path.resolve(root)

  let { filter, index: indexOption, ...fileOptions } = options

  // Normalize index option
  let index: string[]
  if (indexOption === false) {
    index = []
  } else if (indexOption === true || indexOption === undefined) {
    index = ['index.html', 'index.htm']
  } else {
    index = indexOption
  }

  return async (context, next) => {
    if (context.method !== 'GET' && context.method !== 'HEAD') {
      return next()
    }

    let relativePath = context.url.pathname.replace(/^\/+/, '')

    if (filter && !filter(relativePath)) {
      return next()
    }

    let targetPath = path.join(root, relativePath)
    let filePath: string | undefined

    try {
      let stats = await fsp.stat(targetPath)

      if (stats.isFile()) {
        filePath = targetPath
      } else if (stats.isDirectory()) {
        // Try each index file in turn
        for (let indexFile of index) {
          let indexPath = path.join(targetPath, indexFile)
          try {
            let indexStats = await fsp.stat(indexPath)
            if (indexStats.isFile()) {
              filePath = indexPath
              break
            }
          } catch {
            // Index file doesn't exist, continue to next
          }
        }
      }
    } catch {
      // Path doesn't exist or isn't accessible, fall through
    }

    if (filePath) {
      let fileName = path.relative(root, filePath)
      let file = openFile(filePath, { name: fileName })
      return sendFile(file, context.request, fileOptions)
    }
  }
}

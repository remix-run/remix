import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import { openLazyFile } from '@remix-run/fs'
import type { Middleware } from '@remix-run/fetch-router'
import { createFileResponse as sendFile, type FileResponseOptions } from '@remix-run/response/file'

import { generateDirectoryListing } from './directory-listing.ts'

/**
 * Function that determines if HTTP Range requests should be supported for a given file.
 *
 * @param file The File object being served
 * @returns true if range requests should be supported
 */
export type AcceptRangesFunction = (file: File) => boolean

/**
 * Options for the `staticFiles` middleware.
 */
export interface StaticFilesOptions extends Omit<FileResponseOptions, 'acceptRanges'> {
  /**
   * Filter function to determine which files should be served.
   *
   * @param path The relative path being requested
   * @returns Whether to serve the file
   */
  filter?: (path: string) => boolean

  /**
   * Whether to support HTTP Range requests for partial content.
   *
   * Can be a boolean or a function that receives the file.
   * When enabled, includes Accept-Ranges header and handles Range requests
   * with 206 Partial Content responses.
   *
   * Defaults to enabling ranges only for non-compressible MIME types,
   * as defined by `isCompressibleMimeType()` from `@remix-run/mime`.
   *
   * Note: Range requests and compression are mutually exclusive. When
   * `Accept-Ranges: bytes` is present in the response headers, the compression
   * middleware will not compress the response. This is why the default behavior
   * enables ranges only for non-compressible types.
   *
   * @example
   * // Force range request support for all files
   * acceptRanges: true
   *
   * @example
   * // Enable ranges for videos only
   * acceptRanges: (file) => file.type.startsWith('video/')
   */
  acceptRanges?: boolean | AcceptRangesFunction

  /**
   * Files to try and serve as the index file when the request path targets a directory.
   *
   * - `true`: Use default index files `['index.html', 'index.htm']`
   * - `false`: Disable index file serving
   * - `string[]`: Custom list of index files to try in order
   *
   * @default true
   */
  index?: boolean | string[]
  /**
   * Whether to return an HTML page listing the files in a directory when the request path
   * targets a directory. If both this and `index` are set, `index` takes precedence.
   *
   * @default false
   */
  listFiles?: boolean
}

/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it a relative path.
 * The middleware always falls through to the handler if the file is not found or an error occurs.
 *
 * @param root The root directory to serve files from (absolute or relative to cwd)
 * @param options Configuration for file responses
 * @returns The static files middleware
 */
export function staticFiles(root: string, options: StaticFilesOptions = {}): Middleware {
  // Ensure root is an absolute path
  root = path.resolve(root)

  let { acceptRanges, filter, index: indexOption, listFiles, ...fileOptions } = options

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

        // If no index file found and listFiles is enabled, show directory listing
        if (!filePath && listFiles) {
          return generateDirectoryListing(targetPath, context.url.pathname)
        }
      }
    } catch {
      // Path doesn't exist or isn't accessible, fall through
    }

    if (filePath) {
      let fileName = path.relative(root, filePath)
      let lazyFile = openLazyFile(filePath, { name: fileName })

      let finalFileOptions: FileResponseOptions = { ...fileOptions }

      // If acceptRanges is a function, evaluate it with the lazyFile
      // Otherwise, pass it directly to sendFile
      if (typeof acceptRanges === 'function') {
        finalFileOptions.acceptRanges = acceptRanges(lazyFile)
      } else if (acceptRanges !== undefined) {
        finalFileOptions.acceptRanges = acceptRanges
      }

      return sendFile(lazyFile, context.request, finalFileOptions)
    }

    return next()
  }
}

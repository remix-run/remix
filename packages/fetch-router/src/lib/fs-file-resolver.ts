import * as path from 'node:path'

import { openFile } from '@remix-run/lazy-file/fs'

import type { FileResolver } from './file-handler.ts'
import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'

export type PathResolver<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
> = (context: RequestContext<Method, Params>) => string | null | Promise<string | null>

/**
 * Creates a file resolver that resolves files from the filesystem using the lazy-file API.
 *
 * This resolver handles filesystem-specific concerns like opening files,
 * handling ENOENT errors, and dealing with directories.
 *
 * @param root - The root directory to serve files from (absolute or relative to cwd)
 * @param pathResolver - Function that resolves the relative path for a given request
 * @returns A file resolver function that can be passed to `createFileHandler`
 *
 * @example
 * import { createFileHandler } from '@remix-run/fetch-router/file-handler'
 * import { createFsFileResolver } from '@remix-run/fetch-router/fs-file-resolver'
 *
 * let handler = createFileHandler(
 *   createFsFileResolver('/files', (context) => context.params.path)
 * )
 *
 * router.get('/files/*path', handler)
 */
export function createFsFileResolver<
  Method extends RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
>(root: string, pathResolver: PathResolver<Method, Params>): FileResolver<Method, Params> {
  // Ensure root is an absolute path
  root = path.resolve(root)

  return async (context) => {
    let relativePath = await pathResolver(context)

    if (relativePath === null) {
      return null
    }

    let filePath = path.join(root, relativePath)

    try {
      return openFile(filePath)
    } catch (error) {
      if (isNoEntityError(error) || isNotAFileError(error)) {
        return null
      }
      throw error
    }
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function isNotAFileError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('is not a file')
}

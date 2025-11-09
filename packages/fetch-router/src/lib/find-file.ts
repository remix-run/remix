import * as path from 'node:path'

import { openFile } from '@remix-run/lazy-file/fs'

/**
 * Finds a file on the filesystem within the given root directory.
 *
 * This function handles filesystem-specific concerns like opening files,
 * handling ENOENT errors, and dealing with directories.
 *
 * The returned File instance will have its `name` property set to the full
 * absolute path on the server (not just the basename).
 *
 * @param root - The root directory to serve files from (absolute or relative to cwd)
 * @param relativePath - The relative path from the root to the file
 * @returns The resolved file with full path in `file.name`, or null if not found
 *
 * @example
 * let file = await findFile('./public', 'styles.css')
 * if (file) {
 *   return sendFile(file, context)
 * }
 * return new Response('Not Found', { status: 404 })
 */
export async function findFile(root: string, relativePath: string): Promise<File | null> {
  // Ensure root is an absolute path
  root = path.resolve(root)

  let filePath = path.join(root, relativePath)

  // Security check: ensure the resolved path is within the root directory
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return null
  }

  try {
    // Set file.name to the full absolute path for server-side use
    let file = await openFile(filePath, { name: filePath })
    return file
  } catch (error) {
    if (isNoEntityError(error) || isNotAFileError(error)) {
      return null
    }
    throw error
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function isNotAFileError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('is not a file')
}

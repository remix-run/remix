import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FileUpload } from 'remix/form-data-parser'
import { createFsFileStorage } from 'remix/file-storage/fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const uploadsStorage = createFsFileStorage(resolve(__dirname, '..', '..', 'tmp', 'uploads'))

/**
 * Upload handler for file uploads. Stores files via the FileStorage abstraction
 * (content-addressed on disk) and returns a URL path at /uploads/...
 * The uploads files handler reads from the same storage and applies transforms.
 */
export async function uploadHandler(file: FileUpload): Promise<string> {
  let ext = file.name.split('.').pop() || 'jpg'
  let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  await uploadsStorage.set(key, file)

  return `/uploads/${key}`
}

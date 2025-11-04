import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FileUpload } from '@remix-run/fetch-router/form-data-middleware'
import { LocalFileStorage } from '@remix-run/file-storage/local'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const uploadsStorage = new LocalFileStorage(resolve(__dirname, '..', '..', 'tmp', 'uploads'))

/**
 * Upload handler for file uploads. Stores files in local storage and returns
 * a public URL path that can be used to access the file.
 */
export async function uploadHandler(file: FileUpload): Promise<string> {
  // Generate unique key for this file
  let ext = file.name.split('.').pop() || 'jpg'
  let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  // Store file in local storage
  await uploadsStorage.set(key, file)

  // Return public URL path
  return `/uploads/${key}`
}

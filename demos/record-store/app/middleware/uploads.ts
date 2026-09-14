import type { FileUpload } from 'remix/form-data-parser'

import { uploadsStorage } from '../utils/uploads.ts'

export async function uploadHandler(file: FileUpload): Promise<string> {
  let ext = file.name.split('.').pop() || 'jpg'
  let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

  await uploadsStorage.set(key, file)

  return `/uploads/${key}`
}

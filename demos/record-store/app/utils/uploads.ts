import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFsFileStorage } from 'remix/file-storage/fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const uploadsStorage = createFsFileStorage(resolve(__dirname, '..', '..', 'tmp', 'uploads'))

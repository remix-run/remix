import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFsFileStorage } from 'remix/file-storage/fs'

let __dirname = dirname(fileURLToPath(import.meta.url))

export let uploadsStorage = createFsFileStorage(resolve(__dirname, '..', '..', 'tmp', 'uploads'))

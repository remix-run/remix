import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function globalSetup(): Promise<void> {
  let databaseFilePath = fileURLToPath(new URL('../tmp/bookstore.test.sqlite', import.meta.url))

  fs.rmSync(databaseFilePath, { force: true })

  let { initializeBookstoreDatabase } = await import('../app/data/setup.ts')
  await initializeBookstoreDatabase()
}

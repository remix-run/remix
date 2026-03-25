import { initializeBookstoreDatabase } from '../app/data/setup.ts'

let initialization: Promise<void> | null = null

function ensureInitialized(): Promise<void> {
  if (initialization == null) {
    initialization = initializeBookstoreDatabase()
  }

  return initialization
}

await ensureInitialized()

export async function globalSetup(): Promise<void> {
  await ensureInitialized()
}

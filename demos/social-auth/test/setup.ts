import { initializeSocialAuthDatabase } from '../app/data/setup.ts'

export async function globalSetup(): Promise<void> {
  await initializeSocialAuthDatabase()
}

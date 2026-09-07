import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const packagesDir = path.resolve(import.meta.dirname, '..', '..', 'packages')

export const cliSchemaPath = path.join(packagesDir, 'cli', 'schema', 'remix.json')
export const remixSchemaPath = path.join(packagesDir, 'remix', 'schema', 'remix.json')

export async function syncRemixSchema(): Promise<void> {
  await fs.mkdir(path.dirname(remixSchemaPath), { recursive: true })
  await fs.copyFile(cliSchemaPath, remixSchemaPath)
}

export async function removeRemixSchema(): Promise<void> {
  await fs.rm(path.dirname(remixSchemaPath), { recursive: true, force: true })
}

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export function readDevRemixVersion(): string | undefined {
  let packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../remix/package.json',
  )

  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      version?: string
    }

    if (packageJson.name !== 'remix') {
      return undefined
    }

    let version = packageJson.version?.trim()
    return version != null && version.length > 0 ? version : undefined
  } catch {
    return undefined
  }
}

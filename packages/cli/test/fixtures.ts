import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI_PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES_DIR = path.join(CLI_PACKAGE_DIR, 'test', 'fixtures')

export function getFixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name)
}

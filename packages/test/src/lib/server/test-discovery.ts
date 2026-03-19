import { glob } from 'node:fs/promises'
import * as path from 'node:path'

export async function discoverTests(pattern: string, cwd?: string): Promise<string[]> {
  let baseDir = cwd || process.cwd()
  let files: string[] = []

  for await (let file of glob(pattern, { cwd: baseDir })) {
    if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('.git')) {
      files.push(path.resolve(baseDir, file))
    }
  }

  return files.sort()
}

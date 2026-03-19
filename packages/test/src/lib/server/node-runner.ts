import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

let require = createRequire(import.meta.url)
let tsxEsmUrl = pathToFileURL(require.resolve('tsx/esm')).href

export async function runNodeTests(
  files: string[],
  options: { coverage?: boolean } = {},
): Promise<{ failed: boolean }> {
  let args = ['--import', tsxEsmUrl, '--test']
  if (options.coverage) {
    args.push('--experimental-test-coverage')
  }
  args.push(...files)

  return new Promise((resolve, reject) => {
    let proc = spawn(process.execPath, args, {
      stdio: 'inherit',
    })

    proc.on('close', (code) => resolve({ failed: code !== 0 }))
    proc.on('error', reject)
  })
}

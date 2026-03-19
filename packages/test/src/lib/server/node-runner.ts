import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

let require = createRequire(import.meta.url)
let tsxEsmUrl = pathToFileURL(require.resolve('tsx/esm')).href

export async function runNodeTests(files: string[]): Promise<{ failed: boolean }> {
  return new Promise((resolve, reject) => {
    let proc = spawn(process.execPath, ['--import', tsxEsmUrl, '--test', ...files], {
      stdio: 'inherit',
    })

    proc.on('close', (code) => resolve({ failed: code !== 0 }))
    proc.on('error', reject)
  })
}

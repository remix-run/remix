import { spawn } from 'node:child_process'
import * as util from 'node:util'

const { values: cliArgs } = util.parseArgs({
  options: {
    tag: {
      type: 'string',
      short: 't',
    },
  },
})

const tag = cliArgs.tag ?? process.env.REMIX_REF

await run('docs', tag ? ['--tag', tag] : [])
await run('build:demos')
await run('prerender')

function run(script: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    let child = spawn('pnpm', ['run', script, ...args], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`pnpm run ${script} failed with ${signal ?? `exit code ${code}`}`))
      }
    })
  })
}

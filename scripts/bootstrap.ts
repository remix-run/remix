import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let [targetPath, ...extraArgs] = process.argv.slice(2)

if (targetPath == null || extraArgs.length > 0) {
  printUsage()
  process.exit(1)
}

targetPath = validateTargetPath(targetPath)

let targetDir = path.resolve(ROOT_DIR, targetPath)
if (fs.existsSync(targetDir)) {
  console.error(`Error: ${path.relative(ROOT_DIR, targetDir)} already exists.`)
  console.error('Remove it first or choose a different target path.')
  process.exit(1)
}

let result = cp.spawnSync(
  'pnpm',
  [
    'exec',
    'tsx',
    'packages/remix/src/cli-entry.ts',
    'new',
    targetPath,
    '--app-name',
    humanizeName(path.basename(targetDir)),
  ],
  {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: 'inherit',
  },
)

if (result.error != null) {
  throw result.error
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log()
console.log(`Created workspace bootstrap app at ${path.relative(ROOT_DIR, targetDir)}`)
console.log(`Run \`cd ${path.relative(ROOT_DIR, targetDir)} && npm install\` to install.`)

function printUsage(): void {
  console.error('Usage:')
  console.error('  pnpm run bootstrap <target-path>')
}

function validateTargetPath(value: string): string {
  let targetPath = value.trim()
  if (targetPath.length === 0) {
    throw new Error('Target path cannot be empty.')
  }

  if (targetPath === '.' || targetPath === '..') {
    throw new Error('Target path must include a new app directory, like `../smoke-test`.')
  }

  return targetPath
}

function humanizeName(value: string): string {
  let parts = value.split(/[-_\s]+/).filter(Boolean)
  if (parts.length === 0) {
    return 'Remix App'
  }

  return parts
    .map((part) => {
      let head = part.slice(0, 1).toUpperCase()
      let tail = part.slice(1)
      return `${head}${tail}`
    })
    .join(' ')
}

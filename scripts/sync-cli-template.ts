import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = path.join(ROOT_DIR, 'template')
const REMIX_APP_SKILL_DIR = path.join(ROOT_DIR, '.agents', 'skills', 'remix')
const TARGET_DIR = path.join(ROOT_DIR, 'packages', 'cli', 'template')
const TARGET_REMIX_APP_SKILL_DIR = path.join(TARGET_DIR, '.agents', 'skills', 'remix')

const EXCLUDED_NAMES = new Set([
  '.cache',
  '.coverage',
  '.git',
  '.gitignore',
  '.tmp',
  '.turbo',
  'bun.lock',
  'bun.lockb',
  'coverage',
  'dist',
  'node_modules',
  'package-lock.json',
  'pnpm-lock.yaml',
  'tmp',
  'yarn.lock',
])

const [command, ...extraArgs] = process.argv.slice(2)

if (extraArgs.length > 0 || (command != null && command !== '--clean')) {
  throw new Error('Usage: node ./scripts/sync-cli-template.ts [--clean]')
}

if (command === '--clean') {
  await fs.rm(TARGET_DIR, { recursive: true, force: true })
} else {
  await fs.rm(TARGET_DIR, { recursive: true, force: true })
  await fs.cp(SOURCE_DIR, TARGET_DIR, {
    recursive: true,
    filter: shouldCopy,
  })
  await fs.copyFile(path.join(SOURCE_DIR, '.gitignore'), path.join(TARGET_DIR, 'gitignore'))
  await fs.mkdir(path.dirname(TARGET_REMIX_APP_SKILL_DIR), { recursive: true })
  await fs.cp(REMIX_APP_SKILL_DIR, TARGET_REMIX_APP_SKILL_DIR, {
    recursive: true,
    filter: shouldCopy,
  })
}

function shouldCopy(source: string): boolean {
  let name = path.basename(source)
  return !EXCLUDED_NAMES.has(name) && !isLocalEnvironmentFile(name) && !name.endsWith('.log')
}

function isLocalEnvironmentFile(name: string): boolean {
  return name === '.env' || name === '.env.local' || /^\.env\..+\.local$/.test(name)
}

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { processTemplateFile } from './process-template-file.ts'

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

export async function syncCliTemplate(rootDir: string): Promise<void> {
  let sourceDir = path.join(rootDir, 'template')
  let remixAppSkillDir = path.join(rootDir, '.agents', 'skills', 'remix')
  let targetDir = getCliTemplateDir(rootDir)
  let targetRemixAppSkillDir = path.join(targetDir, '.agents', 'skills', 'remix')

  await fs.rm(targetDir, { recursive: true, force: true })
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    filter: shouldCopy,
  })
  await fs.copyFile(path.join(sourceDir, '.gitignore'), path.join(targetDir, 'gitignore'))
  await fs.mkdir(path.dirname(targetRemixAppSkillDir), { recursive: true })
  await fs.cp(remixAppSkillDir, targetRemixAppSkillDir, {
    recursive: true,
    filter: shouldCopy,
  })
  await processTemplateDirectory(targetDir)
}

export async function cleanCliTemplate(rootDir: string): Promise<void> {
  await fs.rm(getCliTemplateDir(rootDir), { recursive: true, force: true })
}

function getCliTemplateDir(rootDir: string): string {
  return path.join(rootDir, 'packages', 'cli', 'template')
}

function shouldCopy(source: string): boolean {
  let name = path.basename(source)
  return !EXCLUDED_NAMES.has(name) && !isLocalEnvironmentFile(name) && !name.endsWith('.log')
}

function isLocalEnvironmentFile(name: string): boolean {
  return name === '.env' || name === '.env.local' || /^\.env\..+\.local$/.test(name)
}

async function processTemplateDirectory(directory: string): Promise<void> {
  let entries = await fs.readdir(directory, { withFileTypes: true })

  for (let entry of entries) {
    let entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await processTemplateDirectory(entryPath)
      continue
    }

    let content = await fs.readFile(entryPath, 'utf8')
    let processed = await processTemplateFile(content, entryPath)
    await fs.writeFile(entryPath, processed, 'utf8')
  }
}

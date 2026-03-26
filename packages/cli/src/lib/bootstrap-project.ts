import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'

import { UsageError } from './errors.ts'

const BOOTSTRAP_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../bootstrap',
)
const BOOTSTRAP_EXCLUDED_NAMES = new Set(['.gitkeep', 'node_modules'])
const MINIMUM_SUPPORTED_NODE_VERSION = '24.3.0'

export interface BootstrapProjectOptions {
  appName: string | null
  force: boolean
  targetDir: string
}

export interface BootstrappedProject {
  appDisplayName: string
  targetDir: string
}

interface BootstrapConfig {
  appDisplayName: string
  packageName: string
  remixVersion: string
}

type TemplateValues = Record<string, string>

export async function bootstrapProject(
  options: BootstrapProjectOptions,
): Promise<BootstrappedProject> {
  let targetDir = path.resolve(options.targetDir)
  let rawAppName = options.appName ?? path.basename(targetDir)
  if (rawAppName.length === 0) {
    throw new UsageError('Could not determine an app name from the target directory.')
  }

  let config = {
    appDisplayName: options.appName ?? humanizeName(rawAppName),
    packageName: toPackageName(rawAppName),
    remixVersion: readDefaultRemixVersion(),
  } satisfies BootstrapConfig

  await ensureTargetDirectory(targetDir, options.force)
  await copyBootstrapDirectory({
    sourceDir: BOOTSTRAP_DIRECTORY,
    targetDir,
    templateValues: createTemplateValues(config),
  })
  await writeScaffoldPackageJson(targetDir, config)

  return {
    appDisplayName: config.appDisplayName,
    targetDir,
  }
}

function readDefaultRemixVersion(): string {
  let overriddenVersion = process.env.REMIX_VERSION?.trim()
  if (overriddenVersion) {
    return overriddenVersion
  }

  return 'latest'
}

function createTemplateValues(config: BootstrapConfig): TemplateValues {
  return {
    __RMX_APP_DISPLAY_NAME__: config.appDisplayName,
    __RMX_APP_DISPLAY_NAME_REGEX__: escapeRegExp(config.appDisplayName),
  }
}

async function writeScaffoldPackageJson(targetDir: string, config: BootstrapConfig): Promise<void> {
  let packageJsonPath = path.join(targetDir, 'package.json')
  let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    engines?: Record<string, string>
    name?: string
  }

  packageJson.name = config.packageName
  packageJson.dependencies = {
    ...packageJson.dependencies,
    remix: config.remixVersion,
    tsx: 'latest',
  }
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@types/node': 'latest',
    typescript: 'latest',
  }
  packageJson.engines = {
    ...packageJson.engines,
    node: `>=${MINIMUM_SUPPORTED_NODE_VERSION}`,
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8')
}

async function ensureTargetDirectory(targetDir: string, force: boolean): Promise<void> {
  try {
    let stats = await fs.stat(targetDir)
    if (!stats.isDirectory()) {
      throw new UsageError(`Target path is not a directory: ${targetDir}`)
    }

    let entries = await fs.readdir(targetDir)
    if (entries.length > 0 && !force) {
      throw new UsageError(
        `Target directory is not empty: ${targetDir}. Re-run with --force to continue.`,
      )
    }
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code !== 'ENOENT') {
      throw error
    }
  }

  await fs.mkdir(targetDir, { recursive: true })
}

async function copyBootstrapDirectory({
  sourceDir,
  targetDir,
  templateValues,
}: {
  sourceDir: string
  targetDir: string
  templateValues: TemplateValues
}): Promise<void> {
  let entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (let entry of entries) {
    let sourcePath = path.join(sourceDir, entry.name)
    let targetPath = path.join(targetDir, entry.name)

    if (BOOTSTRAP_EXCLUDED_NAMES.has(entry.name)) {
      continue
    }

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true })
      await copyBootstrapDirectory({ sourceDir: sourcePath, targetDir: targetPath, templateValues })
      continue
    }

    let content = await fs.readFile(sourcePath, 'utf8')
    await fs.writeFile(targetPath, replaceTemplateValues(content, templateValues), 'utf8')
  }
}

function replaceTemplateValues(content: string, templateValues: TemplateValues): string {
  for (let [token, value] of Object.entries(templateValues)) {
    content = content.split(token).join(value)
  }

  return content
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

function toPackageName(value: string): string {
  let packageName = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (packageName.length === 0) {
    throw new UsageError(`Could not derive a valid package name from "${value}".`)
  }

  return packageName
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}

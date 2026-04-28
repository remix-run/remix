import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

import {
  appNameUnavailable,
  invalidPackageName,
  targetDirectoryNotEmpty,
  targetPathNotDirectory,
} from './errors.ts'
import { getRuntimeRemixVersion } from './runtime-context.ts'
import { runProgressStep, type StepProgressReporter } from './reporter.ts'

const BOOTSTRAP_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../bootstrap',
)
const BOOTSTRAP_EXCLUDED_NAMES = new Set(['.gitkeep', 'node_modules'])
export const MINIMUM_SUPPORTED_NODE_VERSION = '24.3.0'

export interface BootstrapProjectOptions {
  appName: string | null
  force: boolean
  targetDir: string
}

export type BootstrapProjectPhase =
  | 'prepare-target-directory'
  | 'generate-scaffold-files'
  | 'finalize-package-json'

export interface BootstrappedProject {
  appDisplayName: string
  targetDir: string
}

export type BootstrapProgressReporter = StepProgressReporter<BootstrapProjectPhase>

interface BootstrapConfig {
  appDisplayName: string
  packageName: string
  remixVersion: string
}

type TemplateValues = Record<string, string>

export async function bootstrapProject(
  options: BootstrapProjectOptions,
  progress?: BootstrapProgressReporter,
): Promise<BootstrappedProject> {
  let targetDir = path.resolve(options.targetDir)
  let rawAppName = options.appName ?? path.basename(targetDir)
  if (rawAppName.length === 0) {
    throw appNameUnavailable(targetDir)
  }

  let config = {
    appDisplayName: options.appName ?? humanizeName(rawAppName),
    packageName: toPackageName(rawAppName),
    remixVersion: readDefaultRemixVersion(),
  } satisfies BootstrapConfig

  await runProgressStep(progress, 'prepare-target-directory', () =>
    ensureTargetDirectory(targetDir, options.force),
  )
  await runProgressStep(progress, 'generate-scaffold-files', () =>
    copyBootstrapDirectory({
      sourceDir: BOOTSTRAP_DIRECTORY,
      targetDir,
      templateValues: createTemplateValues(config),
    }),
  )
  await runProgressStep(progress, 'finalize-package-json', () =>
    writeScaffoldPackageJson(targetDir, config),
  )

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

  let runtimeVersion = getRuntimeRemixVersion()
  if (runtimeVersion == null) {
    return 'latest'
  }

  let validRuntimeVersion = semver.valid(runtimeVersion)
  return validRuntimeVersion == null ? runtimeVersion : `^${validRuntimeVersion}`
}

function createTemplateValues(config: BootstrapConfig): TemplateValues {
  return {
    __RMX_APP_DISPLAY_NAME__: config.appDisplayName,
    __RMX_APP_DISPLAY_NAME_URI_COMPONENT__: encodeURIComponent(config.appDisplayName),
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
      throw targetPathNotDirectory(targetDir)
    }

    let entries = await fs.readdir(targetDir)
    if (entries.length > 0 && !force) {
      throw targetDirectoryNotEmpty(targetDir)
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
    throw invalidPackageName(value)
  }

  return packageName
}

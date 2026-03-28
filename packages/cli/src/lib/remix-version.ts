import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { remixVersionUnavailable } from './errors.ts'
import { getRuntimeCwd } from './runtime-context.ts'
import { getRuntimeRemixVersion } from './runtime-context.ts'

export function readRemixVersion(): string {
  let remixVersion = getRuntimeRemixVersion()
  if (remixVersion == null) {
    remixVersion = readResolvedRemixVersion()
  }

  if (remixVersion == null) {
    throw remixVersionUnavailable()
  }

  return remixVersion
}

function readResolvedRemixVersion(): string | undefined {
  let packageJsonPath = resolveInstalledRemixPackageJson(getRuntimeCwd()) ?? resolveRepoRemixPackageJson()
  if (packageJsonPath == null) {
    return undefined
  }

  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      name?: string
      version?: string
    }

    if (packageJson.name !== 'remix') {
      return undefined
    }

    let version = packageJson.version?.trim()
    return version != null && version.length > 0 ? version : undefined
  } catch {
    return undefined
  }
}

function resolveInstalledRemixPackageJson(fromDir: string): string | undefined {
  try {
    let requireFromDir = createRequire(path.join(fromDir, '__remix_cli__.js'))
    let remixEntry = requireFromDir.resolve('remix')
    return findPackageJson(remixEntry)
  } catch {
    return undefined
  }
}

function resolveRepoRemixPackageJson(): string | undefined {
  let repoPackageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../remix/package.json',
  )

  return fs.existsSync(repoPackageJsonPath) ? repoPackageJsonPath : undefined
}

function findPackageJson(entryPath: string): string | undefined {
  let directory = path.dirname(entryPath)

  while (true) {
    let packageJsonPath = path.join(directory, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath
    }

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) {
      return undefined
    }

    directory = parentDirectory
  }
}

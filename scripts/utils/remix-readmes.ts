import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

const packagesDir = path.resolve(import.meta.dirname, '..', '..', 'packages')
const remixDir = path.join(packagesDir, 'remix')
const remixSrcDir = path.join(remixDir, 'src')
const remixManifestPath = path.join(remixDir, 'manifest.json')
const cliPackageName = '@remix-run/cli'

export interface RemixReadmeCopy {
  specifier: string
  sourceReadmePath: string
  remixReadmePath: string
}

type PackageJson = {
  exports?: Record<string, unknown>
}

export function getRemixReadmeMappings(): RemixReadmeCopy[] {
  let manifest: Record<string, string> = JSON.parse(fs.readFileSync(remixManifestPath, 'utf-8'))
  let packageJsonByName = readPackageJsonByName()
  let mappings: RemixReadmeCopy[] = []

  for (let [remixPath, specifier] of Object.entries(manifest)) {
    if (remixPath.startsWith('_')) continue

    let mapping = getRemixReadmeMapping(specifier, packageJsonByName)
    if (mapping) {
      mappings.push(mapping)
    }
  }

  let cliReadmePath = findReadmeForSpecifier(cliPackageName, packageJsonByName)
  if (cliReadmePath) {
    mappings.push({
      specifier: cliPackageName,
      sourceReadmePath: cliReadmePath,
      remixReadmePath: getRemixReadmePath(cliPackageName, cliReadmePath),
    })
  }

  return mappings
}

export function getRemixReadmeCopies(): RemixReadmeCopy[] {
  let copiesByPath = new Map<string, RemixReadmeCopy>()

  for (let mapping of getRemixReadmeMappings()) {
    if (!copiesByPath.has(mapping.remixReadmePath)) {
      copiesByPath.set(mapping.remixReadmePath, mapping)
    }
  }

  return [...copiesByPath.values()]
}

export async function syncRemixReadmes(): Promise<RemixReadmeCopy[]> {
  await removeRemixReadmes()

  let copies = getRemixReadmeCopies()
  for (let copy of copies) {
    await fsp.mkdir(path.dirname(copy.remixReadmePath), { recursive: true })
    await fsp.copyFile(copy.sourceReadmePath, copy.remixReadmePath)
  }

  return copies
}

async function removeRemixReadmes(): Promise<void> {
  let readmePaths = await findReadmePaths(remixSrcDir)
  await Promise.all(readmePaths.map((readmePath) => fsp.rm(readmePath, { force: true })))
}

export function findReadmeForSpecifier(
  specifier: string,
  packageJsonByName = readPackageJsonByName(),
): string | undefined {
  let { packageName, packageDirName, subPath } = parseSpecifier(specifier)

  if (!subPath) {
    return findReadmePath(packageDirName)
  }

  let packageJson = packageJsonByName.get(packageName)
  let exportConfig = packageJson?.exports?.[`./${subPath}`]
  let sourceEntryPath = getSourceEntryPath(exportConfig)
  return sourceEntryPath ? findReadmePath(packageDirName, sourceEntryPath) : undefined
}

function getRemixReadmeMapping(
  specifier: string,
  packageJsonByName: Map<string, PackageJson>,
): RemixReadmeCopy | undefined {
  let sourceReadmePath = findReadmeForSpecifier(specifier, packageJsonByName)

  if (!sourceReadmePath) {
    let { packageName } = parseSpecifier(specifier)
    sourceReadmePath = findReadmeForSpecifier(packageName, packageJsonByName)
  }

  if (!sourceReadmePath) {
    return undefined
  }

  return {
    specifier,
    sourceReadmePath,
    remixReadmePath: getRemixReadmePath(specifier, sourceReadmePath),
  }
}

function getRemixReadmePath(specifier: string, sourceReadmePath: string): string {
  let { packageDirName } = parseSpecifier(specifier)
  let packageDir = path.join(packagesDir, packageDirName)
  let sourceDirectory = path.relative(packageDir, path.dirname(sourceReadmePath))
  let sourceParts = sourceDirectory ? sourceDirectory.split(path.sep) : []
  if (sourceParts[0] === 'src') {
    sourceParts.shift()
  }

  return path.join(remixSrcDir, packageDirName, ...sourceParts, 'README.md')
}

function readPackageJsonByName(): Map<string, PackageJson> {
  let packageJsonByName = new Map<string, PackageJson>()

  for (let entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    let packageJsonPath = path.join(packagesDir, entry.name, 'package.json')
    if (!isFile(packageJsonPath)) continue

    let packageJson: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    if (!isPackageJson(packageJson)) continue

    packageJsonByName.set(packageJson.name, packageJson)
  }

  return packageJsonByName
}

function isPackageJson(value: unknown): value is PackageJson & { name: string } {
  return (
    value !== null && typeof value === 'object' && 'name' in value && typeof value.name === 'string'
  )
}

function parseSpecifier(specifier: string): {
  packageName: string
  packageDirName: string
  subPath: string
} {
  let parts = specifier.split('/')
  let firstPart = parts[0]
  if (!firstPart) {
    throw new Error(`Invalid package specifier: ${specifier}`)
  }

  let packageName: string
  let subPathParts: string[]
  if (firstPart.startsWith('@')) {
    let secondPart = parts[1]
    if (!secondPart) {
      throw new Error(`Invalid scoped package specifier: ${specifier}`)
    }
    packageName = `${firstPart}/${secondPart}`
    subPathParts = parts.slice(2)
  } else {
    packageName = firstPart
    subPathParts = parts.slice(1)
  }

  return {
    packageName,
    packageDirName: packageName.replace('@remix-run/', ''),
    subPath: subPathParts.join('/'),
  }
}

function getSourceEntryPath(exportConfig: unknown): string | undefined {
  if (typeof exportConfig === 'string') {
    return exportConfig
  }

  if (exportConfig === null || typeof exportConfig !== 'object' || Array.isArray(exportConfig)) {
    return undefined
  }

  if ('types' in exportConfig && typeof exportConfig.types === 'string') {
    return exportConfig.types
  }

  if ('default' in exportConfig && typeof exportConfig.default === 'string') {
    return exportConfig.default
  }

  return undefined
}

function findReadmePath(packageDirName: string, sourceEntryPath?: string): string | undefined {
  let packageDir = path.join(packagesDir, packageDirName)
  if (sourceEntryPath) {
    let colocatedReadmePath = path.join(packageDir, path.dirname(sourceEntryPath), 'README.md')
    if (isFile(colocatedReadmePath)) {
      return colocatedReadmePath
    }

    let nestedReadmePath = path.join(
      packageDir,
      path.dirname(sourceEntryPath),
      path.basename(sourceEntryPath, path.extname(sourceEntryPath)),
      'README.md',
    )
    return isFile(nestedReadmePath) ? nestedReadmePath : undefined
  }

  let readmePath = path.join(packageDir, 'README.md')
  return isFile(readmePath) ? readmePath : undefined
}

async function findReadmePaths(directory: string): Promise<string[]> {
  let entries = await fsp.readdir(directory, { withFileTypes: true }).catch((error: unknown) => {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return []
    }
    throw error
  })

  let readmePaths: string[] = []
  for (let entry of entries) {
    let entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      readmePaths.push(...(await findReadmePaths(entryPath)))
    } else if (entry.name === 'README.md') {
      readmePaths.push(entryPath)
    }
  }

  return readmePaths
}

function isFile(filePath: string): boolean {
  return fs.statSync(filePath, { throwIfNoEntry: false })?.isFile() ?? false
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

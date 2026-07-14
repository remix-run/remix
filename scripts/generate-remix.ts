/**
 * Auto-generates the remix umbrella package by:
 * 1. Reading the manifest.json for all remix/* → @remix-run/* mappings
 * 2. Creating source files that re-export from each package and sub-export
 * 3. Generating exports configuration in package.json
 * 4. Setting up dependencies for all referenced packages
 *
 * Run: node scripts/generate-remix.ts
 */

import { statSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { parseSync } from 'oxc-parser'
import { logAndExec } from './utils/process.ts'
import { findReadmeForSpecifier } from './utils/remix-readmes.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../packages')
const remixDir = path.join(packagesDir, 'remix')
const remixChangesDir = path.join(remixDir, '.changes')
const remixPackageJsonPath = path.join(remixDir, 'package.json')
const manifestPath = path.join(remixDir, 'manifest.json')

const CLI_PACKAGE_NAME = '@remix-run/cli'
const SOURCE_FOLDER = 'src'
const REMIX_CLI_ENTRY_FILE = 'cli-entry.ts'
const DEFAULT_VALUE_RE_EXPORT_SPECIFIERS = new Set([
  '@remix-run/ui/button',
  '@remix-run/ui/checkbox',
  '@remix-run/ui/input',
  '@remix-run/ui/radio',
  '@remix-run/ui/toggle',
])

type RemixRunPackage = {
  name: string
  version: string
  packageJsonPath: string
  bins: BinEntry[]
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
}

type BinEntry = {
  // The bin command name: "remix-test"
  command: string
  // The export subpath derived from the bin file stem: "cli-entry" (from "./src/cli-entry.ts")
  sourceExport: string
}

type ExportEntry = {
  // The source file path relative to src: `headers.ts`, `headers/cookie-storage.ts`
  sourceFile: string
  // The export path in package.json exports: `./headers`, `./headers/cookie-storage`
  exportPath: string
  // The package/sub-export to re-export from: `@remix-run/headers`, `@remix-run/headers/cookie-storage`
  reExportFrom: string
  exportMode: ExportMode
  hasDefaultValueExport: boolean
  // The README file in the owning package to copy next to the generated umbrella export.
  readmePath?: string
}

type ExportMode = 'value' | 'type' | 'side-effect' | 'type-and-side-effect'

type ExportClassification = {
  hasDefaultValueExport: boolean
  hasRuntimeCode: boolean
  hasTypeExports: boolean
  hasValueExports: boolean
}

type UnknownRecord = Record<string, unknown>

type AstNode = UnknownRecord & {
  type: string
}

const manifest: Record<string, string> = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))
const remixRunPackages = await scanPackages()
const allExports = await buildExportsFromManifest(manifest, remixRunPackages)
const allBins = remixRunPackages
  .flatMap((pkg) =>
    pkg.bins.map((bin) => ({
      ...bin,
      packageName: pkg.name,
      packageJsonPath: pkg.packageJsonPath,
    })),
  )
  .sort((a, b) => a.command.localeCompare(b.command))

const remixPackageJson = JSON.parse(await fs.readFile(remixPackageJsonPath, 'utf-8'))

// Track existing exports and bins for comparison
const existingExports = new Set<string>(
  Object.keys(remixPackageJson.exports || {}).filter(
    (key) => key !== '.' && key !== './package.json',
  ),
)
const existingBins = new Set<string>(Object.keys(remixPackageJson.bin || {}))

// Update remixPackageJson in place and output to disk
await updateRemixPackage()

// Generate change files
await outputExportsChangeFiles(remixPackageJson.exports, remixPackageJson.bin || {})

// Implementations
async function scanPackages(): Promise<RemixRunPackage[]> {
  console.log('Scanning packages...')

  let packageDirNames = (await fs.readdir(packagesDir, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && dirent.name !== 'remix')
    .map((dirent) => dirent.name)

  let packages: RemixRunPackage[] = []

  for (let packageDirName of packageDirNames) {
    let packageJsonPath = path.join(packagesDir, packageDirName, 'package.json')
    if (!isFile(packageJsonPath)) continue

    let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    let packageName = packageJson.name as string
    if (!packageName.startsWith('@remix-run/')) continue

    let bins: BinEntry[] = []
    let packageBin = packageJson.bin
    if (packageBin && typeof packageBin === 'object') {
      for (let [command, binFile] of Object.entries(packageBin as Record<string, string>)) {
        let sourceExport = path.basename(binFile, path.extname(binFile))
        bins.push({ command, sourceExport })
      }
    }

    packages.push({
      name: packageName,
      version: packageJson.version,
      packageJsonPath,
      bins,
      peerDependencies: packageJson.peerDependencies ?? {},
      peerDependenciesMeta: packageJson.peerDependenciesMeta ?? {},
    })
  }

  console.log(`Found ${packages.length} @remix-run packages.`)
  return packages
}

/**
 * Builds ExportEntry list directly from the manifest. Each manifest entry
 * maps a remix/* path to a specifier. READMEs are attached once per generated
 * source file.
 */
async function buildExportsFromManifest(
  manifest: Record<string, string>,
  packages: RemixRunPackage[],
): Promise<ExportEntry[]> {
  let pkgJsonByName = new Map<string, Record<string, unknown>>()
  for (let pkg of packages) {
    // Eagerly load package.json content for README sub-export lookup
    try {
      pkgJsonByName.set(pkg.name, JSON.parse(await fs.readFile(pkg.packageJsonPath, 'utf-8')))
    } catch {}
  }

  let exports: ExportEntry[] = []
  let readmesWritten = new Set<string>()

  for (let [remixPath, specifier] of Object.entries(manifest)) {
    if (remixPath.startsWith('_')) continue // skip comment/metadata keys
    let sourceFile = getSourceFileForManifestEntry(remixPath, specifier)
    let exportPath = './' + remixPath.replace('remix/', '')

    let readmePath: string | undefined
    if (!readmesWritten.has(sourceFile)) {
      readmePath = findReadmeForSpecifier(specifier, pkgJsonByName)
      if (readmePath) readmesWritten.add(sourceFile)
    }
    let exportClassification = await getExportClassificationForSpecifier(specifier, pkgJsonByName)
    let exportMode = getExportMode(exportClassification)

    exports.push({
      sourceFile,
      exportPath,
      reExportFrom: specifier,
      exportMode,
      hasDefaultValueExport: exportClassification.hasDefaultValueExport,
      readmePath,
    })
  }

  // Add CLI entry — handled separately from the manifest
  let cliPkg = packages.find((p) => p.name === CLI_PACKAGE_NAME)
  if (cliPkg) {
    let readmePath = findReadmeForSpecifier(CLI_PACKAGE_NAME, pkgJsonByName)
    let exportClassification = await getExportClassificationForSpecifier(
      CLI_PACKAGE_NAME,
      pkgJsonByName,
    )
    let exportMode = getExportMode(exportClassification)
    exports.push({
      sourceFile: 'cli.ts',
      exportPath: './cli',
      reExportFrom: CLI_PACKAGE_NAME,
      exportMode,
      hasDefaultValueExport: exportClassification.hasDefaultValueExport,
      readmePath,
    })
  }

  exports.sort((a, b) => a.exportPath.localeCompare(b.exportPath))
  console.log(`Built ${exports.length} exports from manifest.`)
  return exports
}

function getSourceFileForManifestEntry(remixPath: string, specifier: string): string {
  return specifier.replace('@remix-run/', '') + '.ts'
}

function isFile(filePath: string): boolean {
  return statSync(filePath, { throwIfNoEntry: false })?.isFile() ?? false
}

async function updateRemixPackage() {
  // Ensure we have a passing linter before generating code
  logAndExec(`pnpm exec oxlint packages/remix/ --max-warnings=0`)

  // Clear existing source files
  let sourceFolderPath = path.join(remixDir, SOURCE_FOLDER)
  await fs.rm(sourceFolderPath, { recursive: true, force: true })
  await fs.mkdir(sourceFolderPath, { recursive: true })

  // Generate fresh source files
  console.log('Generating Remix source files...')
  let writtenSourceFiles = new Set<string>()
  for (let entry of allExports) {
    let sourceFilePath = path.join(remixDir, SOURCE_FOLDER, entry.sourceFile)
    // Create subdirectory if needed
    let sourceFileDir = path.dirname(sourceFilePath)
    await fs.mkdir(sourceFileDir, { recursive: true })
    // Multiple export paths may share one stub (e.g. legacy alias + canonical)
    if (!writtenSourceFiles.has(entry.sourceFile)) {
      writtenSourceFiles.add(entry.sourceFile)
      let content = createExportSource(entry)
      await fs.writeFile(sourceFilePath, content, 'utf-8')
    }

    if (!entry.readmePath) continue

    // Copy source-adjacent READMEs so agents can discover docs from node_modules/remix.
    let readmePath = path.join(
      remixDir,
      SOURCE_FOLDER,
      entry.sourceFile.replace(/\.ts$/, ''),
      'README.md',
    )
    await fs.mkdir(path.dirname(readmePath), { recursive: true })
    await fs.copyFile(entry.readmePath, readmePath)
  }

  // Run linter against generated code with --fix (before bin wrappers, which must keep their shebang)
  logAndExec(`pnpm exec oxlint packages/remix/ --fix --max-warnings=0`)

  if (allExports.some((entry) => entry.exportPath === './cli')) {
    let cliEntryPath = path.join(remixDir, SOURCE_FOLDER, REMIX_CLI_ENTRY_FILE)
    await fs.writeFile(cliEntryPath, createCliEntrySource(), 'utf-8')
    await fs.chmod(cliEntryPath, 0o755)
  }

  // Generate bin wrapper files and update sub-package exports
  for (let bin of allBins) {
    if (isRemixCliBin(bin) || isRemixTestBin(bin)) {
      continue
    }

    // Create wrapper file in remix/src/
    let wrapperPath = path.join(remixDir, SOURCE_FOLDER, `${bin.command}.ts`)
    let content = [
      `#!/usr/bin/env node`,
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `import '${bin.packageName}/${bin.sourceExport}'\n`,
    ].join('\n')
    await fs.writeFile(wrapperPath, content, 'utf-8')
    await fs.chmod(wrapperPath, 0o755)

    // Add ./cli (or equivalent) export to the sub-package's package.json
    let subPackageJson = JSON.parse(await fs.readFile(bin.packageJsonPath, 'utf-8'))
    let exportKey = `./${bin.sourceExport}`
    let binSrcFile = subPackageJson.bin[bin.command] as string
    subPackageJson.exports[exportKey] = binSrcFile
    subPackageJson.publishConfig.exports[exportKey] = subPackageJson.publishConfig.bin[bin.command]
    await fs.writeFile(bin.packageJsonPath, JSON.stringify(subPackageJson, null, 2) + '\n', 'utf-8')
  }

  // Update package.json
  console.log('Updating Remix package.json...')
  remixPackageJson.exports = {}
  remixPackageJson.publishConfig.exports = {}

  for (let entry of allExports) {
    let exportPath = path.join(SOURCE_FOLDER, entry.sourceFile)
    remixPackageJson.exports[entry.exportPath] = `./${exportPath}`

    let distFile = path.join(entry.sourceFile.replace(/\.ts$/, ''))
    remixPackageJson.publishConfig.exports[entry.exportPath] = {
      types: `./dist/${distFile}.d.ts`,
      default: `./dist/${distFile}.js`,
    }
  }

  remixPackageJson.exports['./package.json'] = './package.json'
  remixPackageJson.publishConfig.exports['./package.json'] = './package.json'
  if (allBins.length > 0 || allExports.some((entry) => entry.exportPath === './cli')) {
    remixPackageJson.bin = {}
    remixPackageJson.publishConfig.bin = {}

    if (allExports.some((entry) => entry.exportPath === './cli')) {
      remixPackageJson.bin.remix = `./${SOURCE_FOLDER}/${REMIX_CLI_ENTRY_FILE}`
      remixPackageJson.publishConfig.bin.remix = './dist/cli-entry.js'
    }

    for (let bin of allBins) {
      if (isRemixCliBin(bin) || isRemixTestBin(bin)) {
        continue
      }

      remixPackageJson.bin[bin.command] = `./${SOURCE_FOLDER}/${bin.command}.ts`
      remixPackageJson.publishConfig.bin[bin.command] = `./dist/${bin.command}.js`
    }
  } else {
    delete remixPackageJson.bin
    delete remixPackageJson.publishConfig.bin
  }

  let remixRunPackageNames = new Set(remixRunPackages.map((packageInfo) => packageInfo.name))
  for (let dependencyName of Object.keys(remixPackageJson.dependencies)) {
    if (dependencyName.startsWith('@remix-run/') && !remixRunPackageNames.has(dependencyName)) {
      delete remixPackageJson.dependencies[dependencyName]
    }
  }

  for (let packageInfo of remixRunPackages) {
    remixPackageJson.dependencies[packageInfo.name] = 'workspace:^'
  }

  // Lift peerDependencies from sub-packages to the umbrella package, preserving
  // optional flags from peerDependenciesMeta. A peer is treated as optional in
  // the umbrella if any sub-package declares it optional, since users of the
  // umbrella typically only consume a subset of sub-packages.
  let liftedPeerDeps: Record<string, string> = {}
  let liftedPeerDepsMeta: Record<string, { optional?: boolean }> = {}
  for (let packageInfo of remixRunPackages) {
    for (let [name, version] of Object.entries(packageInfo.peerDependencies)) {
      let existingVersion = liftedPeerDeps[name]
      if (existingVersion !== undefined && existingVersion !== version) {
        throw new Error(
          `Conflicting peerDependency version for "${name}": ${existingVersion} vs ${version}`,
        )
      }
      liftedPeerDeps[name] = version
      let optional = packageInfo.peerDependenciesMeta[name]?.optional
      if (optional) {
        liftedPeerDepsMeta[name] = { optional: true }
      }
    }
  }
  if (Object.keys(liftedPeerDeps).length > 0) {
    remixPackageJson.peerDependencies = liftedPeerDeps
    if (Object.keys(liftedPeerDepsMeta).length > 0) {
      remixPackageJson.peerDependenciesMeta = liftedPeerDepsMeta
    } else {
      delete remixPackageJson.peerDependenciesMeta
    }
  } else {
    delete remixPackageJson.peerDependencies
    delete remixPackageJson.peerDependenciesMeta
  }

  await fs.writeFile(
    remixPackageJsonPath,
    JSON.stringify(remixPackageJson, null, 2) + '\n',
    'utf-8',
  )
}

function isRemixCliBin(bin: { command: string; packageName: string }): boolean {
  return bin.packageName === CLI_PACKAGE_NAME && bin.command === 'remix'
}

function isRemixTestBin(bin: { command: string; packageName: string }): boolean {
  return bin.packageName === '@remix-run/test' && bin.command === 'remix-test'
}

function createExportSource(entry: ExportEntry): string {
  if (entry.reExportFrom === '@remix-run/fetch-router') {
    return [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `export * from '${entry.reExportFrom}'`,
      ``,
      `export interface RouterTypes {}`,
      `type RemixRouterTypes = RouterTypes`,
      ``,
      `declare module '@remix-run/fetch-router' {`,
      `  interface RouterTypes extends RemixRouterTypes {}`,
      `}\n`,
    ].join('\n')
  }

  if (entry.exportMode === 'type') {
    return [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `export type * from '${entry.reExportFrom}'\n`,
    ].join('\n')
  }

  if (entry.exportMode === 'side-effect') {
    return [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `import '${entry.reExportFrom}'`,
      `export {}\n`,
    ].join('\n')
  }

  if (entry.exportMode === 'type-and-side-effect') {
    return [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `import '${entry.reExportFrom}'`,
      `export type * from '${entry.reExportFrom}'\n`,
    ].join('\n')
  }

  if (entry.exportMode === 'value') {
    let lines = [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `export * from '${entry.reExportFrom}'`,
    ]

    if (entry.hasDefaultValueExport && DEFAULT_VALUE_RE_EXPORT_SPECIFIERS.has(entry.reExportFrom)) {
      lines.push(`export { default } from '${entry.reExportFrom}'`)
    }

    lines.push('')
    return lines.join('\n')
  }

  return unreachableExportMode(entry.exportMode)
}

async function getExportClassificationForSpecifier(
  specifier: string,
  pkgJsonByName: Map<string, Record<string, unknown>>,
): Promise<ExportClassification> {
  let parts = specifier.split('/')
  let packageName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  let packageDirName = packageName.replace('@remix-run/', '')
  let subPath = parts.slice(packageName.split('/').length).join('/')
  let pkgJson = pkgJsonByName.get(packageName)
  let exportConfig = (pkgJson?.exports as Record<string, unknown> | undefined)?.[
    subPath ? `./${subPath}` : '.'
  ]

  return getPackageExportClassification(packageDirName, exportConfig)
}

function getExportMode(classification: ExportClassification): ExportMode {
  if (classification.hasValueExports) {
    return 'value'
  }

  if (classification.hasTypeExports && classification.hasRuntimeCode) {
    return 'type-and-side-effect'
  }

  if (classification.hasTypeExports) {
    return 'type'
  }

  if (classification.hasRuntimeCode) {
    return 'side-effect'
  }

  throw new Error('Unable to generate an export for empty module')
}

async function getPackageExportClassification(
  packageDirName: string,
  exportConfig: unknown,
): Promise<ExportClassification> {
  let exportTarget = getPackageExportTarget(exportConfig)
  if (!exportTarget) {
    return {
      hasDefaultValueExport: false,
      hasRuntimeCode: false,
      hasTypeExports: false,
      hasValueExports: true,
    }
  }

  let sourceFilePath = path.join(packagesDir, packageDirName, exportTarget)
  let source = await fs.readFile(sourceFilePath, 'utf-8')
  let classification = classifyExports(sourceFilePath, source)
  getExportMode(classification)
  return classification
}

function unreachableExportMode(exportMode: never): never {
  throw new Error(`Unhandled export mode "${exportMode}"`)
}

function getPackageExportTarget(exportConfig: unknown): string | null {
  if (typeof exportConfig === 'string') {
    return exportConfig
  }

  if (!isRecord(exportConfig)) {
    return null
  }

  let target = exportConfig.default ?? exportConfig.import ?? exportConfig.types
  return typeof target === 'string' ? target : null
}

function classifyExports(sourceFilePath: string, source: string): ExportClassification {
  let parseResult = parseSync(sourceFilePath, source, { sourceType: 'module' })
  let errors = getArrayProperty(parseResult, 'errors')
  if (errors.length > 0) {
    throw new Error(
      `Failed to parse ${sourceFilePath}:\n${errors.map((error) => String(error)).join('\n')}`,
    )
  }

  let classification: ExportClassification = {
    hasDefaultValueExport: false,
    hasRuntimeCode: false,
    hasTypeExports: false,
    hasValueExports: false,
  }

  for (let node of getProgramBody(parseResult)) {
    classifyTopLevelNode(node, classification)
  }

  return classification
}

function classifyTopLevelNode(node: AstNode, classification: ExportClassification): void {
  if (node.type === 'ExportNamedDeclaration') {
    classifyNamedExport(node, classification)
    return
  }

  if (node.type === 'ExportDefaultDeclaration') {
    classification.hasDefaultValueExport = true
    if (getStringProperty(node, 'exportKind') === 'type') {
      classification.hasTypeExports = true
    } else {
      classification.hasValueExports = true
    }
    return
  }

  if (node.type === 'ExportAllDeclaration') {
    if (getStringProperty(node, 'exportKind') === 'type') {
      classification.hasTypeExports = true
    } else {
      classification.hasValueExports = true
    }
    return
  }

  if (isRuntimeNode(node)) {
    classification.hasRuntimeCode = true
  }
}

function classifyNamedExport(node: AstNode, classification: ExportClassification): void {
  let declaration = getNodeProperty(node, 'declaration')
  let specifiers = getNodeArrayProperty(node, 'specifiers')

  // `export {}` marks the file as a module but does not add a public export.
  if (!declaration && specifiers.length === 0) {
    return
  }

  if (getStringProperty(node, 'exportKind') === 'type') {
    classification.hasTypeExports = true
    return
  }

  if (declaration) {
    if (isTypeOnlyDeclaration(declaration)) {
      classification.hasTypeExports = true
    } else {
      classification.hasValueExports = true
    }
  }

  for (let specifier of specifiers) {
    if (getStringProperty(specifier, 'exportKind') === 'type') {
      classification.hasTypeExports = true
    } else {
      classification.hasValueExports = true
    }
  }
}

function isTypeOnlyDeclaration(node: AstNode): boolean {
  return (
    getBooleanProperty(node, 'declare') ||
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'TSTypeAliasDeclaration'
  )
}

function isRuntimeNode(node: AstNode): boolean {
  if (node.type === 'ImportDeclaration') {
    return getStringProperty(node, 'importKind') !== 'type'
  }

  return !isTypeOnlyTopLevelNode(node)
}

function isTypeOnlyTopLevelNode(node: AstNode): boolean {
  if (
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'TSTypeAliasDeclaration'
  ) {
    return true
  }

  if (node.type === 'TSModuleDeclaration') {
    return getBooleanProperty(node, 'declare')
  }

  return false
}

function getProgramBody(parseResult: unknown): AstNode[] {
  let program = isRecord(parseResult) ? parseResult.program : null
  if (!isRecord(program)) {
    return []
  }

  return getNodeArrayProperty(program, 'body')
}

function getNodeProperty(record: UnknownRecord, key: string): AstNode | null {
  let value = record[key]
  return isNode(value) ? value : null
}

function getNodeArrayProperty(record: UnknownRecord, key: string): AstNode[] {
  return getArrayProperty(record, key).filter(isNode)
}

function getArrayProperty(record: unknown, key: string): unknown[] {
  if (!isRecord(record)) {
    return []
  }

  let value = record[key]
  return Array.isArray(value) ? value : []
}

function getStringProperty(record: UnknownRecord, key: string): string | null {
  let value = record[key]
  return typeof value === 'string' ? value : null
}

function getBooleanProperty(record: UnknownRecord, key: string): boolean {
  return record[key] === true
}

function isNode(value: unknown): value is AstNode {
  return isRecord(value) && typeof value.type === 'string'
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function createCliEntrySource(): string {
  return `#!/usr/bin/env node
// IMPORTANT: This file is auto-generated, please do not edit manually.
import * as process from 'node:process'

import { runRemix } from './cli.ts'

try {
  let exitCode = await runRemix(process.argv.slice(2))
  process.exit(exitCode)
} catch (error) {
  console.error(error)
  process.exit(1)
}
`
}

// Build exports change summary
async function outputExportsChangeFiles(
  exportsConfig: Record<string, string>,
  binsConfig: Record<string, string>,
) {
  let newExportsSet = new Set<string>(
    Object.keys(exportsConfig).filter((key) => key !== '.' && key !== './package.json'),
  )
  let generatedSourceFiles = new Set(allExports.map((entry) => entry.sourceFile))
  let filteredExistingExports = new Set(existingExports)
  let addedExports = Array.from(newExportsSet).filter((key) => !filteredExistingExports.has(key))
  let removedExports = Array.from(filteredExistingExports).filter((key) => !newExportsSet.has(key))

  let newBinsSet = new Set<string>(Object.keys(binsConfig))
  let addedBins = Array.from(newBinsSet).filter((cmd) => !existingBins.has(cmd))
  let removedBins = Array.from(existingBins).filter((cmd) => !newBinsSet.has(cmd))

  if (
    addedExports.length === 0 &&
    removedExports.length === 0 &&
    addedBins.length === 0 &&
    removedBins.length === 0
  ) {
    return
  }

  let semverType = removedExports.length > 0 || removedBins.length > 0 ? 'major' : 'minor'
  let changeFileBaseName = 'remix.update-exports.md'
  let changeFile = path.join(remixChangesDir, `${semverType}.${changeFileBaseName}`)
  let alternateSemverType = semverType === 'major' ? 'minor' : 'major'
  let alternateChangeFile = path.join(
    remixChangesDir,
    `${alternateSemverType}.${changeFileBaseName}`,
  )
  let legacyChangeFilePattern = /^(major|minor)\.remix\.update-exports-\d+\.md$/
  let changes = ''

  await fs.mkdir(remixChangesDir, { recursive: true })

  // Remove any old timestamped exports change files from prior runs.
  for (let fileName of await fs.readdir(remixChangesDir)) {
    if (!legacyChangeFilePattern.test(fileName)) {
      continue
    }
    await fs.unlink(path.join(remixChangesDir, fileName))
  }

  // Remove the alternate semver deterministic file if present so we only keep one.
  try {
    await fs.unlink(alternateChangeFile)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e
    }
  }

  if (removedExports.length > 0) {
    console.log()
    console.log('Removed package.json exports:')
    changes += (changes ? '\n' : '') + 'Removed `package.json` `exports`:\n'
    for (let exportPath of removedExports) {
      exportPath = exportPath.replace('./', '')
      let exportName = `remix/${exportPath}`
      console.log(`   - ${exportName}`)
      changes += ` - \`${exportName}\`\n`

      // Remove re-export file
      let sourceFile = exportPath + '.ts'
      if (generatedSourceFiles.has(sourceFile)) continue

      let srcFile = path.join(remixDir, SOURCE_FOLDER, sourceFile)
      try {
        await fs.unlink(srcFile)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw e
        }
      }
    }
  }

  if (addedExports.length > 0) {
    console.log()
    console.log('Added package.json exports:')
    changes += (changes ? '\n' : '') + 'Added `package.json` `exports`:\n'
    for (let exportPath of addedExports) {
      let entry = allExports.find((e) => e.exportPath === exportPath)
      exportPath = `remix/${exportPath.replace('./', '')}`
      if (entry) {
        console.log(`   - ${exportPath} → ${entry.reExportFrom}`)
        changes += ` - \`${exportPath}\` to re-export APIs from \`${entry.reExportFrom}\`\n`
      }
    }
  }

  if (removedBins.length > 0) {
    console.log()
    console.log('Removed package.json bin commands:')
    changes += (changes ? '\n' : '') + 'Removed `package.json` `bin` commands:\n'
    for (let command of removedBins) {
      console.log(`   - ${command}`)
      changes += ` - \`${command}\`\n`
    }
  }

  if (addedBins.length > 0) {
    console.log()
    console.log('Added package.json bin commands:')
    changes += (changes ? '\n' : '') + 'Added `package.json` `bin` commands:\n'
    for (let command of addedBins) {
      let bin = allBins.find((b) => b.command === command)
      if (bin) {
        console.log(`   - ${command} → ${bin.packageName}`)
        changes += ` - \`${command}\` delegating to \`${bin.packageName}\`\n`
      }
    }
  }

  await fs.writeFile(changeFile, changes, 'utf-8')
  console.log()
  console.log('Created exports change file:')
  console.log(`   - ${path.relative(process.cwd(), changeFile)}`)
}

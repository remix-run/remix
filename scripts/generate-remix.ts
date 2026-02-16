/**
 * Auto-generates the remix umbrella package by:
 * 1. Scanning all @remix-run/* packages in packages/ directory
 * 2. Creating source files that re-export from each package and sub-export
 * 3. Generating exports configuration in package.json
 * 4. Setting up dependencies for all referenced packages
 *
 * Run: node docs/generate-remix.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import * as semver from 'semver'
import { logAndExec } from './utils/process.ts'

let __dirname = path.dirname(url.fileURLToPath(import.meta.url))
let packagesDir = path.resolve(__dirname, '../packages')
let remixDir = path.join(packagesDir, 'remix')
let remixChangesDir = path.join(remixDir, '.changes')
let remixPackageJsonPath = path.join(remixDir, 'package.json')

const SOURCE_FOLDER = 'src'

type RemixRunPackage = {
  name: string
  version: string
  exports: ExportEntry[]
}

type ExportEntry = {
  // The source file path relative to src: `headers.ts`, `headers/cookie-storage.ts`
  sourceFile: string
  // The export path in package.json exports: `./headers`, `./headers/cookie-storage`1
  exportPath: string
  // The package/sub-export to re-export from: `@remix-run/headers`, `@remix-run/headers/cookie-storage`
  reExportFrom: string
  // Source module file in the package where generator markers can be read
  upstreamSourceFile: string
}

let { remixRunPackages, allExports } = await getRemixRunPackages()
let remixPackageJson = JSON.parse(await fs.readFile(remixPackageJsonPath, 'utf-8'))

// Track existing exports for comparison
let existingExports = new Set<string>(
  Object.keys(remixPackageJson.exports || {}).filter(
    (key) => key !== '.' && key !== './package.json',
  ),
)

// Update remixPackageJson in place and output to disk
await updateRemixPackage()

// Generate change files
await outputExportsChangeFiles(remixPackageJson.exports)
await outputDependencyChangeFiles()

// Implementations
async function getRemixRunPackages() {
  console.log('Scanning packages...')

  // Get all packages except remix itself
  let packageDirNames = (await fs.readdir(packagesDir, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && dirent.name !== 'remix')
    .map((dirent) => dirent.name)

  let remixRunPackages: RemixRunPackage[] = []

  // Scan each package for its exports
  for (let packageDirName of packageDirNames) {
    let packageJsonPath = path.join(packagesDir, packageDirName, 'package.json')
    let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    let packageName = packageJson.name as string

    // Skip if not a @remix-run package
    if (!packageName.startsWith('@remix-run/')) {
      continue
    }

    let remixRunPackage: RemixRunPackage = {
      name: packageName,
      version: packageJson.version,
      exports: [],
    }
    remixRunPackages.push(remixRunPackage)

    let shortName = packageName.replace('@remix-run/', '')

    // Get all exports except package.json
    let packageExports = packageJson.exports
    if (packageExports && typeof packageExports === 'object') {
      for (let [exportPath, exportValue] of Object.entries(packageExports)) {
        if (exportPath === './package.json') continue

        if (exportPath === '.') {
          // Main export
          let upstreamExportSourcePath = getUpstreamSourceTsPathFromPackageExport(
            packageName,
            exportPath,
            exportValue,
          )
          remixRunPackage.exports.push({
            sourceFile: `${shortName}.ts`,
            exportPath: `./${shortName}`,
            reExportFrom: packageName,
            upstreamSourceFile: path.join(packagesDir, packageDirName, upstreamExportSourcePath),
          })
        } else {
          // Sub-export (e.g., "./cookie-storage")
          let subExport = exportPath.replace('./', '')
          let upstreamExportSourcePath = getUpstreamSourceTsPathFromPackageExport(
            packageName,
            exportPath,
            exportValue,
          )
          remixRunPackage.exports.push({
            sourceFile: `${shortName}/${subExport}.ts`,
            exportPath: `./${shortName}/${subExport}`,
            reExportFrom: `${packageName}/${subExport}`,
            upstreamSourceFile: path.join(packagesDir, packageDirName, upstreamExportSourcePath),
          })
        }
      }
    }
  }

  // Sort exports by export path for consistent ordering
  let allExports = remixRunPackages.flatMap((pkg) => pkg.exports)
  allExports.sort((a, b) => a.exportPath.localeCompare(b.exportPath))

  console.log(
    `Found ${remixRunPackages.length} @remix-run packages with a total of ${allExports.length} exports.`,
  )

  return { remixRunPackages, allExports }
}

async function updateRemixPackage() {
  // Ensure we have a passing linter before generating code
  logAndExec(`npx eslint packages/remix/ --max-warnings=0`)

  // Clear existing source files
  let sourceFolderPath = path.join(remixDir, SOURCE_FOLDER)
  await fs.rm(sourceFolderPath, { recursive: true, force: true })
  await fs.mkdir(sourceFolderPath, { recursive: true })

  // Generate fresh source files
  console.log('Generating Remix source files...')
  for (let entry of allExports) {
    let sourceFilePath = path.join(remixDir, SOURCE_FOLDER, entry.sourceFile)
    // Create subdirectory if needed
    let sourceFileDir = path.dirname(sourceFilePath)
    await fs.mkdir(sourceFileDir, { recursive: true })
    let content = [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      ...(await createModuleAugmentationHooks(entry)),
      `export * from '${entry.reExportFrom}'`,
      ``,
    ].join('\n')
    await fs.writeFile(sourceFilePath, content, 'utf-8')
  }

  // Run linter against generated code with --fix
  logAndExec(`npx eslint packages/remix/ --max-warnings=0 --fix`)

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

  for (let packageInfo of remixRunPackages) {
    remixPackageJson.dependencies[packageInfo.name] = 'workspace:^'
  }

  await fs.writeFile(
    remixPackageJsonPath,
    JSON.stringify(remixPackageJson, null, 2) + '\n',
    'utf-8',
  )
}

function getUpstreamSourceTsPathFromPackageExport(
  packageName: string,
  exportPath: string,
  exportValue: unknown,
): string {
  if (typeof exportValue === 'string') {
    if (exportValue.endsWith('.ts')) return exportValue
    throw new Error(
      `Expected TypeScript source path for ${packageName} export "${exportPath}", got "${exportValue}"`,
    )
  }

  if (exportValue && typeof exportValue === 'object') {
    let upstreamSourcePath =
      (exportValue as any).default ?? (exportValue as any).import ?? (exportValue as any).types
    if (typeof upstreamSourcePath === 'string' && upstreamSourcePath.endsWith('.ts')) {
      return upstreamSourcePath
    }
  }

  throw new Error(
    `Expected TypeScript source path for ${packageName} export "${exportPath}", but no .ts entry was found`,
  )
}

async function createModuleAugmentationHooks(entry: ExportEntry): Promise<string[]> {
  let sourceFileContents = await fs.readFile(entry.upstreamSourceFile, 'utf-8')
  let markerPattern = /@remix:module-augmentation-hook\s+([A-Za-z_]\w*)/g
  let hookNames = new Set<string>()

  for (let match of sourceFileContents.matchAll(markerPattern)) {
    let hookName = match[1]
    hookNames.add(hookName)
  }

  let augmentationHooks = Array.from(hookNames)
  if (augmentationHooks.length === 0) return []

  let remixModuleName = `remix/${entry.exportPath.replace('./', '')}`
  return [
    `import type * as RemixModule from '${remixModuleName}'`,
    '',
    ...augmentationHooks.map((hookName) => `export interface ${hookName} {}`),
    '',
    `declare module '${entry.reExportFrom}' {`,
    ...augmentationHooks.map(
      (hookName) => `  interface ${hookName} extends RemixModule.${hookName} {}`,
    ),
    `}`,
    '',
  ]
}

// Build exports change summary
async function outputExportsChangeFiles(exportsConfig: Record<string, string>) {
  let newExportsSet = new Set<string>(
    Object.keys(exportsConfig).filter((key) => key !== '.' && key !== './package.json'),
  )
  let addedExports = Array.from(newExportsSet).filter((key) => !existingExports.has(key))
  let removedExports = Array.from(existingExports).filter((key) => !newExportsSet.has(key))

  if (addedExports.length === 0 && removedExports.length === 0) {
    return
  }

  let semverType = removedExports.length > 0 ? 'major' : 'minor'
  let changeFile = path.join(remixChangesDir, `${semverType}.remix.update-exports-${Date.now()}.md`)
  let changes = ''

  if (removedExports.length > 0) {
    console.log()
    console.log('Removed package.json exports:')
    changes += 'Removed `package.json` `exports`:\n'
    for (let exportPath of removedExports) {
      exportPath = exportPath.replace('./', '')
      let exportName = `remix/${exportPath}`
      console.log(`   - ${exportName}`)
      changes += ` - \`${exportName}\`\n`

      // Remove re-export file
      let srcFile = path.join(remixDir, SOURCE_FOLDER, exportPath + '.ts')
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
    changes += 'Added `package.json` `exports`:\n'
    for (let exportPath of addedExports) {
      let entry = allExports.find((e) => e.exportPath === exportPath)
      exportPath = `remix/${exportPath.replace('./', '')}`
      if (entry) {
        console.log(`   - ${exportPath} → ${entry.reExportFrom}`)
        changes += ` - \`${exportPath}\` to re-export APIs from \`${entry.reExportFrom}\`\n`
      }
    }
  }

  await fs.writeFile(changeFile, changes, 'utf-8')
  console.log()
  console.log('Created exports change file:')
  console.log(`   - ${path.relative(process.cwd(), changeFile)}`)
}

// Build dependencies change summary
async function outputDependencyChangeFiles() {
  let changeFilePath = path.join(remixChangesDir, 'patch.remix.update-dependencies.md')

  // Get all `remix@` tags in the git repository
  let remixTags = logAndExec('git tag', true)
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((tag) => tag.startsWith('remix@') && semver.major(tag.replace('remix@', '')) >= 3)

  if (remixTags.length === 0) {
    console.log('No previous remix releases found, skipping dependency change file')
    return
  }

  // Sort by semver version ascending
  remixTags.sort((a, b) => semver.compare(a.replace('remix@', ''), b.replace('remix@', '')))

  // Grab the latest stable release, or the latest prerelease if no stable exists
  let lastReleaseTag =
    remixTags.findLast((tag) => semver.prerelease(tag.replace(/^remix@/, '')) == null) ||
    remixTags[remixTags.length - 1]

  console.log(`Comparing dependencies against last release: ${lastReleaseTag}`)

  // Checkout that tag in the repository
  logAndExec(`git checkout ${lastReleaseTag}`)

  // Get all @remix-run package versions in that commit via getRemixRunPackages()
  let { remixRunPackages: previousPackages } = await getRemixRunPackages()

  // Go back to the branch we started at
  logAndExec(`git checkout -`)

  // Create change file
  let lines = []

  // Added/Updated
  for (let pkg of remixRunPackages) {
    let prevPkg = previousPackages.find((p) => p.name === pkg.name)

    if (!prevPkg) {
      lines.push(`- Added \`${pkg.name}@${pkg.version}\``)
    } else if (prevPkg.version !== pkg.version) {
      lines.push(`- Updated \`${pkg.name}@${prevPkg.version}\` → \`${pkg.name}@${pkg.version}\``)
    }
  }

  // Removed
  for (let pkg of previousPackages) {
    if (!remixRunPackages.find((p) => p.name === pkg.name)) {
      lines.push(`- Removed \`${pkg.name}@${pkg.version}\``)
    }
  }

  if (lines.length === 0) {
    return
  }

  let contents = ['Updated dependencies:', ...lines].join('\n')

  // Write change file
  let exists = await fileExists(changeFilePath)
  if (exists) {
    let oldContents = await fs.readFile(changeFilePath, 'utf-8')
    if (contents === oldContents) {
      console.log('No changes to existing dependencies change file')
      return
    }
  }

  await fs.writeFile(changeFilePath, contents, 'utf-8')
  console.log()
  console.log(`${exists ? 'Updated' : 'Created'} dependencies change file:`)
  console.log(`   - ${path.relative(process.cwd(), changeFilePath)}`)
}

async function fileExists(filePath: string) {
  try {
    // Throws if the file doesn't exist.  This feels weird using try/catch for control flow
    // but `fs.exists` is deprecated and `fs.stat` recommends `fs.access`:
    //   https://nodejs.org/api/fs.html#fsexistspath-callback
    //   https://nodejs.org/api/fs.html#fsstatpath-options-callback
    await fs.access(filePath, fs.constants.F_OK)
    return true
  } catch (e) {
    return false
  }
}

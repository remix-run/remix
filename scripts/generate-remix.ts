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
import { logAndExec } from './utils/process.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../packages')
const remixDir = path.join(packagesDir, 'remix')
const remixChangesDir = path.join(remixDir, '.changes')
const remixPackageJsonPath = path.join(remixDir, 'package.json')

const SOURCE_FOLDER = 'src'

type RemixRunPackage = {
  name: string
  version: string
  packageJsonPath: string
  exports: ExportEntry[]
  bins: BinEntry[]
}

type BinEntry = {
  // The bin command name: "remix-test"
  command: string
  // The export subpath derived from the bin file stem: "cli" (from "./src/cli.ts")
  sourceExport: string
}

type ExportEntry = {
  // The source file path relative to src: `headers.ts`, `headers/cookie-storage.ts`
  sourceFile: string
  // The export path in package.json exports: `./headers`, `./headers/cookie-storage`1
  exportPath: string
  // The package/sub-export to re-export from: `@remix-run/headers`, `@remix-run/headers/cookie-storage`
  reExportFrom: string
}

const { remixRunPackages, allExports, allBins } = await getRemixRunPackages()
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

    let bins: BinEntry[] = []
    let packageBin = packageJson.bin
    if (packageBin && typeof packageBin === 'object') {
      for (let [command, binFile] of Object.entries(packageBin as Record<string, string>)) {
        let sourceExport = path.basename(binFile, path.extname(binFile))
        bins.push({ command, sourceExport })
      }
    }

    let remixRunPackage: RemixRunPackage = {
      name: packageName,
      version: packageJson.version,
      packageJsonPath,
      exports: [],
      bins,
    }
    remixRunPackages.push(remixRunPackage)

    let shortName = packageName.replace('@remix-run/', '')

    // Get all exports except package.json and bin-derived exports (e.g. "./cli")
    let binExports = new Set(bins.map((b) => `./${b.sourceExport}`))
    let packageExports = packageJson.exports
    if (packageExports && typeof packageExports === 'object') {
      for (let [exportPath, _] of Object.entries(packageExports)) {
        if (exportPath === './package.json') continue
        if (binExports.has(exportPath)) continue

        if (exportPath === '.') {
          // Main export
          remixRunPackage.exports.push({
            sourceFile: `${shortName}.ts`,
            exportPath: `./${shortName}`,
            reExportFrom: packageName,
          })
        } else {
          // Sub-export (e.g., "./cookie-storage")
          let subExport = exportPath.replace('./', '')
          remixRunPackage.exports.push({
            sourceFile: `${shortName}/${subExport}.ts`,
            exportPath: `./${shortName}/${subExport}`,
            reExportFrom: `${packageName}/${subExport}`,
          })
        }
      }
    }
  }

  // Sort exports by export path for consistent ordering
  let allExports = remixRunPackages.flatMap((pkg) => pkg.exports)
  allExports.sort((a, b) => a.exportPath.localeCompare(b.exportPath))

  // Sort bins by command for consistent ordering
  let allBins = remixRunPackages.flatMap((pkg) =>
    pkg.bins.map((bin) => ({
      ...bin,
      packageName: pkg.name,
      packageJsonPath: pkg.packageJsonPath,
    })),
  )
  allBins.sort((a, b) => a.command.localeCompare(b.command))

  console.log(
    `Found ${remixRunPackages.length} @remix-run packages with a total of ${allExports.length} exports.`,
  )

  return { remixRunPackages, allExports, allBins }
}

async function updateRemixPackage() {
  // Ensure we have a passing linter before generating code
  logAndExec(`pnpm exec oxlint packages/remix/ -A all --quiet`)

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
      `export * from '${entry.reExportFrom}'\n`,
    ].join('\n')
    await fs.writeFile(sourceFilePath, content, 'utf-8')
  }

  // Run linter against generated code with --fix (before bin wrappers, which must keep their shebang)
  logAndExec(`pnpm exec oxlint packages/remix/ -A all --fix --quiet`)

  // Generate bin wrapper files and update sub-package exports
  for (let bin of allBins) {
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

  if (allBins.length > 0) {
    remixPackageJson.bin = {}
    remixPackageJson.publishConfig.bin = {}
    for (let bin of allBins) {
      remixPackageJson.bin[bin.command] = `./${SOURCE_FOLDER}/${bin.command}.ts`
      remixPackageJson.publishConfig.bin[bin.command] = `./dist/${bin.command}.js`
    }
  } else {
    delete remixPackageJson.bin
    delete remixPackageJson.publishConfig.bin
  }

  for (let packageInfo of remixRunPackages) {
    remixPackageJson.dependencies[packageInfo.name] = 'workspace:^'
  }

  await fs.writeFile(
    remixPackageJsonPath,
    JSON.stringify(remixPackageJson, null, 2) + '\n',
    'utf-8',
  )
}

// Build exports change summary
async function outputExportsChangeFiles(
  exportsConfig: Record<string, string>,
  binsConfig: Record<string, string>,
) {
  let newExportsSet = new Set<string>(
    Object.keys(exportsConfig).filter((key) => key !== '.' && key !== './package.json'),
  )
  let addedExports = Array.from(newExportsSet).filter((key) => !existingExports.has(key))
  let removedExports = Array.from(existingExports).filter((key) => !newExportsSet.has(key))

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

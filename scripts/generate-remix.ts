/**
 * Auto-generates the remix umbrella package by:
 * 1. Scanning all @remix-run/* packages in packages/ directory
 * 2. Creating source files that re-export from each package and sub-export
 * 3. Generating exports configuration in package.json
 * 4. Setting up peerDependencies for all referenced packages
 *
 * Run: node docs/generate-remix.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'

let __dirname = path.dirname(url.fileURLToPath(import.meta.url))
let packagesDir = path.resolve(__dirname, '../packages')
let remixDir = path.join(packagesDir, 'remix')
let remixPackageJsonPath = path.join(remixDir, 'package.json')

// Don't do anything with change files until we actually publish an initial Remix v3 alpha
// release, since only then will we care to start documenting what changed.
// And Maybe not even until our first stable release.
const GENERATE_CHANGE_FILES = false
const SOURCE_FOLDER = 'src'
const SUB_EXPORT_FOLDER = 'lib'

type RemixRunPackage = {
  name: string
  version: string
  exports: ExportEntry[]
  changeFiles: string[]
}

type ExportEntry = {
  // The source file path relative to src/lib: `headers.ts`, `headers/cookie-storage.ts`
  sourceFile: string
  // The export path in package.json exports: `./headers`, `./headers/cookie-storage`1
  exportPath: string
  // The package/sub-export to re-export from: `@remix-run/headers`, `@remix-run/headers/cookie-storage`
  reExportFrom: string
}

let { remixRunPackages, allExports } = await getRemixRunPackages()

// Generate source files iun
await generateRemixSourceFiles()

// Update package.json
console.log('📦 Updating package.json...')
let remixPackageJson = JSON.parse(await fs.readFile(remixPackageJsonPath, 'utf-8'))

// Track existing exports and peerDependencies for comparison
let existingInfo = {
  exports: new Set<string>(
    Object.keys(remixPackageJson.exports || {}).filter(
      (key) => key !== '.' && key !== './package.json',
    ),
  ),
  peerDependencies: new Set<string>(Object.keys(remixPackageJson.peerDependencies || {})),
}

// Build exports/publishConfig.exports/peerDependencies/publishConfig.peerDependencies
let { exportsConfig, publishConfigExports } = getRemixExports()
let { peerDependencies, publishConfigPeerDependencies } = getRemixPeerDependencies()

// Update package.json
remixPackageJson.exports = exportsConfig
remixPackageJson.publishConfig.exports = publishConfigExports
remixPackageJson.peerDependencies = peerDependencies
remixPackageJson.publishConfig.peerDependencies = publishConfigPeerDependencies

await fs.writeFile(remixPackageJsonPath, JSON.stringify(remixPackageJson, null, 2) + '\n', 'utf-8')

// Generate change summary
await outputExportsChanges()
await outputPeerDependencyChanges()

//  Copy change files up to remix changes directory
if (GENERATE_CHANGE_FILES) {
  await copySubPackageChangeFiles()
}

// Implementations

async function getRemixRunPackages() {
  console.log('🔍 Scanning packages...')

  // Get all packages except remix itself
  let packageDirs = (await fs.readdir(packagesDir, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && dirent.name !== 'remix')
    .map((dirent) => dirent.name)

  let remixRunPackages: RemixRunPackage[] = []

  // Scan each package for its exports
  for (let packageDir of packageDirs) {
    let packageJsonPath = path.join(packagesDir, packageDir, 'package.json')
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
      changeFiles: [],
    }
    remixRunPackages.push(remixRunPackage)

    let shortName = packageName.replace('@remix-run/', '')

    // Get all exports except package.json
    let packageExports = packageJson.exports
    if (packageExports && typeof packageExports === 'object') {
      for (let [exportPath, _] of Object.entries(packageExports)) {
        if (exportPath === './package.json') continue

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

    let changesDir = path.join(packagesDir, packageDir, '.changes')
    try {
      let changeFiles = await fs.readdir(changesDir)
      for (let changeFile of changeFiles) {
        if (changeFile === 'README.md') {
          continue
        }
        remixRunPackage.changeFiles.push(path.join(changesDir, changeFile))
      }
    } catch (e) {
      // No .changes directory or can't read it, skip
    }
  }

  // Sort exports by export path for consistent ordering
  let allExports = remixRunPackages.flatMap((pkg) => pkg.exports)
  allExports.sort((a, b) => a.exportPath.localeCompare(b.exportPath))

  console.log(
    `📝 Found ${remixRunPackages.length} @remix-run packages with a total of ${allExports.length} exports.`,
  )

  return { remixRunPackages, allExports }
}

async function generateRemixSourceFiles() {
  console.log('📄 Generating source files...')
  for (let entry of allExports) {
    let sourceFilePath = path.join(remixDir, SOURCE_FOLDER, SUB_EXPORT_FOLDER, entry.sourceFile)
    // Create subdirectory if needed
    let sourceFileDir = path.dirname(sourceFilePath)
    await fs.mkdir(sourceFileDir, { recursive: true })
    let content = [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `export * from '${entry.reExportFrom}'\n`,
    ].join('\n')
    await fs.writeFile(sourceFilePath, content, 'utf-8')
  }
}

function getRemixExports() {
  let exportsConfig: Record<string, string> = {
    '.': './src/index.ts',
  }
  let publishConfigExports: Record<string, any> = {
    '.': {
      types: './dist/index.d.ts',
      default: './dist/index.js',
    },
  }

  for (let entry of allExports) {
    let exportPath = path.join(SOURCE_FOLDER, SUB_EXPORT_FOLDER, entry.sourceFile)
    exportsConfig[entry.exportPath] = `./${exportPath}`

    let distFile = path.join(SUB_EXPORT_FOLDER, entry.sourceFile.replace(/\.ts$/, ''))
    publishConfigExports[entry.exportPath] = {
      types: `./dist/${distFile}.d.ts`,
      default: `./dist/${distFile}.js`,
    }
  }

  exportsConfig['./package.json'] = './package.json'
  publishConfigExports['./package.json'] = './package.json'

  return { exportsConfig, publishConfigExports }
}

function getRemixPeerDependencies() {
  let peerDependencies: Record<string, string> = {}
  let publishConfigPeerDependencies: Record<string, string> = {}
  for (let packageInfo of remixRunPackages) {
    peerDependencies[packageInfo.name] = 'workspace:^'
    publishConfigPeerDependencies[packageInfo.name] = `^${packageInfo.version}`
  }

  return { peerDependencies, publishConfigPeerDependencies }
}

// Build exports change summary
async function outputExportsChanges() {
  let newExportsSet = new Set<string>(
    Object.keys(exportsConfig).filter((key) => key !== '.' && key !== './package.json'),
  )
  let addedExports = Array.from(newExportsSet).filter((key) => !existingInfo.exports.has(key))
  let removedExports = Array.from(existingInfo.exports).filter((key) => !newExportsSet.has(key))

  if (addedExports.length === 0 && removedExports.length === 0) {
    return
  }

  let semverType = removedExports.length > 0 ? 'major' : 'minor'
  let changeFile = path.join(
    `${remixDir}`,
    '.changes',
    `${semverType}.update-exports-${Date.now()}.md`,
  )
  let changes = ''

  if (removedExports.length > 0) {
    console.log()
    console.log('⚠️ Removed package.json exports:')
    changes += 'Removed `package.json` `exports`:\n'
    for (let exportPath of removedExports) {
      exportPath = exportPath.replace('./', '')
      let exportName = `remix/${exportPath}`
      console.log(`   - ${exportName}`)
      changes += ` - \`${exportName}\`\n`

      // Remove re-export file
      let srcFile = path.join(remixDir, SOURCE_FOLDER, SUB_EXPORT_FOLDER, exportPath + '.ts')
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
    console.log('✨ Added package.json exports:')
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

  if (GENERATE_CHANGE_FILES) {
    await fs.writeFile(changeFile, changes, 'utf-8')
    console.log()
    console.log('✨ Created exports change file:')
    console.log(`   - ${path.relative(process.cwd(), changeFile)}`)
  }
}

// Build peerDependencies/publishConfig.peerDependencies change summary
async function outputPeerDependencyChanges() {
  let newPeerDepsSet = new Set<string>(Object.keys(peerDependencies))
  let addedPeerDeps = Array.from(newPeerDepsSet).filter(
    (key) => !existingInfo.peerDependencies.has(key),
  )
  let removedPeerDeps = Array.from(existingInfo.peerDependencies).filter(
    (key) => !newPeerDepsSet.has(key),
  )

  if (addedPeerDeps.length === 0 && removedPeerDeps.length === 0) {
    return
  }

  let semverType = removedPeerDeps.length > 0 ? 'major' : 'minor'
  let changeFile = path.join(
    `${remixDir}`,
    '.changes',
    `${semverType}.update-peer-dependencies-${Date.now()}.md`,
  )
  let changes = ''

  if (removedPeerDeps.length > 0) {
    console.log()
    console.log('⚠️ Removed peerDependencies:')
    changes += 'Removed `peerDependencies`:\n'
    for (let peerDep of removedPeerDeps) {
      console.log(`   - ${peerDep}`)
      changes += ` - \`${peerDep}\`\n`
    }
  }

  if (addedPeerDeps.length > 0) {
    console.log()
    console.log('✨ Added peerDependencies:')
    changes += 'Added `peerDependencies`:\n'
    for (let peerDep of addedPeerDeps) {
      let version = remixPackageJson.publishConfig.peerDependencies[peerDep]
      console.log(`   - ${peerDep}@${version}`)
      changes += ` - \`${peerDep}@${version}\`\n`
    }
  }

  if (GENERATE_CHANGE_FILES) {
    await fs.writeFile(changeFile, changes, 'utf-8')
    console.log()
    console.log('✨ Created peerDependencies change file:')
    console.log(`   - ${path.relative(process.cwd(), changeFile)}`)
  }
}

async function copySubPackageChangeFiles() {
  if (remixRunPackages.some((pkg) => pkg.changeFiles.length > 0)) {
    let copiedFiles: string[] = []
    for (let packageInfo of remixRunPackages) {
      for (let changeFile of packageInfo.changeFiles) {
        let [changeType, ...rest] = path.basename(changeFile).split('.')
        let changeFileName = rest.join('.')
        let packageShortName = packageInfo.name.replace('@remix-run/', '')

        // Insert the sub-package name in the file so sorting will group changes by sub-package
        let destChangeFilePath = path.join(
          remixDir,
          '.changes',
          `${changeType}.${packageShortName}--${changeFileName}`,
        )

        let exists = await fileExists(destChangeFilePath)
        if (!exists) {
          await fs.copyFile(changeFile, destChangeFilePath)
          copiedFiles.push(destChangeFilePath)
        }
      }
    }

    if (copiedFiles.length > 0) {
      console.log()
      console.log('✨ Copied change files:')
      for (let file of copiedFiles) {
        console.log(`   - ${path.relative(process.cwd(), file)}`)
      }
    }
  }
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

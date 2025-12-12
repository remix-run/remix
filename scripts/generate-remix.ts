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

type ExportEntry = {
  sourceFile: string
  exportPath: string
  reExportFrom: string
}

async function main() {
  console.log('🔍 Scanning packages...')

  // Get all packages except remix itself
  let packageDirs = (await fs.readdir(packagesDir, { withFileTypes: true }))
    .filter((dirent) => dirent.isDirectory() && dirent.name !== 'remix')
    .map((dirent) => dirent.name)

  let exports: ExportEntry[] = []

  // Scan each package for its exports
  for (let packageDir of packageDirs) {
    let packageJsonPath = path.join(packagesDir, packageDir, 'package.json')
    let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    let packageName = packageJson.name as string

    // Skip if not a @remix-run package
    if (!packageName.startsWith('@remix-run/')) {
      continue
    }

    let shortName = packageName.replace('@remix-run/', '')

    // Get all exports except package.json
    let packageExports = packageJson.exports
    if (packageExports && typeof packageExports === 'object') {
      for (let [exportPath, _] of Object.entries(packageExports)) {
        if (exportPath === './package.json') continue

        if (exportPath === '.') {
          // Main export
          exports.push({
            sourceFile: `${shortName}.ts`,
            exportPath: `./${shortName}`,
            reExportFrom: packageName,
          })
        } else {
          // Sub-export (e.g., "./cookie-storage")
          let subExport = exportPath.replace('./', '')
          exports.push({
            sourceFile: `${shortName}/${subExport}.ts`,
            exportPath: `./${shortName}/${subExport}`,
            reExportFrom: `${packageName}/${subExport}`,
          })
        }
      }
    }
  }

  // Sort exports by export path for consistent ordering
  exports.sort((a, b) => a.exportPath.localeCompare(b.exportPath))

  console.log(`📝 Found ${exports.length} exports`)

  // Generate source files
  console.log('📄 Generating source files...')
  for (let entry of exports) {
    let sourceFilePath = path.join(remixDir, 'src', 'lib', entry.sourceFile)
    // Create subdirectory if needed
    let sourceFileDir = path.dirname(sourceFilePath)
    await fs.mkdir(sourceFileDir, { recursive: true })
    let content = [
      `// IMPORTANT: This file is auto-generated, please do not edit manually.`,
      `export * from '${entry.reExportFrom}'\n`,
    ].join('\n')
    await fs.writeFile(sourceFilePath, content, 'utf-8')
  }

  // Update package.json
  console.log('📦 Updating package.json...')
  let remixPackageJson = JSON.parse(await fs.readFile(remixPackageJsonPath, 'utf-8'))

  // Build exports configuration
  let exportsConfig: Record<string, string> = {
    '.': './src/index.ts',
  }

  for (let entry of exports) {
    let exportPath = path.join('src', 'lib', entry.sourceFile)
    exportsConfig[entry.exportPath] = `./${exportPath}`
  }

  exportsConfig['./package.json'] = './package.json'

  // Build publishConfig.exports
  let publishConfigExports: Record<string, any> = {
    '.': {
      types: './dist/index.d.ts',
      default: './dist/index.js',
    },
  }

  for (let entry of exports) {
    let distFile = entry.sourceFile.replace('.ts', '')
    publishConfigExports[entry.exportPath] = {
      types: `./dist/${distFile}.d.ts`,
      default: `./dist/${distFile}.js`,
    }
  }

  publishConfigExports['./package.json'] = './package.json'

  // Build peerDependencies
  let uniquePackages = new Set<string>()
  for (let entry of exports) {
    let packageName = entry.reExportFrom.split('/').slice(0, 2).join('/')
    uniquePackages.add(packageName)
  }
  let peerDependencies: Record<string, string> = {}
  for (let packageName of Array.from(uniquePackages).sort()) {
    peerDependencies[packageName] = 'workspace:^'
  }

  // Update package.json
  remixPackageJson.exports = exportsConfig
  remixPackageJson.publishConfig.exports = publishConfigExports
  remixPackageJson.peerDependencies = peerDependencies

  await fs.writeFile(
    remixPackageJsonPath,
    JSON.stringify(remixPackageJson, null, 2) + '\n',
    'utf-8',
  )

  console.log('✅ Done! Generated:')
  console.log(`   - ${exports.length} source files`)
  console.log(`   - ${Object.keys(exportsConfig).length} exports`)
  console.log(`   - ${uniquePackages.size} peer dependencies`)
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

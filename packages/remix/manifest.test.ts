import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import { buildSpecifierToRemixPath } from '../../scripts/utils/manifest.ts'
import { getPackageExportSideEffects } from '../../scripts/utils/package-side-effects.ts'
import { getRemixReadmeCopies } from '../../scripts/utils/remix-readmes.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '..')

const manifest: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf-8'),
)
const specifierMap = buildSpecifierToRemixPath(packagesDir)

// Invert for coverage checks: specifier → all remix paths that cover it.
const specifierToRemixPaths = new Map<string, string[]>()
for (let [specifier, remixPath] of specifierMap) {
  let existing = specifierToRemixPaths.get(specifier) ?? []
  specifierToRemixPaths.set(specifier, [...existing, remixPath])
}

// --- Helpers ---

function packageNameFromSpecifier(specifier: string): string {
  let parts = specifier.split('/')
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

function shortName(packageName: string): string {
  return packageName.replace('@remix-run/', '')
}

function exportSpecifier(packageName: string, exportPath: string): string {
  return exportPath === '.' ? packageName : `${packageName}/${exportPath.replace('./', '')}`
}

function packageRelativePath(filePath: string): string {
  return path.relative(packagesDir, filePath).split(path.sep).join('/')
}

function packageExportPath(specifier: string): string {
  let packageName = packageNameFromSpecifier(specifier)
  return specifier === packageName ? '.' : `./${specifier.slice(packageName.length + 1)}`
}

function getExportTarget(exportConfig: unknown): string | null {
  if (typeof exportConfig === 'string') return exportConfig
  if (typeof exportConfig !== 'object' || exportConfig === null) return null
  if ('default' in exportConfig && typeof exportConfig.default === 'string') {
    return exportConfig.default
  }
  if ('types' in exportConfig && typeof exportConfig.types === 'string') return exportConfig.types
  return null
}

function generatedModuleHasRuntimeImport(sourceTarget: string): boolean {
  if (sourceTarget.endsWith('.d.ts')) return false
  let source = fs.readFileSync(path.join(__dirname, sourceTarget), 'utf-8')
  return source
    .split(/\r?\n/)
    .some(
      (line) =>
        (line.startsWith('import ') && !line.startsWith('import type ')) ||
        (line.startsWith('export ') && !line.startsWith('export type ') && line !== 'export {}'),
    )
}

const referencedPackages = new Set([...specifierMap.keys()].map(packageNameFromSpecifier))
const readmeCopies = getRemixReadmeCopies()

// All @remix-run/* packages in the workspace (excluding remix itself).
const allRemixRunPackages: string[] = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'remix')
  .flatMap((d) => {
    let pkgJsonPath = path.join(packagesDir, d.name, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) return []
    let { name, private: isPrivate } = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
    if (isPrivate === true) return []
    return name?.startsWith('@remix-run/') ? [name as string] : []
  })

// --- Tests ---

describe('manifest', () => {
  it('every manifest entry has a valid remix path format', () => {
    for (let [remixPath, specifier] of Object.entries(manifest)) {
      if (remixPath.startsWith('_')) continue
      assert.ok(
        remixPath.startsWith('remix/'),
        `Manifest key "${remixPath}" must start with "remix/"`,
      )
      assert.ok(
        specifier.startsWith('@remix-run/'),
        `Manifest value "${specifier}" for key "${remixPath}" must start with "@remix-run/"`,
      )
    }
  })

  it('every manifest value references a real export in its package', () => {
    for (let [specifier, remixPath] of specifierMap) {
      let pkgName = packageNameFromSpecifier(specifier)
      let short = shortName(pkgName)
      let pkgJsonPath = path.join(packagesDir, short, 'package.json')

      assert.ok(
        fs.existsSync(pkgJsonPath),
        `manifest entry "${remixPath}" references package "${pkgName}" but no package.json found at packages/${short}/package.json`,
      )

      let pkgJson: { exports?: Record<string, unknown> } = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf-8'),
      )
      let packageExports = pkgJson.exports ?? {}
      let exportKey = specifier === pkgName ? '.' : `./${specifier.slice(pkgName.length + 1)}`

      assert.ok(
        exportKey in packageExports,
        `manifest entry "${remixPath}" maps to "${specifier}" but "${exportKey}" is not an export of ${pkgName}`,
      )
    }
  })

  it('all exports of every referenced package are covered', () => {
    for (let pkgName of referencedPackages) {
      let short = shortName(pkgName)
      let pkgJsonPath = path.join(packagesDir, short, 'package.json')
      let pkgJson: { exports?: Record<string, unknown> } = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf-8'),
      )

      for (let exportPath of Object.keys(pkgJson.exports ?? {})) {
        if (exportPath === './package.json') continue

        let specifier = exportSpecifier(pkgName, exportPath)

        // Every export of a package that appears anywhere in the manifest must
        // itself appear as a value in the manifest. There is no mechanical
        // fallback: once a package is referenced by a canonical remix path,
        // all its exports must be explicitly mapped.
        assert.ok(
          specifierToRemixPaths.has(specifier),
          `Export "${exportPath}" of ${pkgName} (specifier "${specifier}") is not covered by ` +
            `any manifest entry. Add an entry mapping a canonical remix path to "${specifier}".`,
        )
      }
    }
  })

  it('every public @remix-run/* workspace package is referenced in the manifest', () => {
    for (let pkgName of allRemixRunPackages) {
      // @remix-run/cli is intentionally excluded from the manifest — it is handled
      // separately by the generate-remix script via the CLI_PACKAGE_NAME constant.
      if (pkgName === '@remix-run/cli') continue
      assert.ok(
        referencedPackages.has(pkgName),
        `Package "${pkgName}" is not referenced in manifest.json. ` +
          `Add a canonical remix/* entry mapping to "${pkgName}".`,
      )
    }
  })

  it('every remix package export references a generated source file', () => {
    let packageJson: { exports: Record<string, string | { types: string }> } = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'),
    )

    for (let [exportPath, exportConfig] of Object.entries(packageJson.exports)) {
      let sourcePath = typeof exportConfig === 'string' ? exportConfig : exportConfig.types
      assert.ok(
        fs.existsSync(path.join(__dirname, sourcePath)),
        `Package export "${exportPath}" references missing source file "${sourcePath}"`,
      )
    }
  })

  it('derives generated sideEffects from the owning package exports', () => {
    let remixPackageJson: {
      exports: Record<string, unknown>
      publishConfig: { exports: Record<string, unknown> }
      sideEffects: string[]
    } = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
    let sideEffects = new Set(remixPackageJson.sideEffects)
    let entries = [...Object.entries(manifest), ['remix/cli', '@remix-run/cli'] as const]

    for (let [remixPath, specifier] of entries) {
      if (remixPath.startsWith('_')) continue
      let packageName = packageNameFromSpecifier(specifier)
      let owningPackageJson = JSON.parse(
        fs.readFileSync(path.join(packagesDir, shortName(packageName), 'package.json'), 'utf-8'),
      )
      let expected = getPackageExportSideEffects(owningPackageJson, packageExportPath(specifier))
      let remixExportPath = `./${remixPath.slice('remix/'.length)}`
      let sourceTarget = getExportTarget(remixPackageJson.exports[remixExportPath])
      let publishedTarget = getExportTarget(remixPackageJson.publishConfig.exports[remixExportPath])

      assert.ok(sourceTarget, `Expected a source target for ${remixPath}`)
      assert.ok(publishedTarget, `Expected a published target for ${remixPath}`)
      let hasRuntimeImport = generatedModuleHasRuntimeImport(sourceTarget)
      assert.equal(
        sideEffects.has(sourceTarget),
        hasRuntimeImport && expected.source,
        `${sourceTarget} must match ${specifier}'s source sideEffects metadata`,
      )
      assert.equal(
        sideEffects.has(publishedTarget),
        hasRuntimeImport && expected.published,
        `${publishedTarget} must match ${specifier}'s published sideEffects metadata`,
      )
    }

    assert.ok(sideEffects.has('./src/cli-entry.ts'))
    assert.ok(sideEffects.has('./dist/cli-entry.js'))
  })

  it('package README headings use unscoped package names', () => {
    for (let pkgName of allRemixRunPackages) {
      let short = shortName(pkgName)
      let readmePath = path.join(packagesDir, short, 'README.md')
      if (!fs.existsSync(readmePath)) continue

      let heading = fs.readFileSync(readmePath, 'utf-8').split(/\r?\n/, 1)[0]
      assert.equal(
        heading,
        `# ${short}`,
        `${path.relative(packagesDir, readmePath)} should use "# ${short}" as its H1`,
      )
    }
  })

  it('generates README mirrors for representative published remix docs', () => {
    let sourceByMirrorPath = new Map(
      readmeCopies.map((copy) => [
        packageRelativePath(copy.remixReadmePath),
        packageRelativePath(copy.sourceReadmePath),
      ]),
    )

    assert.equal(sourceByMirrorPath.get('remix/src/assert/README.md'), 'assert/README.md')
    assert.equal(
      sourceByMirrorPath.get('remix/src/fetch-router/README.md'),
      'fetch-router/README.md',
    )
    assert.equal(
      sourceByMirrorPath.get('remix/src/ui/popover/README.md'),
      'ui/src/popover/README.md',
    )
    assert.equal(sourceByMirrorPath.get('remix/src/ui/button/README.md'), 'ui/src/button/README.md')
    assert.equal(sourceByMirrorPath.get('remix/src/cli/README.md'), 'cli/README.md')
  })

  it('generates one README mirror per remix source path', () => {
    let mirrorPaths = readmeCopies.map((copy) => copy.remixReadmePath)
    assert.equal(new Set(mirrorPaths).size, mirrorPaths.length)
  })
})

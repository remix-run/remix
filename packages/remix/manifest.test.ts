import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import { buildSpecifierToRemixPath } from '../../scripts/utils/manifest.ts'
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

const referencedPackages = new Set([...specifierMap.keys()].map(packageNameFromSpecifier))
const readmeCopies = getRemixReadmeCopies()

// All @remix-run/* packages in the workspace (excluding remix itself).
const allRemixRunPackages: string[] = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'remix')
  .flatMap((d) => {
    let pkgJsonPath = path.join(packagesDir, d.name, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) return []
    let { name } = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
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

  it('every @remix-run/* workspace package is referenced in the manifest', () => {
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
        path.relative(packagesDir, copy.remixReadmePath),
        path.relative(packagesDir, copy.sourceReadmePath),
      ]),
    )

    assert.equal(sourceByMirrorPath.get('remix/src/assert/README.md'), 'assert/README.md')
    assert.equal(
      sourceByMirrorPath.get('remix/src/fetch-router/README.md'),
      'fetch-router/README.md',
    )
    assert.equal(
      sourceByMirrorPath.get('remix/src/ui/popover/README.md'),
      'ui/src/components/popover/README.md',
    )
    assert.equal(sourceByMirrorPath.get('remix/src/cli/README.md'), 'cli/README.md')
  })

  it('generates one README mirror per remix source path', () => {
    let mirrorPaths = readmeCopies.map((copy) => copy.remixReadmePath)
    assert.equal(new Set(mirrorPaths).size, mirrorPaths.length)
  })
})

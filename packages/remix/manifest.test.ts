import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import { buildSpecifierToRemixPath } from '../../scripts/utils/manifest.ts'

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

// --- Tests ---

describe('manifest', () => {
  it('every pattern entry matches at least one workspace package', () => {
    for (let [keyPattern, valuePattern] of Object.entries(manifest)) {
      if (!valuePattern.includes('(')) continue
      let regex = new RegExp(`^${valuePattern}$`)
      let matched = [...specifierMap.keys()].some((name) => regex.test(name))
      assert.ok(
        matched,
        `Pattern entry "${keyPattern}": "${valuePattern}" did not match any workspace package`,
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
})

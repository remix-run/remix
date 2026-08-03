import * as path from 'node:path'
import * as url from 'node:url'
import { buildSpecifierToRemixPath } from '../../../../scripts/utils/manifest.ts'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const packagesDir = path.resolve(__dirname, '../../../../packages')

const specifierMap = buildSpecifierToRemixPath(packagesDir)

/**
 * Maps a full npm specifier (e.g. `@remix-run/fetch-router` or
 * `@remix-run/session/cookie-storage`) to its canonical `remix/*` import path
 * (e.g. `remix/router` or `remix/session-storage/cookie`).
 *
 * Falls back to the mechanical `remix/<short-name>` path when no manifest
 * entry covers the specifier.
 */
export function mapToRemixPackage(specifier: string): string {
  return specifierMap.get(specifier) ?? specifier.replace(/^@remix-run\//, 'remix/')
}

export function hasRemixPackage(specifier: string): boolean {
  return specifierMap.has(specifier)
}

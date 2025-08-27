import { getPackageFile } from './packages.js'
import { fileExists, readFile } from './fs.js'

/** @typedef {{ version: string; date?: Date; body: string }} Changes */
/** @typedef {Record<string, Changes>} AllChanges */

/** @type (packageName: string) => AllChanges | null */
export function getAllChanges(packageName) {
  let changelogFile = getPackageFile(packageName, 'CHANGELOG.md')

  if (!fileExists(changelogFile)) {
    return null
  }

  let changelog = readFile(changelogFile)
  let parser = /^## ([a-z\d\.\-]+)(?: \(([^)]+)\))?$/gim

  /** @type {AllChanges} */
  let result = {}

  let match
  while ((match = parser.exec(changelog))) {
    let [_, versionString, dateString] = match
    let lastIndex = parser.lastIndex
    let version = versionString.startsWith('v') ? versionString.slice(1) : versionString
    let date = dateString ? new Date(dateString) : undefined
    let nextMatch = parser.exec(changelog)
    let body = changelog.slice(lastIndex, nextMatch ? nextMatch.index : undefined).trim()
    result[version] = { version, date, body }
    parser.lastIndex = lastIndex
  }

  return result
}

/** @type (packageName: string, version: string) => Changes | null */
export function getChanges(packageName, version) {
  let allChanges = getAllChanges(packageName)

  if (allChanges !== null) {
    return allChanges[version] ?? null
  }

  return null
}

import { hasChangelog, readChangelog } from './packages.js';

/** @typedef {Record<string, Changes>} AllChanges */

/** @type (packageName: string) => AllChanges | null */
export function getAllChanges(packageName) {
  if (!hasChangelog(packageName)) {
    return null;
  }

  let changelog = readChangelog(packageName);
  let parser = /^## ([a-z\d\.\-]+)(?: \(([^)]+)\))?$/gim;

  /** @type {AllChanges} */
  let result = {};

  let match;
  while ((match = parser.exec(changelog))) {
    let [_, versionString, dateString] = match;
    let lastIndex = parser.lastIndex;
    let version = versionString.startsWith('v') ? versionString.slice(1) : versionString;
    let date = dateString ? new Date(dateString) : undefined;
    let nextMatch = parser.exec(changelog);
    let changes = changelog.slice(lastIndex, nextMatch ? nextMatch.index : undefined).trim();
    result[version] = { version, date, changes };
    parser.lastIndex = lastIndex;
  }

  return result;
}

/** @typedef {{ version: string; date?: Date; changes: string }} Changes */

/** @type (packageName: string, version: string) => Changes | null */
export function getChanges(packageName, version) {
  let allChanges = getAllChanges(packageName);

  if (allChanges !== null) {
    return allChanges[version] ?? null;
  }

  return null;
}

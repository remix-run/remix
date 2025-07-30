import { getPackageFile } from './packages.ts';
import { fileExists, readFile } from './fs.ts';

export type Changes = { version: string; date?: Date; body: string };
type AllChanges = Record<string, Changes>;

export function getAllChanges(packageName: string): AllChanges | null {
  let changelogFile = getPackageFile(packageName, 'CHANGELOG.md');

  if (!fileExists(changelogFile)) {
    return null;
  }

  let changelog = readFile(changelogFile);
  let parser = /^## ([a-z\d\.\-]+)(?: \(([^)]+)\))?$/gim;

  let result: AllChanges = {};

  let match;
  while ((match = parser.exec(changelog))) {
    let [_, versionString, dateString] = match;
    let lastIndex = parser.lastIndex;
    let version = versionString.startsWith('v') ? versionString.slice(1) : versionString;
    let date = dateString ? new Date(dateString) : undefined;
    let nextMatch = parser.exec(changelog);
    let body = changelog.slice(lastIndex, nextMatch ? nextMatch.index : undefined).trim();
    result[version] = { version, date, body };
    parser.lastIndex = lastIndex;
  }

  return result;
}

export function getChanges(packageName: string, version: string): Changes | null {
  let allChanges = getAllChanges(packageName);

  if (allChanges !== null) {
    return allChanges[version] ?? null;
  }

  return null;
}

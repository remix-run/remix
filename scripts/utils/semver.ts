import * as semver from 'semver'

export function isValidVersion(version: string): boolean {
  return semver.valid(version) !== null
}

export function getNextVersion(currentVersion: string, releaseType: string): string {
  let nextVersion = semver.inc(currentVersion, releaseType as semver.ReleaseType)

  if (nextVersion == null) {
    throw new Error(`Invalid version increment: ${currentVersion} + ${releaseType}`)
  }

  return nextVersion
}

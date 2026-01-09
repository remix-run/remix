import * as semver from 'semver'

export function getNextVersion(currentVersion: string, releaseType: string): string {
  let nextVersion = semver.inc(currentVersion, releaseType as semver.ReleaseType)

  if (nextVersion == null) {
    throw new Error(`Invalid version increment: ${currentVersion} + ${releaseType}`)
  }

  return nextVersion
}

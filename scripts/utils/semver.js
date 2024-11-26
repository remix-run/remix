import * as semver from 'semver';

/** @type (version: string) => boolean */
export function isValidVersion(version) {
  return semver.valid(version) !== null;
}

/** @type (currentVersion: string, releaseType: string) => string */
export function getNextVersion(currentVersion, releaseType) {
  let nextVersion = semver.inc(currentVersion, /** @type {semver.ReleaseType} */ (releaseType));

  if (nextVersion == null) {
    throw new Error(`Invalid version increment: ${currentVersion} + ${releaseType}`);
  }

  return nextVersion;
}

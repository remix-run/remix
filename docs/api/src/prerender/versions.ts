import * as cp from 'node:child_process'
import * as semver from 'semver'
import type { Versions } from '../server/view.tsx'

export function getVersionsForPicker(
  activeVersion: string | undefined,
  fallback: Versions,
): Versions {
  return getVersionsForPickerFromTags(cp.execSync('git tag', { encoding: 'utf-8' }), {
    activeVersion,
    fallback,
  })
}

export function getVersionsForPickerFromTags(
  tags: string,
  options: {
    activeVersion?: string
    fallback: Versions
  },
): Versions {
  let allRemixVersions = getAllRemixVersions(tags)
  let remixVersions = allRemixVersions
    .filter((tag) => !semver.prerelease(tag))
    .sort((a, b) => semver.rcompare(a, b))

  if (options.activeVersion) {
    if (!allRemixVersions.includes(options.activeVersion)) {
      throw new Error(
        `No matching git tag found for --version ${options.activeVersion} ` +
          `(expected ${getExpectedTagName(options.activeVersion)}). ` +
          'Make sure you are running prerender from the matching release checkout with tags fetched.',
      )
    }

    if (!remixVersions.includes(options.activeVersion)) {
      remixVersions.push(options.activeVersion)
      remixVersions.sort((a, b) => semver.rcompare(a, b))
    }
  }

  return remixVersions.length > 0 ? remixVersions : options.fallback
}

function getAllRemixVersions(tags: string): Versions {
  return tags
    .trim()
    .split('\n')
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith('remix@3'))
    .map((tag) => tag.replace('remix@', 'v'))
    .filter((tag) => semver.valid(tag))
}

function getExpectedTagName(version: string): string {
  return `remix@${version.startsWith('v') ? version.slice(1) : version}`
}

/**
 * Pure functions for building a publish plan.
 * This module contains no side effects - it only transforms data.
 * All I/O (npm registry checks, file system reads, etc.) happens outside this module.
 */
import * as semver from 'semver'

import { topologicalSortAndGroup } from './topological-sort.ts'

export interface PackageInfo {
  name: string
  version: string
  directory: string
  dependencies: string[]
}

export interface PackagePublishInfo {
  name: string
  version: string
  directory: string
  distTag: string
  gitTag: string
}

export interface PublishPlan {
  /**
   * Packages to publish, grouped into waves by dependency order.
   * Each wave contains packages that can be published in parallel.
   * Waves must be processed sequentially (wave 1 before wave 2, etc).
   */
  waves: PackagePublishInfo[][]
  /** Packages that were skipped because they're already published */
  alreadyPublished: PackageInfo[]
}

/**
 * Get the dist-tag for a version.
 * Prerelease versions use their prerelease identifier (e.g., "alpha", "beta")
 * Stable versions use "latest"
 */
function getDistTag(version: string): string {
  let prerelease = semver.prerelease(version)
  if (prerelease && prerelease.length > 0 && typeof prerelease[0] === 'string') {
    return prerelease[0]
  }
  return 'latest'
}

/**
 * Build a publish plan from package info and registry state.
 * This is a pure function - it has no side effects.
 */
export function buildPublishPlan(options: {
  /** All public packages in the workspace */
  packages: PackageInfo[]
  /** Function to check if a version is already published. Injected for testability. */
  isPublished: (name: string, version: string) => boolean
}): PublishPlan {
  let { packages, isPublished } = options

  let packagesToPublish: PackageInfo[] = []
  let alreadyPublished: PackageInfo[] = []

  for (let pkg of packages) {
    if (isPublished(pkg.name, pkg.version)) {
      alreadyPublished.push(pkg)
    } else {
      packagesToPublish.push(pkg)
    }
  }

  // Sort packages into waves by dependencies
  // Each wave contains packages that can be published in parallel
  let groups = topologicalSortAndGroup(packagesToPublish)

  // Build the final publish info with dist tags for each wave
  let waves: PackagePublishInfo[][] = groups.map((group) =>
    group.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      directory: pkg.directory,
      distTag: getDistTag(pkg.version),
      gitTag: `${pkg.name}@${pkg.version}`,
    })),
  )

  return {
    waves,
    alreadyPublished,
  }
}

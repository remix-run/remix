import type { ChangelogEntry } from './changes.ts'

export interface PublishCandidate {
  packageName: string
  version: string
  tag: string
}

export interface PublishPlan extends PublishCandidate {
  dirName: string
  npmTag: 'latest' | 'next'
}

export interface RegistryRequest {
  (url: URL, init: RequestInit): Promise<Response>
}

interface CreatePublishPlanOptions {
  packages: PublishCandidate[]
  prereleaseDirNames: Set<string>
  getDirectoryName(packageName: string): string | null
  getDependencies(packageName: string): string[]
}

interface GetReleaseNotesOptions {
  entries: ChangelogEntry[]
  targetVersion: string
  isVersionPublished(version: string): Promise<boolean>
}

export async function isPackageVersionPublished(
  packageName: string,
  version: string,
  request: RegistryRequest = fetch,
): Promise<boolean> {
  let packagePath = encodeURIComponent(packageName)
  let versionPath = encodeURIComponent(version)
  let url = new URL(`/${packagePath}/${versionPath}`, 'https://registry.npmjs.org')
  let response = await request(url, {
    headers: { Accept: 'application/json' },
  })

  if (response.status === 404) {
    return false
  }

  if (!response.ok) {
    throw new Error(
      `Could not check ${packageName}@${version} on npm: ${response.status} ${response.statusText}`,
    )
  }

  return true
}

export async function getReleaseNotes({
  entries,
  targetVersion,
  isVersionPublished,
}: GetReleaseNotesOptions): Promise<string | null> {
  let targetIndex = entries.findIndex((entry) => entry.version === targetVersion)
  if (targetIndex === -1) {
    return null
  }

  let includedEntries = [entries[targetIndex]]
  let previousPublishedVersion: string | null = null

  for (let entry of entries.slice(targetIndex + 1)) {
    if (await isVersionPublished(entry.version)) {
      previousPublishedVersion = entry.version
      break
    }
    includedEntries.push(entry)
  }

  if (includedEntries.length === 1) {
    return includedEntries[0].body
  }

  let introduction =
    previousPublishedVersion === null
      ? 'This release includes all previously unpublished changelog entries.'
      : `This release includes all changes since v${previousPublishedVersion}.`
  let versionSections = includedEntries
    .reverse()
    .map((entry) => `## v${entry.version}\n\n${entry.body}`)
    .join('\n\n')

  return `${introduction}\n\n${versionSections}`
}

export function createPublishPlan({
  packages,
  prereleaseDirNames,
  getDirectoryName,
  getDependencies,
}: CreatePublishPlanOptions): PublishPlan[] {
  let packagesByName = new Map(packages.map((pkg) => [pkg.packageName, pkg]))
  let plansByName = new Map<string, PublishPlan>()

  for (let pkg of packages) {
    let dirName = getDirectoryName(pkg.packageName)
    if (dirName === null) {
      throw new Error(`Could not map package "${pkg.packageName}" to a workspace directory.`)
    }

    plansByName.set(pkg.packageName, {
      ...pkg,
      dirName,
      npmTag: prereleaseDirNames.has(dirName) ? 'next' : 'latest',
    })
  }

  let sorted: PublishPlan[] = []
  let visited = new Set<string>()
  let visiting = new Set<string>()

  function visit(packageName: string, npmTag: PublishPlan['npmTag']) {
    if (visited.has(packageName)) {
      return
    }
    if (visiting.has(packageName)) {
      throw new Error(`Detected a dependency cycle while planning publication of ${packageName}.`)
    }

    let plan = plansByName.get(packageName)
    if (plan === undefined || plan.npmTag !== npmTag) {
      return
    }

    visiting.add(packageName)
    for (let dependency of getDependencies(packageName)) {
      if (packagesByName.has(dependency)) {
        visit(dependency, npmTag)
      }
    }
    visiting.delete(packageName)
    visited.add(packageName)
    sorted.push(plan)
  }

  for (let npmTag of ['latest', 'next'] as const) {
    for (let pkg of packages) {
      visit(pkg.packageName, npmTag)
    }
  }

  return sorted
}

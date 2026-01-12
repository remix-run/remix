import type { PackageRelease } from './changes.ts'
import { generateChangelogContent } from './changes.ts'

// GitHub has a 65,536 character limit for PR body. We use 60,000 to be safe.
let maxBodyLength = 60_000

/**
 * Generates the PR body for a version PR
 */
export function generatePrBody(releases: PackageRelease[]): string {
  let header = generateHeader()
  let releasesTable = generateReleasesTable(releases)
  let changelogs = generateChangelogs(releases)

  let fullBody = [header, releasesTable, changelogs].join('\n\n')

  // If under limit, return full body
  if (fullBody.length <= maxBodyLength) {
    return fullBody
  }

  // Truncate changelogs section to fit
  let baseLength = header.length + releasesTable.length + 100 // buffer for truncation notice
  let availableForChangelogs = maxBodyLength - baseLength
  let truncatedChangelogs = truncateChangelogs(releases, availableForChangelogs)

  return [header, releasesTable, truncatedChangelogs].join('\n\n')
}

function generateHeader(): string {
  return [
    'This PR is managed by the [`changes-version-pr`](https://github.com/remix-run/remix/blob/main/.github/workflows/changes-version-pr.yaml) workflow. ' +
      'Do not edit it manually. ' +
      'See [CONTRIBUTING.md](https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md#releases) for more.',
  ].join('\n')
}

function generateReleasesTable(releases: PackageRelease[]): string {
  let lines = ['## Releases', '', '| Package | Version |', '|---------|---------|']

  for (let release of releases) {
    lines.push(
      `| ${release.packageName} | \`${release.currentVersion}\` → \`${release.nextVersion}\` |`,
    )
  }

  return lines.join('\n')
}

function generateChangelogs(releases: PackageRelease[]): string {
  let lines = ['## Changelogs']

  for (let release of releases) {
    lines.push('')
    lines.push(generatePackageChangelog(release))
  }

  return lines.join('\n')
}

function generatePackageChangelog(release: PackageRelease): string {
  return generateChangelogContent(release, {
    includePackageName: true,
    headingLevel: 3,
  })
}

function truncateChangelogs(releases: PackageRelease[], maxLength: number): string {
  let lines = ['## Changelogs']
  let currentLength = lines.join('\n').length
  let includedCount = 0

  for (let release of releases) {
    let changelog = '\n\n' + generatePackageChangelog(release)
    if (currentLength + changelog.length <= maxLength) {
      lines.push('')
      lines.push(generatePackageChangelog(release))
      currentLength += changelog.length
      includedCount++
    } else {
      break
    }
  }

  let omittedCount = releases.length - includedCount

  if (omittedCount > 0) {
    lines.push('')
    lines.push(
      `> ⚠️ ${omittedCount} changelog${omittedCount === 1 ? '' : 's'} omitted due to size limits. See the PR diff for full details.`,
    )
  }

  return lines.join('\n')
}

import { request } from '@octokit/request'

import { getChangelogEntry } from './changes.ts'

const token = process.env.GITHUB_TOKEN

interface CreateReleaseOptions {
  preview?: boolean
}

/**
 * Creates a GitHub release for a package version
 */
export async function createRelease(
  packageName: string,
  version: string,
  options: CreateReleaseOptions = {},
): Promise<string | null> {
  let { preview = false } = options

  let tagName = `${packageName}@${version}`
  let releaseName = `${packageName} v${version}`
  let changes = getChangelogEntry(packageName, version)
  let body = changes?.body ?? 'No changes.'

  if (preview) {
    console.log(`  Tag:  ${tagName}`)
    console.log(`  Name: ${releaseName}`)
    console.log()
    console.log('  Body:')
    console.log()
    for (let line of body.split('\n')) {
      console.log(`    ${line}`)
    }
    console.log()
    return null
  }

  if (token === undefined) {
    console.error('GITHUB_TOKEN environment variable is required to create a GitHub release')
    process.exit(1)
  }

  let response = await request('POST /repos/{owner}/{repo}/releases', {
    headers: {
      authorization: `token ${token}`,
    },
    owner: 'remix-run',
    repo: 'remix',
    tag_name: tagName,
    name: releaseName,
    body,
  })

  if (response.status !== 201) {
    console.error('Failed to create release:', response)
    process.exit(1)
  }

  return response.data.html_url
}

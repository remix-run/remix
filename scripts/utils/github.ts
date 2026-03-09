import { request } from '@octokit/request'

import { getChangelogEntry } from './changes.ts'
import { getGitTag, getPackageShortName } from './packages.ts'

let owner = 'remix-run'
let repo = 'remix'

function getToken(): string {
  let token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }
  return token
}

function auth() {
  return { headers: { authorization: `token ${getToken()}` } }
}

export type CreateReleaseResult =
  | { status: 'created'; url: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; error: string }

/**
 * Check if a GitHub release exists for a tag.
 */
export async function releaseExists(tag: string): Promise<boolean> {
  try {
    await request('GET /repos/{owner}/{repo}/releases/tags/{tag}', {
      ...auth(),
      owner,
      repo,
      tag,
    })
    return true
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) {
      return false
    }
    throw error
  }
}

/**
 * Creates a GitHub release for a package version.
 * Returns a result object indicating success, already exists, or error.
 */
export async function createRelease(
  packageName: string,
  version: string,
  options: {
    preview?: boolean
  } = {},
): Promise<CreateReleaseResult> {
  let { preview = false } = options

  let tagName = getGitTag(packageName, version)
  let releaseName = `${getPackageShortName(packageName)} v${version}`
  let changes = getChangelogEntry({ packageName, version })
  let body = changes?.body ?? 'No changelog entry found for this version.'

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
    return { status: 'skipped', reason: 'Preview mode' }
  }

  try {
    if (await releaseExists(tagName)) {
      return { status: 'skipped', reason: 'Already exists' }
    }
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    return { status: 'error', error: message }
  }

  try {
    let response = await request('POST /repos/{owner}/{repo}/releases', {
      ...auth(),
      owner,
      repo,
      tag_name: tagName,
      name: releaseName,
      body,
    })

    return { status: 'created', url: response.data.html_url }
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error)
    return { status: 'error', error: message }
  }
}

/**
 * Find an open PR from a specific branch to a base branch
 */
export async function findOpenPr(head: string, base: string) {
  let response = await request('GET /repos/{owner}/{repo}/pulls', {
    ...auth(),
    owner,
    repo,
    state: 'open',
    head: `${owner}:${head}`,
    base,
  })

  return response.data.length > 0 ? response.data[0] : null
}

/**
 * Create a new PR
 */
export async function createPr(options: {
  title: string
  body: string
  head: string
  base: string
}) {
  let response = await request('POST /repos/{owner}/{repo}/pulls', {
    ...auth(),
    owner,
    repo,
    title: options.title,
    body: options.body,
    head: options.head,
    base: options.base,
  })

  return response.data
}

/**
 * Update an existing PR
 */
export async function updatePr(prNumber: number, options: { title?: string; body?: string }) {
  await request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
    ...auth(),
    owner,
    repo,
    pull_number: prNumber,
    ...options,
  })
}

/**
 * Close a PR with an optional comment
 */
export async function closePr(prNumber: number, comment?: string) {
  if (comment) {
    await request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      ...auth(),
      owner,
      repo,
      issue_number: prNumber,
      body: comment,
    })
  }

  await request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
    ...auth(),
    owner,
    repo,
    pull_number: prNumber,
    state: 'closed',
  })
}

/**
 * Get all comments on a PR
 */
export async function getPrComments(prNumber: number) {
  let response = await request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    ...auth(),
    owner,
    repo,
    issue_number: prNumber,
  })

  return response.data
}

/**
 * Create a comment on a PR
 */
export async function createPrComment(prNumber: number, body: string) {
  let response = await request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
    ...auth(),
    owner,
    repo,
    issue_number: prNumber,
    body,
  })

  return response.data
}

/**
 * Update a comment on a PR
 */
export async function updatePrComment(commentId: number, body: string) {
  await request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
    ...auth(),
    owner,
    repo,
    comment_id: commentId,
    body,
  })
}

/**
 * Delete a comment on a PR
 */
export async function deletePrComment(commentId: number) {
  await request('DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}', {
    ...auth(),
    owner,
    repo,
    comment_id: commentId,
  })
}

import { request } from '@octokit/request'

import { getChangelogEntry } from './changes.ts'
import { getGitTag, getPackageShortName } from './packages.ts'

const owner = 'remix-run'
const repo = 'remix'
const transientStatusCodes = new Set([408, 429, 500, 502, 503, 504])
const transientErrorCodes = new Set([
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'EAI_AGAIN',
])

interface GitHubResponse {
  data: unknown
}

export interface GitHubRequest {
  (route: string, options: Record<string, unknown>): Promise<GitHubResponse>
}

interface RetryOptions {
  maxAttempts?: number
  retryDelayMs?: number
}

interface ReleaseInfo {
  url: string
}

function getToken(): string {
  let token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required')
  }
  return token
}

function auth() {
  return { headers: { Authorization: `token ${getToken()}` } }
}

async function defaultRequest(route: string, options: Record<string, unknown>) {
  let response = await request(route, options)
  return { data: response.data }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorStatus(error: unknown): number | null {
  return isRecord(error) && typeof error.status === 'number' ? error.status : null
}

function getErrorCode(error: unknown): string | null {
  return isRecord(error) && typeof error.code === 'string' ? error.code : null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isTransientError(error: unknown): boolean {
  let status = getErrorStatus(error)
  if (status !== null && transientStatusCodes.has(status)) {
    return true
  }

  let code = getErrorCode(error)
  return code !== null && transientErrorCodes.has(code)
}

function getReleaseUrl(tagName: string): string {
  return `https://github.com/${owner}/${repo}/releases/tag/${encodeURIComponent(tagName)}`
}

function getReleaseInfo(data: unknown, tagName: string): ReleaseInfo {
  if (isRecord(data) && typeof data.html_url === 'string') {
    return { url: data.html_url }
  }

  return { url: getReleaseUrl(tagName) }
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }

  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestWithRetries(
  githubRequest: GitHubRequest,
  route: string,
  options: Record<string, unknown>,
  { maxAttempts = 3, retryDelayMs = 1000 }: RetryOptions = {},
): Promise<GitHubResponse> {
  let attempts = Math.max(1, maxAttempts)
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await githubRequest(route, options)
    } catch (error) {
      lastError = error
      if (attempt === attempts || !isTransientError(error)) {
        break
      }

      await delay(retryDelayMs * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

async function getReleaseByTag(
  tag: string,
  {
    request: githubRequest = defaultRequest,
    maxAttempts,
    retryDelayMs,
  }: {
    request?: GitHubRequest
  } & RetryOptions = {},
): Promise<ReleaseInfo | null> {
  try {
    let response = await requestWithRetries(
      githubRequest,
      'GET /repos/{owner}/{repo}/releases/tags/{tag}',
      {
        ...auth(),
        owner,
        repo,
        tag,
      },
      { maxAttempts, retryDelayMs },
    )
    return getReleaseInfo(response.data, tag)
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      return null
    }
    throw error
  }
}

export type CreateReleaseResult =
  | { status: 'created'; url: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; error: string }

/**
 * Check if a GitHub release exists for a tag.
 */
export async function releaseExists(
  tag: string,
  options: {
    request?: GitHubRequest
  } & RetryOptions = {},
): Promise<boolean> {
  return (await getReleaseByTag(tag, options)) !== null
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
    request?: GitHubRequest
  } & RetryOptions = {},
): Promise<CreateReleaseResult> {
  let {
    preview = false,
    request: githubRequest = defaultRequest,
    maxAttempts,
    retryDelayMs,
  } = options

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
    if (
      (await getReleaseByTag(tagName, {
        request: githubRequest,
        maxAttempts,
        retryDelayMs,
      })) !== null
    ) {
      return { status: 'skipped', reason: 'Already exists' }
    }
  } catch (error) {
    return { status: 'error', error: getErrorMessage(error) }
  }

  let attempts = Math.max(1, maxAttempts ?? 3)
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      let response = await githubRequest('POST /repos/{owner}/{repo}/releases', {
        ...auth(),
        owner,
        repo,
        tag_name: tagName,
        name: releaseName,
        body,
      })

      return { status: 'created', url: getReleaseInfo(response.data, tagName).url }
    } catch (error) {
      lastError = error

      try {
        let release = await getReleaseByTag(tagName, {
          request: githubRequest,
          maxAttempts,
          retryDelayMs,
        })

        if (release !== null) {
          return getErrorStatus(error) === 422
            ? { status: 'skipped', reason: 'Already exists' }
            : { status: 'created', url: release.url }
        }
      } catch (releaseCheckError) {
        lastError = releaseCheckError
        if (!isTransientError(releaseCheckError)) {
          break
        }
      }

      if (attempt === attempts || !isTransientError(error)) {
        break
      }

      await delay((retryDelayMs ?? 1000) * 2 ** (attempt - 1))
    }
  }

  return { status: 'error', error: getErrorMessage(lastError) }
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

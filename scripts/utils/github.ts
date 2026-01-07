import { request } from '@octokit/request'

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
 * Set package labels on a PR (pkg:*), replacing any existing package labels
 */
export async function setPrPkgLabels(prNumber: number, packageNames: string[]) {
  // Get current labels
  let response = await request('GET /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    ...auth(),
    owner,
    repo,
    issue_number: prNumber,
  })

  let currentLabels = response.data.map((label) => label.name)

  // Remove existing pkg: labels, add new ones
  let labelsToKeep = currentLabels.filter((label) => !label.startsWith('pkg:'))
  let pkgLabels = packageNames.map((name) => `pkg:${name}`)
  let newLabels = [...labelsToKeep, ...pkgLabels]

  // Set labels
  await request('PUT /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    ...auth(),
    owner,
    repo,
    issue_number: prNumber,
    labels: newLabels,
  })
}

/** Comment on released PRs/issues and archive roadmap cards. Usage: RELEASE_TAG=remix@x.y.z node scripts/post-release.ts [--dry-run] */
import * as cp from 'node:child_process'
import { parseArgs } from 'node:util'
import { getReleasedPrNumbers } from './utils/released-prs.ts'

const repository = 'remix-run/remix'

interface ReleasedItems {
  prs: Set<number>
  issues: Set<string>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readObject(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error('Invalid GitHub response.')
  return value
}

function readConnection(value: unknown): { nodes: unknown[]; cursor: string | null } {
  let connection = readObject(value)
  let pageInfo = readObject(connection.pageInfo)
  if (!Array.isArray(connection.nodes) || typeof pageInfo.hasNextPage !== 'boolean') {
    throw new Error('Invalid GitHub connection.')
  }
  let nodes: unknown[] = connection.nodes
  let cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
  if (cursor !== null && typeof cursor !== 'string') throw new Error('Invalid GitHub cursor.')
  return { nodes, cursor }
}

function github(args: string[], input?: Record<string, unknown>): string {
  return cp.execFileSync('gh', args, {
    input: input === undefined ? undefined : JSON.stringify(input),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  })
}

function requestGitHub(query: string, variables: Record<string, unknown>): unknown {
  let response: unknown = JSON.parse(
    github(['api', 'graphql', '--input', '-'], { query, variables }),
  )
  return readObject(response).data
}

function findReleasedItems(tag: string): ReleasedItems {
  let prs = new Set<number>()
  let issues = new Set<string>()
  // Stacked PRs merge into another PR's branch, so they ship without their own commit on main.
  // Walk them from each released PR.
  let queue = [...getReleasedPrNumbers(tag)]
  for (let number of queue) {
    if (prs.has(number)) continue
    let cursor: string | null = null
    let branch: { name: string; openedAt: string; mergedAt: string } | null = null
    do {
      let response = readObject(
        requestGitHub(
          `
            query($number: Int!, $cursor: String) {
              repository(owner: "remix-run", name: "remix") {
                pullRequest(number: $number) {
                  title body merged headRefName createdAt mergedAt
                  closingIssuesReferences(first: 100, after: $cursor) {
                    nodes { number repository { nameWithOwner } }
                    pageInfo { hasNextPage endCursor }
                  }
                }
              }
            }
          `,
          { number, cursor },
        ),
      )
      let pr = readObject(readObject(response.repository).pullRequest)
      if (typeof pr.title !== 'string' || typeof pr.body !== 'string') {
        throw new Error(`Could not read PR #${number}.`)
      }
      if (pr.merged !== true || pr.title === 'Release' || /^Release v\d/.test(pr.title)) break
      prs.add(number)
      if (
        typeof pr.headRefName !== 'string' ||
        typeof pr.createdAt !== 'string' ||
        typeof pr.mergedAt !== 'string'
      ) {
        throw new Error(`Could not read PR #${number}.`)
      }
      branch = { name: pr.headRefName, openedAt: pr.createdAt, mergedAt: pr.mergedAt }
      let references = readConnection(pr.closingIssuesReferences)
      for (let node of references.nodes) {
        if (node === null) continue
        let issue = readObject(node)
        let repo = readObject(issue.repository).nameWithOwner
        if (typeof issue.number !== 'number' || typeof repo !== 'string') {
          throw new Error('Invalid closing issue reference.')
        }
        issues.add(`${repo}#${issue.number}`)
      }
      // Like React Router, include closing keywords even when GitHub omits the link.
      for (let match of pr.body.matchAll(
        /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)\b/gi,
      )) {
        let issue = Number(match[1])
        if (Number.isSafeInteger(issue) && issue > 0) issues.add(`${repository}#${issue}`)
      }
      cursor = references.cursor
    } while (cursor)
    if (branch === null) continue
    do {
      let response = readObject(
        requestGitHub(
          `
            query($branch: String!, $cursor: String) {
              repository(owner: "remix-run", name: "remix") {
                pullRequests(baseRefName: $branch, states: MERGED, first: 100, after: $cursor) {
                  nodes { number mergedAt }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          `,
          { branch: branch.name, cursor },
        ),
      )
      let stacked = readConnection(readObject(response.repository).pullRequests)
      for (let node of stacked.nodes) {
        let pr = readObject(node)
        if (typeof pr.number !== 'number' || typeof pr.mergedAt !== 'string') {
          throw new Error('Invalid stacked PR.')
        }
        // Branch names get reused, so only count PRs merged while this PR was open.
        if (pr.mergedAt >= branch.openedAt && pr.mergedAt <= branch.mergedAt) queue.push(pr.number)
      }
      cursor = stacked.cursor
    } while (cursor)
  }
  return { prs, issues }
}

function commentOnReleasedItems(released: ReleasedItems, tag: string, dryRun: boolean): number {
  let numbers = new Set(released.prs)
  for (let issue of released.issues) {
    let [repo, number] = issue.split('#')
    if (repo === repository) numbers.add(Number(number))
  }
  let marker = `<!-- remix-release:${tag} -->`
  let version = tag.slice('remix@'.length)
  let url = `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`
  let body = `Released in [Remix ${version}](${url}).\n\n${marker}`
  let count = 0
  if (dryRun) console.log(`Comment preview:\n${body}`)
  for (let number of numbers) {
    let endpoint = `repos/${repository}/issues/${number}/comments`
    let comments = github(['api', `${endpoint}?per_page=100`, '--paginate', '--jq', '.[].body'])
    if (comments.includes(marker)) continue
    if (!dryRun) github(['api', endpoint, '--method', 'POST', '--input', '-'], { body })
    count++
  }
  return count
}

function archiveReleasedRoadmapItems(released: ReleasedItems, dryRun: boolean): number {
  let cursor: string | null = null
  let projectId: string
  let itemIds: string[] = []
  do {
    let response = readObject(
      requestGitHub(
        `
          query($cursor: String) {
            organization(login: "remix-run") {
              projectV2(number: 31) {
                id
                items(first: 100, after: $cursor) {
                  nodes {
                    id
                    isArchived
                    content {
                      __typename
                      ... on PullRequest { number merged repository { nameWithOwner } }
                      ... on Issue { number repository { nameWithOwner } }
                    }
                    fieldValueByName(name: "Status") {
                      ... on ProjectV2ItemFieldSingleSelectValue { name }
                    }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        `,
        { cursor },
      ),
    )
    let project = readObject(readObject(response.organization).projectV2)
    if (typeof project.id !== 'string') throw new Error('Could not find the Remix Roadmap.')
    projectId = project.id
    let items = readConnection(project.items)
    for (let node of items.nodes) {
      if (node === null) continue
      let item = readObject(node)
      if (item.isArchived || item.fieldValueByName === null) continue
      if (readObject(item.fieldValueByName).name !== 'Merged' || item.content === null) continue
      let content = readObject(item.content)
      let repo =
        content.__typename === 'DraftIssue' ? null : readObject(content.repository).nameWithOwner
      let matchesRelease =
        content.__typename === 'PullRequest' &&
        content.merged === true &&
        repo === repository &&
        typeof content.number === 'number' &&
        released.prs.has(content.number)
      if (content.__typename === 'Issue') {
        matchesRelease = released.issues.has(`${repo}#${content.number}`)
      }
      if (matchesRelease) {
        if (typeof item.id !== 'string') throw new Error('Invalid roadmap item ID.')
        itemIds.push(item.id)
      }
    }
    cursor = items.cursor
  } while (cursor)

  // Read every page before archiving so mutations cannot shift pagination.
  if (!dryRun) {
    for (let itemId of itemIds) {
      requestGitHub(
        `
          mutation($projectId: ID!, $itemId: ID!) {
            archiveProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
              item { id }
            }
          }
        `,
        { projectId, itemId },
      )
    }
  }
  return itemIds.length
}

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })
const tag = process.env.RELEASE_TAG
if (!tag) throw new Error('RELEASE_TAG is required.')
const released = findReleasedItems(tag)
console.log(
  `Found ${released.prs.size} released PRs and ${released.issues.size} linked issues in ${tag}.`,
)
const comments = commentOnReleasedItems(released, tag, values['dry-run'])
console.log(`${values['dry-run'] ? 'Would comment on' : 'Commented on'} ${comments} PRs/issues.`)
const archived = archiveReleasedRoadmapItems(released, values['dry-run'])
console.log(
  `${values['dry-run'] ? 'Would archive' : 'Archived'} ${archived} released roadmap items.`,
)

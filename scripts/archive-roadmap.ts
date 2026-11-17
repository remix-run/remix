/** Archive released roadmap cards. Usage: RELEASE_TAG=remix@x.y.z node scripts/archive-roadmap.ts [--dry-run] */
import * as cp from 'node:child_process'
import { parseArgs } from 'node:util'
import { getReleasedPrNumbers } from './utils/released-prs.ts'

type GraphqlRequest = (query: string, variables: Record<string, unknown>) => Promise<unknown>

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

async function requestGitHub(query: string, variables: Record<string, unknown>): Promise<unknown> {
  let response: unknown = JSON.parse(
    cp.execFileSync('gh', ['api', 'graphql', '--input', '-'], {
      input: JSON.stringify({ query, variables }),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
    }),
  )
  return readObject(response).data
}

export async function archiveReleasedRoadmapItems(
  releasedPrs: Set<number>,
  { request = requestGitHub, dryRun = false }: { request?: GraphqlRequest; dryRun?: boolean } = {},
): Promise<number> {
  function isReleasedPr(value: unknown) {
    if (value === null) return false
    let pr = readObject(value)
    return (
      pr.merged === true &&
      typeof pr.number === 'number' &&
      readObject(pr.repository).nameWithOwner === 'remix-run/remix' &&
      releasedPrs.has(pr.number)
    )
  }

  async function isReleasedIssue(id: string) {
    let cursor: string | null = null
    do {
      let response = readObject(
        await request(
          `
            query($id: ID!, $cursor: String) {
              node(id: $id) {
                ... on Issue {
                  closedByPullRequestsReferences(first: 100, after: $cursor, includeClosedPrs: true) {
                    nodes { number merged repository { nameWithOwner } }
                    pageInfo { hasNextPage endCursor }
                  }
                }
              }
            }
          `,
          { id, cursor },
        ),
      )
      let references = readConnection(readObject(response.node).closedByPullRequestsReferences)
      if (references.nodes.some(isReleasedPr)) return true
      cursor = references.cursor
    } while (cursor)
    return false
  }

  let cursor: string | null = null
  let projectId: string
  let itemIds: string[] = []
  do {
    let response = readObject(
      await request(
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
                      ... on Issue { id }
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
      let released = content.__typename === 'PullRequest' && isReleasedPr(content)
      if (content.__typename === 'Issue' && typeof content.id === 'string') {
        released = await isReleasedIssue(content.id)
      }
      if (released) {
        if (typeof item.id !== 'string') throw new Error('Invalid roadmap item ID.')
        itemIds.push(item.id)
      }
    }
    cursor = items.cursor
  } while (cursor)

  // Read every page before archiving so mutations cannot shift pagination.
  if (!dryRun) {
    for (let itemId of itemIds) {
      await request(
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

if (import.meta.main) {
  let { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } })
  let tag = process.env.RELEASE_TAG
  if (!tag) throw new Error('RELEASE_TAG is required.')
  let releasedPrs = getReleasedPrNumbers(tag)
  console.log(`Found ${releasedPrs.size} PRs included in ${tag}.`)
  let count = await archiveReleasedRoadmapItems(releasedPrs, { dryRun: values['dry-run'] })
  console.log(
    `${values['dry-run'] ? 'Would archive' : 'Archived'} ${count} released roadmap items.`,
  )
}

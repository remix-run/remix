import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { archiveReleasedRoadmapItems } from './archive-roadmap.ts'

function makeItem(
  id: string,
  number: number,
  { name = 'Merged', isArchived = false, repository = 'remix-run/remix', merged = true } = {},
) {
  return {
    id,
    isArchived,
    fieldValueByName: { name },
    content: {
      __typename: 'PullRequest',
      number,
      merged,
      repository: { nameWithOwner: repository },
    },
  }
}

function makePage(nodes: unknown[], endCursor: string | null = null) {
  return {
    organization: {
      projectV2: {
        id: 'roadmap',
        items: { nodes, pageInfo: { hasNextPage: endCursor !== null, endCursor } },
      },
    },
  }
}

function runRoadmapScript(
  graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown>,
) {
  return archiveReleasedRoadmapItems(new Set([123, 456]), { request: graphql })
}

describe('roadmap release cleanup', () => {
  it('reads all project and closing-reference pages before archiving only released Merged cards', async () => {
    let events: string[] = []
    await runRoadmapScript(async (query, variables) => {
      if (query.includes('mutation')) {
        assert.equal(variables.projectId, 'roadmap')
        events.push(`archive:${variables.itemId}`)
        return {}
      }
      if (query.includes('closedByPullRequestsReferences')) {
        events.push(`issue:${variables.id}:${variables.cursor}`)
        let firstPage = variables.cursor === null
        let unlinked = variables.id === 'unlinked'
        let prs = [
          { number: 123, merged: true, repository: { nameWithOwner: 'other/repo' } },
          { number: 456, merged: false, repository: { nameWithOwner: 'remix-run/remix' } },
        ]
        if (unlinked) prs = []
        else if (!firstPage) {
          prs = [{ number: 123, merged: true, repository: { nameWithOwner: 'remix-run/remix' } }]
        }
        return {
          node: {
            closedByPullRequestsReferences: {
              nodes: prs,
              pageInfo: { hasNextPage: !unlinked && firstPage, endCursor: 'more-prs' },
            },
          },
        }
      }
      events.push(`project:${variables.cursor}`)
      if (variables.cursor === null) {
        return makePage(
          [
            makeItem('released', 123),
            makeItem('already-archived', 123, { isArchived: true }),
            makeItem('in-progress', 123, { name: 'In Progress' }),
            makeItem('other-repository', 123, { repository: 'remix-run/react-router' }),
            makeItem('unmerged', 123, { merged: false }),
            { id: 'no-status', isArchived: false, fieldValueByName: null },
            null,
          ],
          'next-page',
        )
      }
      return makePage([
        makeItem('also-released', 456),
        makeItem('next-release', 789),
        { ...makeItem('draft', 123), content: { __typename: 'DraftIssue' } },
        { ...makeItem('linked', 1), content: { __typename: 'Issue', id: 'linked' } },
        { ...makeItem('unlinked', 2), content: { __typename: 'Issue', id: 'unlinked' } },
      ])
    })
    assert.deepEqual(events, [
      'project:null',
      'project:next-page',
      'issue:linked:null',
      'issue:linked:more-prs',
      'issue:unlinked:null',
      'archive:released',
      'archive:also-released',
      'archive:linked',
    ])
  })

  it('does not archive a partial selection when a later page fails', async () => {
    await assert.rejects(
      () =>
        runRoadmapScript(async (query, variables) => {
          assert.ok(!query.includes('mutation'))
          if (variables.cursor === null) return makePage([makeItem('released', 123)], 'next-page')
          throw new Error('Roadmap query failed')
        }),
      /Roadmap query failed/,
    )
  })
})

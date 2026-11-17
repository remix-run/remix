import * as fs from 'node:fs'
import * as vm from 'node:vm'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { parseDocument } from 'yaml'

const workflow = parseDocument(
  fs.readFileSync(new URL('../../.github/workflows/publish.yaml', import.meta.url), 'utf8'),
)

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

async function runRoadmapScript(
  graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown>,
  releasedPrs = '[123,456]',
) {
  let script: unknown = workflow.getIn(['jobs', 'roadmap', 'steps', 5, 'with', 'script'])
  assert.equal(typeof script, 'string')
  let result: unknown = vm.runInNewContext(`(async () => { ${script} })()`, {
    github: { graphql },
    process: { env: { RELEASED_PRS: releasedPrs } },
    core: { info() {} },
  })
  await result
}

describe('roadmap release cleanup', () => {
  it('only runs after the publisher succeeds with a Remix release tag', () => {
    assert.equal(workflow.getIn(['jobs', 'roadmap', 'needs']), 'publish')
    assert.equal(
      workflow.getIn(['jobs', 'roadmap', 'if']),
      "startsWith(needs.publish.outputs.tag, 'remix@')",
    )
    assert.equal(
      workflow.getIn(['jobs', 'roadmap', 'steps', 4, 'env', 'RELEASE_TAG']),
      '${{ needs.publish.outputs.tag }}',
    )
  })

  it('reads all pages before archiving only active Merged cards for released Remix PRs', async () => {
    let events: string[] = []
    await runRoadmapScript(async (query, variables) => {
      if (query.includes('mutation')) {
        assert.equal(variables.projectId, 'roadmap')
        events.push(`archive:${variables.itemId}`)
        return {}
      }
      events.push(`read:${variables.cursor}`)
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
      assert.equal(variables.cursor, 'next-page')
      return makePage([
        makeItem('also-released', 456),
        makeItem('next-release', 789),
        { ...makeItem('draft', 123), content: { __typename: 'DraftIssue' } },
      ])
    })
    assert.deepEqual(events, [
      'read:null',
      'read:next-page',
      'archive:released',
      'archive:also-released',
    ])
  })

  it('paginates closing references and archives issues linked to released PRs', async () => {
    let archived: unknown[] = []
    let issuePages: unknown[] = []
    await runRoadmapScript(async (query, variables) => {
      if (query.includes('mutation')) {
        archived.push(variables.itemId)
        return {}
      }
      if (query.includes('closedByPullRequestsReferences')) {
        assert.equal(variables.id, 'issue-node')
        issuePages.push(variables.cursor)
        return {
          node: {
            closedByPullRequestsReferences: {
              nodes:
                variables.cursor === null
                  ? [
                      { number: 123, merged: true, repository: { nameWithOwner: 'other/repo' } },
                      {
                        number: 456,
                        merged: false,
                        repository: { nameWithOwner: 'remix-run/remix' },
                      },
                    ]
                  : [
                      {
                        number: 123,
                        merged: true,
                        repository: { nameWithOwner: 'remix-run/remix' },
                      },
                    ],
              pageInfo: { hasNextPage: variables.cursor === null, endCursor: 'more-prs' },
            },
          },
        }
      }
      return makePage([
        {
          ...makeItem('linked-issue', 1),
          content: { __typename: 'Issue', id: 'issue-node' },
        },
      ])
    })
    assert.deepEqual(issuePages, [null, 'more-prs'])
    assert.deepEqual(archived, ['linked-issue'])
  })

  it('leaves unlinked issues and empty columns alone', async () => {
    await runRoadmapScript(async (query) => {
      assert.ok(!query.includes('mutation'))
      if (query.includes('closedByPullRequestsReferences')) {
        return {
          node: {
            closedByPullRequestsReferences: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }
      }
      return makePage([
        { ...makeItem('unlinked', 1), content: { __typename: 'Issue', id: 'issue' } },
      ])
    })
    await runRoadmapScript(async (query) => {
      assert.ok(!query.includes('mutation'))
      return makePage([])
    })
  })

  it('fails without touching the roadmap when the released PR list is unavailable', async () => {
    await assert.rejects(
      () => runRoadmapScript(async () => assert.fail('Unexpected roadmap request'), 'null'),
      /Could not determine the released pull requests/,
    )
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

  it('reports archive failures so the cleanup job can be retried', async () => {
    await assert.rejects(
      () =>
        runRoadmapScript(async (query) => {
          if (!query.includes('mutation')) return makePage([makeItem('released', 123)])
          throw new Error('Archive failed')
        }),
      /Archive failed/,
    )
  })
})

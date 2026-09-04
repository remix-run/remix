---
description: Resolve the trusted administrator request for slash, label, and bot-dispatched commands
steps:
  - name: Resolve trusted administrator request
    id: trusted-request
    uses: actions/github-script@v9
    env:
      BOT_LOGIN: remix-run-bot
      EXPECTED_REPOSITORY: remix-run/remix
      ROUTER_WORKFLOW: .github/workflows/aw-comment-router.lock.yml
    with:
      script: |
        const crypto = require('crypto')
        const fs = require('fs')
        const botLogin = process.env.BOT_LOGIN.toLowerCase()
        const expectedRepository = process.env.EXPECTED_REPOSITORY.toLowerCase()
        const requestPath = '/tmp/gh-aw/agent/trusted-request.json'
        const workflowByName = {
          '/triage': { workflow: 'triage', label: 'aw:triage', itemTypes: ['issue'] },
          '/review': { workflow: 'review', label: 'aw:review', itemTypes: ['pull_request'] },
          '/implement': {
            workflow: 'implement',
            label: 'aw:implement',
            itemTypes: ['issue', 'discussion'],
          },
          '/iterate': { workflow: 'iterate', label: 'aw:iterate', itemTypes: ['pull_request'] },
        }

        function writeRequest(request) {
          fs.mkdirSync('/tmp/gh-aw/agent', { recursive: true })
          fs.writeFileSync(requestPath, JSON.stringify(request, null, 2), {
            encoding: 'utf8',
            mode: 0o600,
          })
        }

        function hasExactBotMention(body) {
          return new RegExp(`@${botLogin}(?![a-z0-9-])`, 'i').test(body)
        }

        function bodyHash(body) {
          return crypto.createHash('sha256').update(body, 'utf8').digest('hex')
        }

        async function isRepositoryAdmin(login) {
          if (!login) return false
          try {
            const response = await github.rest.repos.getCollaboratorPermissionLevel({
              ...context.repo,
              username: login,
            })
            return response.data.permission === 'admin'
          } catch (error) {
            if (error.status === 404) return false
            throw error
          }
        }

        async function getPullRequestSnapshot(pullNumber) {
          if (!pullNumber) return undefined

          const response = await github.rest.pulls.get({
            ...context.repo,
            pull_number: pullNumber,
          })
          const pull = response.data
          return {
            number: pull.number,
            url: pull.html_url,
            baseSha: pull.base.sha,
            headSha: pull.head.sha,
            baseRepository: pull.base.repo.full_name,
            headRepository: pull.head.repo?.full_name,
            headRef: pull.head.ref,
          }
        }

        if (context.eventName === 'workflow_dispatch') {
          if ((context.actor ?? process.env.GITHUB_ACTOR)?.toLowerCase() !== botLogin) {
            core.setFailed('Only remix-run-bot may dispatch a routed workflow')
            return
          }

          let dispatchContext
          try {
            dispatchContext = JSON.parse(context.payload.inputs?.aw_context ?? '')
          } catch {
            core.setFailed('The routed workflow context is not valid JSON')
            return
          }

          const expectedWorkflow = workflowByName[context.workflow]
          if (!expectedWorkflow) {
            core.setFailed('The dispatched workflow is not a supported agentic command')
            return
          }

          const validBaseContext =
            dispatchContext?.version === 1 &&
            dispatchContext.repository?.toLowerCase() === expectedRepository &&
            dispatchContext.router_workflow === process.env.ROUTER_WORKFLOW &&
            Number.isSafeInteger(dispatchContext.router_run_id) &&
            ['issue_comment', 'discussion_comment'].includes(dispatchContext.event_type) &&
            expectedWorkflow.itemTypes.includes(dispatchContext.item_type) &&
            Number.isSafeInteger(dispatchContext.item_number) &&
            dispatchContext.item_number > 0 &&
            Number.isSafeInteger(dispatchContext.comment_id) &&
            dispatchContext.comment_id > 0 &&
            typeof dispatchContext.actor === 'string' &&
            dispatchContext.workflow === expectedWorkflow.workflow &&
            dispatchContext.label ===
              (dispatchContext.item_type === 'discussion' ? null : expectedWorkflow.label) &&
            /^[0-9a-f]{64}$/.test(dispatchContext.comment_body_sha256 ?? '')
          if (!validBaseContext) {
            core.setFailed('The routed workflow context does not match this command')
            return
          }

          if (
            (dispatchContext.event_type === 'discussion_comment') !==
            (dispatchContext.item_type === 'discussion')
          ) {
            core.setFailed('The routed event type does not match the triggering item')
            return
          }

          const routerRun = await github.rest.actions.getWorkflowRun({
            ...context.repo,
            run_id: dispatchContext.router_run_id,
          })
          const run = routerRun.data
          if (
            run.repository?.full_name?.toLowerCase() !== expectedRepository ||
            run.path !== process.env.ROUTER_WORKFLOW ||
            run.event !== dispatchContext.event_type ||
            run.actor?.login?.toLowerCase() !== dispatchContext.actor.toLowerCase()
          ) {
            core.setFailed('The routed workflow context does not match its router run')
            return
          }

          let sourceComment
          let pullNumber
          if (dispatchContext.item_type === 'discussion') {
            if (typeof dispatchContext.comment_node_id !== 'string') {
              core.setFailed('The routed Discussion comment node ID is missing')
              return
            }
            const response = await github.graphql(
              `query($id: ID!) {
                node(id: $id) {
                  ... on DiscussionComment {
                    id
                    databaseId
                    body
                    author { login }
                    discussion {
                      number
                      repository { nameWithOwner }
                      category { slug }
                    }
                  }
                }
              }`,
              { id: dispatchContext.comment_node_id }
            )
            const comment = response.node
            if (
              comment?.id !== dispatchContext.comment_node_id ||
              comment.databaseId !== dispatchContext.comment_id ||
              comment.discussion?.number !== dispatchContext.item_number ||
              comment.discussion.repository?.nameWithOwner?.toLowerCase() !== expectedRepository ||
              comment.discussion.category?.slug !== 'proposals'
            ) {
              core.setFailed('The routed comment is not on the expected Proposal Discussion')
              return
            }
            sourceComment = comment
          } else {
            const [commentResponse, issueResponse] = await Promise.all([
              github.rest.issues.getComment({
                ...context.repo,
                comment_id: dispatchContext.comment_id,
              }),
              github.rest.issues.get({
                ...context.repo,
                issue_number: dispatchContext.item_number,
              }),
            ])
            const comment = commentResponse.data
            const issuePath = new URL(comment.issue_url).pathname.toLowerCase()
            const expectedIssuePath =
              `/repos/${expectedRepository}/issues/${dispatchContext.item_number}`
            const isPullRequest = Boolean(issueResponse.data.pull_request)
            if (
              issuePath !== expectedIssuePath ||
              isPullRequest !== (dispatchContext.item_type === 'pull_request')
            ) {
              core.setFailed('The routed comment is not on the expected issue or pull request')
              return
            }
            sourceComment = comment
            if (isPullRequest) pullNumber = dispatchContext.item_number
          }

          const author = sourceComment.author?.login ?? sourceComment.user?.login
          const body = sourceComment.body ?? ''
          if (
            author?.toLowerCase() !== dispatchContext.actor.toLowerCase() ||
            !(await isRepositoryAdmin(author)) ||
            !hasExactBotMention(body) ||
            bodyHash(body) !== dispatchContext.comment_body_sha256
          ) {
            core.setFailed('The routed administrator comment is no longer valid')
            return
          }

          writeRequest({
            source: 'bot-dispatch',
            commentId: dispatchContext.comment_id,
            author,
            text: body,
            pullRequest: await getPullRequestSnapshot(pullNumber),
          })
          return
        }

        if (context.eventName === 'issue_comment' || context.eventName === 'discussion_comment') {
          const comment = context.payload.comment
          const pullNumber = context.payload.pull_request?.number ??
            (context.payload.issue?.pull_request ? context.payload.issue.number : undefined)
          writeRequest({
            source: 'slash-command',
            commentId: comment.id,
            author: comment.user.login,
            text: comment.body,
            pullRequest: await getPullRequestSnapshot(pullNumber),
          })
          return
        }

        if (context.payload.action !== 'labeled') {
          core.setFailed('Expected a slash-command comment, labeled event, or routed dispatch')
          return
        }

        const labelName = context.payload.label?.name
        const sender = context.payload.sender?.login
        if (!labelName?.startsWith('aw:') || !sender) {
          core.setFailed('The labeled event is missing its agentic-workflow label or sender')
          return
        }
        if (sender.toLowerCase() === botLogin) {
          core.setFailed('Labels applied by remix-run-bot cannot activate agentic workflows')
          return
        }
        if (!(await isRepositoryAdmin(sender))) {
          core.setFailed('Only a repository administrator may apply this label')
          return
        }

        const pullNumber = context.payload.pull_request?.number ??
          (context.payload.issue?.pull_request ? context.payload.issue.number : undefined)
        writeRequest({
          source: 'manual-label',
          label: labelName,
          author: sender,
          text: '',
          pullRequest: await getPullRequestSnapshot(pullNumber),
        })
---

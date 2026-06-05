import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRelease, type GitHubRequest } from './github.ts'

interface MockCall {
  route: string
  options: Record<string, unknown>
}

function withGitHubToken(callback: () => Promise<void>) {
  let previousToken = process.env.GITHUB_TOKEN
  process.env.GITHUB_TOKEN = 'test-token'

  return callback().finally(() => {
    if (previousToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = previousToken
    }
  })
}

function createHttpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status })
}

function createCodeError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

describe('createRelease', () => {
  it('treats a failed create response as success when the release exists afterward', async () => {
    await withGitHubToken(async () => {
      let calls: MockCall[] = []
      let githubRequest: GitHubRequest = async (route, options) => {
        calls.push({ route, options })

        if (route === 'GET /repos/{owner}/{repo}/releases/tags/{tag}') {
          if (calls.length === 1) {
            throw createHttpError(404, 'Not Found')
          }

          return {
            data: {
              html_url: 'https://github.com/remix-run/remix/releases/tag/test%400.4.2',
            },
          }
        }

        if (route === 'POST /repos/{owner}/{repo}/releases') {
          throw createCodeError('EPIPE', 'write EPIPE')
        }

        throw new Error(`Unexpected route: ${route}`)
      }

      let result = await createRelease('@remix-run/test', '0.4.2', {
        request: githubRequest,
        retryDelayMs: 0,
      })

      assert.deepEqual(result, {
        status: 'created',
        url: 'https://github.com/remix-run/remix/releases/tag/test%400.4.2',
      })
      assert.deepEqual(
        calls.map((call) => call.route),
        [
          'GET /repos/{owner}/{repo}/releases/tags/{tag}',
          'POST /repos/{owner}/{repo}/releases',
          'GET /repos/{owner}/{repo}/releases/tags/{tag}',
        ],
      )
    })
  })

  it('retries transient create failures before reporting success', async () => {
    await withGitHubToken(async () => {
      let postAttempts = 0
      let githubRequest: GitHubRequest = async (route) => {
        if (route === 'GET /repos/{owner}/{repo}/releases/tags/{tag}') {
          throw createHttpError(404, 'Not Found')
        }

        if (route === 'POST /repos/{owner}/{repo}/releases') {
          postAttempts++
          if (postAttempts === 1) {
            throw createHttpError(502, 'Bad Gateway')
          }

          return {
            data: {
              html_url: 'https://github.com/remix-run/remix/releases/tag/ui%400.3.0',
            },
          }
        }

        throw new Error(`Unexpected route: ${route}`)
      }

      let result = await createRelease('@remix-run/ui', '0.3.0', {
        request: githubRequest,
        retryDelayMs: 0,
      })

      assert.deepEqual(result, {
        status: 'created',
        url: 'https://github.com/remix-run/remix/releases/tag/ui%400.3.0',
      })
      assert.equal(postAttempts, 2)
    })
  })
})

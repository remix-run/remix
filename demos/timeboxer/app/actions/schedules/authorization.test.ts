import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'

const { seed } = await import('../../data/seed.ts')
const { db, loadAppMigrations } = await import('../../db.ts')
const { router } = await import('../../router.ts')
const { routes } = await import('../../routes.ts')

await db.reset({ migrations: await loadAppMigrations(), seed })

describe('schedule authorization', () => {
  it('does not expose another user active schedule', async () => {
    let userA = await createAuthenticatedClient()
    let userB = await createAuthenticatedClient()

    let userASchedule = await createSchedule(userA, 'user a schedule')
    let userBSchedule = await createSchedule(userB, 'user b private schedule')
    let userBUpdatedSchedule = await replaceSchedule(userB, userBSchedule, {
      name: userBSchedule.name,
      blocks: [
        {
          id: 'private-focus',
          color: 'purple',
          dayOfWeek: 0,
          startMinute: 540,
          endMinute: 600,
          name: 'private focus',
        },
      ],
    })

    let listResponse = await userA.fetchJson(routes.schedules.index.href(), {
      method: 'GET',
    })
    assert.equal(listResponse.status, 200)
    let listJson = await listResponse.json()
    assert.deepEqual(
      listJson.schedules.map((schedule: { id: number; name: string }) => [
        schedule.id,
        schedule.name,
      ]),
      [[userASchedule.id, userASchedule.name]],
    )

    let homeResponse = await userA.fetchPage(routes.home.index.href())
    assert.equal(homeResponse.status, 302)
    assert.equal(
      new URL(homeResponse.headers.get('Location')!, 'http://localhost').pathname,
      routes.schedules.show.href({ scheduleId: String(userASchedule.id) }),
    )

    let showJsonResponse = await userA.fetchJson(
      routes.schedules.show.href({ scheduleId: String(userBSchedule.id) }),
      {
        method: 'GET',
      },
    )
    await assertScheduleNotFoundWithoutLeak(showJsonResponse)

    let showPageResponse = await userA.fetchPage(
      routes.schedules.show.href({ scheduleId: String(userBSchedule.id) }),
    )
    await assertScheduleNotFoundWithoutLeak(showPageResponse)

    let updateResponse = await userA.fetchJson(
      routes.schedules.update.href({ scheduleId: String(userBSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'stolen schedule',
          baseRevision: userBUpdatedSchedule.revision,
          blocks: [],
        },
      },
    )
    await assertScheduleNotFoundWithoutLeak(updateResponse)

    let deleteResponse = await userA.fetchJson(
      routes.schedules.destroy.href({ scheduleId: String(userBSchedule.id) }),
      {
        method: 'DELETE',
      },
    )
    await assertScheduleNotFoundWithoutLeak(deleteResponse)

    let downloadResponse = await userA.fetchPage(
      routes.schedules.downloadIcs.href({ scheduleId: String(userBSchedule.id) }),
    )
    await assertScheduleNotFoundWithoutLeak(downloadResponse)

    let ownerShowResponse = await userB.fetchJson(
      routes.schedules.show.href({ scheduleId: String(userBSchedule.id) }),
      {
        method: 'GET',
      },
    )
    assert.equal(ownerShowResponse.status, 200)
    let { schedule: ownerSchedule } = await ownerShowResponse.json()
    assert.equal(ownerSchedule.name, userBSchedule.name)
    assert.equal(ownerSchedule.revision, userBUpdatedSchedule.revision)
    assert.deepEqual(
      ownerSchedule.blocks.map((block: { id: string; name: string }) => [block.id, block.name]),
      [['private-focus', 'private focus']],
    )
  })
})

let userIndex = 0

async function createAuthenticatedClient() {
  let cookie = ''
  let signupResponse = await router.fetch(new Request(url(routes.auth.signup.index.href())))
  cookie = mergeCookie(cookie, signupResponse.headers)
  let csrfToken = extractCsrfToken(await signupResponse.text())

  let formData = new FormData()
  userIndex++
  formData.set('username', `user-${process.pid}-${userIndex}`)
  formData.set('password', 'password123')
  formData.set('_csrf', csrfToken)

  let signupActionResponse = await router.fetch(
    new Request(url(routes.auth.signup.action.href()), {
      method: 'POST',
      headers: cookie ? { cookie } : undefined,
      body: formData,
    }),
  )
  assert.equal(signupActionResponse.status, 303)
  cookie = mergeCookie(cookie, signupActionResponse.headers)

  let homeResponse = await router.fetch(
    new Request(url(routes.home.index.href()), {
      headers: cookie ? { cookie } : undefined,
    }),
  )
  cookie = mergeCookie(cookie, homeResponse.headers)
  csrfToken = extractCsrfToken(await homeResponse.text())

  return {
    async fetchPage(path: string) {
      return await router.fetch(
        new Request(url(path), {
          headers: {
            Accept: 'text/html',
            Cookie: cookie,
          },
        }),
      )
    },

    async fetchJson(path: string, init: { body?: unknown; method: string }) {
      return await router.fetch(
        jsonRequest(path, {
          method: init.method,
          cookie,
          csrfToken,
          body: init.body,
        }),
      )
    },
  }
}

async function createSchedule(
  client: Awaited<ReturnType<typeof createAuthenticatedClient>>,
  name: string,
) {
  let response = await client.fetchJson(routes.schedules.create.href(), {
    method: 'POST',
    body: { name },
  })
  assert.equal(response.status, 201)

  let { schedule } = await response.json()
  return schedule
}

async function replaceSchedule(
  client: Awaited<ReturnType<typeof createAuthenticatedClient>>,
  schedule: { id: number; name: string; revision: number },
  input: {
    blocks: Array<{
      color: string | null
      dayOfWeek: number
      endMinute: number
      id: string
      name: string
      startMinute: number
    }>
    name: string
  },
) {
  let response = await client.fetchJson(
    routes.schedules.update.href({ scheduleId: String(schedule.id) }),
    {
      method: 'PUT',
      body: {
        name: input.name,
        baseRevision: schedule.revision,
        blocks: input.blocks,
      },
    },
  )
  assert.equal(response.status, 200)

  let { schedule: updatedSchedule } = await response.json()
  return updatedSchedule
}

async function assertScheduleNotFoundWithoutLeak(response: Response) {
  assert.equal(response.status, 404)

  let body = await response.text()
  assert.deepEqual(JSON.parse(body), { error: 'Schedule not found.' })
  assert.doesNotMatch(body, /user b private schedule/)
  assert.doesNotMatch(body, /private focus/)
}

function jsonRequest(
  path: string,
  init: { body?: unknown; cookie?: string; csrfToken?: string; method: string },
) {
  let headers = new Headers({ Accept: 'application/json' })
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (init.cookie) headers.set('Cookie', init.cookie)
  if (init.csrfToken) headers.set('X-Csrf-Token', init.csrfToken)

  return new Request(url(path), {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

function url(path: string) {
  return new URL(path, 'http://localhost').href
}

function extractCsrfToken(html: string) {
  let match = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]+)"/)
  assert.ok(match, 'Expected rendered page to include a CSRF input')
  return match[1]!
}

function mergeCookie(currentCookie: string, headers: Headers) {
  let setCookie = headers.get('Set-Cookie')
  if (!setCookie) return currentCookie

  let cookiePair = setCookie.split(';', 1)[0]!
  if (!currentCookie) return cookiePair

  let cookieName = cookiePair.split('=', 1)[0]
  let existingPairs = currentCookie
    .split('; ')
    .filter((pair) => pair.split('=', 1)[0] !== cookieName)

  return [...existingPairs, cookiePair].join('; ')
}

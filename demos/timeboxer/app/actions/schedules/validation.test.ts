import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'

const { db, getMigrations, seed } = await import('../../db.ts')
const { router } = await import('../../router.ts')
const { routes } = await import('../../routes.ts')

await db.reset({ migrations: await getMigrations(), seed })

describe('schedule input validation', () => {
  it('rejects invalid JSON request bodies', async () => {
    let client = await createAuthenticatedClient()

    let createResponse = await client.fetchRawJson(routes.schedules.create.href(), {
      method: 'POST',
      body: '{',
    })
    assert.equal(createResponse.status, 400)
    assert.deepEqual(await createResponse.json(), {
      error: 'Validation failed.',
      fieldErrors: {},
      issues: [{ message: 'Expected a valid JSON request body.' }],
    })

    let schedule = await createSchedule(client, 'json validation schedule')

    let updateResponse = await client.fetchRawJson(
      routes.schedules.update.href({ scheduleId: String(schedule.id) }),
      {
        method: 'PUT',
        body: '{',
      },
    )
    assert.equal(updateResponse.status, 400)
    assert.deepEqual(await updateResponse.json(), {
      error: 'Validation failed.',
      fieldErrors: {},
      issues: [{ message: 'Expected a valid JSON request body.' }],
    })
  })

  it('rejects invalid integer schedule ids', async () => {
    let client = await createAuthenticatedClient()

    let response = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: 'not-an-int' }),
      {
        method: 'PUT',
        body: {
          name: 'integer validation schedule',
          baseRevision: 0,
          blocks: [],
        },
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'scheduleId must be an integer.',
    })
  })

  it('rejects invalid day and time bounds without changing the schedule', async () => {
    let client = await createAuthenticatedClient()
    let schedule = await createSchedule(client, 'bounds validation schedule')

    let negativeDayResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ dayOfWeek: -1 })],
    })
    assert.equal(negativeDayResponse.status, 400)
    assert.deepEqual(await negativeDayResponse.json(), {
      error: 'Scheduled blocks must have valid dayOfWeek, startMinute, and endMinute values.',
    })

    let overflowDayResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ dayOfWeek: 7 })],
    })
    assert.equal(overflowDayResponse.status, 400)

    let negativeStartResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ startMinute: -1 })],
    })
    assert.equal(negativeStartResponse.status, 400)

    let overflowEndResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ endMinute: 1441 })],
    })
    assert.equal(overflowEndResponse.status, 400)

    let persistedSchedule = await getSchedule(client, schedule.id)
    assert.equal(persistedSchedule.revision, 0)
    assert.deepEqual(persistedSchedule.blocks, [])
  })

  it('rejects zero and negative duration blocks', async () => {
    let client = await createAuthenticatedClient()
    let schedule = await createSchedule(client, 'duration validation schedule')

    let zeroDurationResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ endMinute: 480 })],
    })
    assert.equal(zeroDurationResponse.status, 400)
    assert.deepEqual(await zeroDurationResponse.json(), {
      error: 'Scheduled blocks must have valid dayOfWeek, startMinute, and endMinute values.',
    })

    let negativeDurationResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ startMinute: 500, endMinute: 480 })],
    })
    assert.equal(negativeDurationResponse.status, 400)

    let persistedSchedule = await getSchedule(client, schedule.id)
    assert.equal(persistedSchedule.revision, 0)
    assert.deepEqual(persistedSchedule.blocks, [])
  })

  it('accepts maximum name, id, and color lengths and rejects longer values', async () => {
    let client = await createAuthenticatedClient()
    let maxScheduleName = 's'.repeat(80)
    let maxBlockId = 'i'.repeat(80)
    let maxBlockName = 'n'.repeat(80)
    let maxColor = 'c'.repeat(64)

    let schedule = await createSchedule(client, maxScheduleName)
    assert.equal(schedule.name, maxScheduleName)

    let acceptedResponse = await replaceSchedule(client, schedule.id, {
      name: maxScheduleName,
      baseRevision: schedule.revision,
      blocks: [
        block({
          id: maxBlockId,
          name: maxBlockName,
          color: maxColor,
        }),
      ],
    })
    assert.equal(acceptedResponse.status, 200)
    let { schedule: acceptedSchedule } = await acceptedResponse.json()
    assert.equal(acceptedSchedule.name, maxScheduleName)
    assert.deepEqual(acceptedSchedule.blocks, [
      {
        id: maxBlockId,
        name: maxBlockName,
        color: maxColor,
        dayOfWeek: 0,
        startMinute: 480,
        endMinute: 540,
      },
    ])

    let longScheduleNameResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: 's'.repeat(81) },
    })
    assert.equal(longScheduleNameResponse.status, 400)
    let longScheduleNameJson = await longScheduleNameResponse.json()
    assert.equal(longScheduleNameJson.fieldErrors.name, 'Name must be 80 characters or fewer.')

    let longBlockIdResponse = await replaceSchedule(client, schedule.id, {
      name: maxScheduleName,
      baseRevision: acceptedSchedule.revision,
      blocks: [block({ id: 'i'.repeat(81) })],
    })
    assert.equal(longBlockIdResponse.status, 400)

    let longBlockNameResponse = await replaceSchedule(client, schedule.id, {
      name: maxScheduleName,
      baseRevision: acceptedSchedule.revision,
      blocks: [block({ name: 'n'.repeat(81) })],
    })
    assert.equal(longBlockNameResponse.status, 400)

    let longColorResponse = await replaceSchedule(client, schedule.id, {
      name: maxScheduleName,
      baseRevision: acceptedSchedule.revision,
      blocks: [block({ color: 'c'.repeat(65) })],
    })
    assert.equal(longColorResponse.status, 400)

    let persistedSchedule = await getSchedule(client, schedule.id)
    assert.equal(persistedSchedule.revision, acceptedSchedule.revision)
    assert.deepEqual(persistedSchedule.blocks, acceptedSchedule.blocks)
  })

  it('accepts nullable color and adjacent blocks', async () => {
    let client = await createAuthenticatedClient()
    let schedule = await createSchedule(client, 'adjacent validation schedule')

    let response = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [
        block({
          id: 'first',
          name: 'first',
          color: null,
          startMinute: 480,
          endMinute: 510,
        }),
        block({
          id: 'second',
          name: 'second',
          color: null,
          startMinute: 510,
          endMinute: 540,
        }),
      ],
    })

    assert.equal(response.status, 200)
    let { schedule: savedSchedule } = await response.json()
    assert.equal(savedSchedule.revision, 1)
    assert.deepEqual(savedSchedule.blocks, [
      {
        id: 'first',
        name: 'first',
        color: null,
        dayOfWeek: 0,
        startMinute: 480,
        endMinute: 510,
      },
      {
        id: 'second',
        name: 'second',
        color: null,
        dayOfWeek: 0,
        startMinute: 510,
        endMinute: 540,
      },
    ])
  })

  it('rolls back failed replacements and keeps the persisted revision unchanged', async () => {
    let client = await createAuthenticatedClient()
    let schedule = await createSchedule(client, 'rollback validation schedule')

    let initialReplaceResponse = await replaceSchedule(client, schedule.id, {
      name: schedule.name,
      baseRevision: schedule.revision,
      blocks: [block({ id: 'original', name: 'original', color: 'blue' })],
    })
    assert.equal(initialReplaceResponse.status, 200)
    let { schedule: savedSchedule } = await initialReplaceResponse.json()

    let failedReplaceResponse = await replaceSchedule(client, schedule.id, {
      name: 'should roll back',
      baseRevision: savedSchedule.revision,
      blocks: [
        block({
          id: 'duplicate',
          name: 'updated first',
          color: 'green',
          startMinute: 480,
          endMinute: 510,
        }),
        block({
          id: 'duplicate',
          name: 'updated second',
          color: 'red',
          startMinute: 510,
          endMinute: 540,
        }),
      ],
    })
    assert.equal(failedReplaceResponse.status, 400)
    assert.deepEqual(await failedReplaceResponse.json(), {
      error: 'Scheduled block ids must be unique.',
    })

    let persistedSchedule = await getSchedule(client, schedule.id)
    assert.equal(persistedSchedule.name, savedSchedule.name)
    assert.equal(persistedSchedule.revision, savedSchedule.revision)
    assert.deepEqual(persistedSchedule.blocks, savedSchedule.blocks)
  })
})

interface TestClient {
  fetchJson(path: string, init: { body?: unknown; method: string }): Promise<Response>
  fetchRawJson(path: string, init: { body: string; method: string }): Promise<Response>
}

interface TestSchedule {
  blocks: TestScheduleBlock[]
  id: number
  name: string
  revision: number
}

interface TestScheduleBlock {
  color: string | null
  dayOfWeek: number
  endMinute: number
  id: string
  name: string
  startMinute: number
}

interface ReplaceScheduleInput {
  baseRevision: number
  blocks: TestScheduleBlock[]
  name: string
}

let nextUsername = 0

async function createAuthenticatedClient(): Promise<TestClient> {
  let cookie = ''
  let signupResponse = await router.fetch(new Request(url(routes.auth.signup.index.href())))
  cookie = mergeCookie(cookie, signupResponse.headers)
  let csrfToken = extractCsrfToken(await signupResponse.text())

  let formData = new FormData()
  formData.set('username', `validation-user-${process.pid}-${nextUsername++}`)
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
    async fetchJson(path, init) {
      return await router.fetch(
        jsonRequest(path, {
          method: init.method,
          cookie,
          csrfToken,
          body: init.body,
        }),
      )
    },

    async fetchRawJson(path, init) {
      return await router.fetch(
        rawJsonRequest(path, {
          method: init.method,
          cookie,
          csrfToken,
          body: init.body,
        }),
      )
    },
  }
}

async function createSchedule(client: TestClient, name: string): Promise<TestSchedule> {
  let response = await client.fetchJson(routes.schedules.create.href(), {
    method: 'POST',
    body: { name },
  })
  assert.equal(response.status, 201)

  let { schedule } = await response.json()
  return schedule
}

async function getSchedule(client: TestClient, scheduleId: number): Promise<TestSchedule> {
  let response = await client.fetchJson(
    routes.schedules.show.href({ scheduleId: String(scheduleId) }),
    {
      method: 'GET',
    },
  )
  assert.equal(response.status, 200)

  let { schedule } = await response.json()
  return schedule
}

async function replaceSchedule(
  client: TestClient,
  scheduleId: number,
  input: ReplaceScheduleInput,
) {
  return await client.fetchJson(routes.schedules.update.href({ scheduleId: String(scheduleId) }), {
    method: 'PUT',
    body: input,
  })
}

function block(overrides: Partial<TestScheduleBlock> = {}): TestScheduleBlock {
  return {
    id: 'block',
    name: 'block',
    color: 'blue',
    dayOfWeek: 0,
    startMinute: 480,
    endMinute: 540,
    ...overrides,
  }
}

function jsonRequest(
  path: string,
  init: { body?: unknown; cookie?: string; csrfToken?: string; method: string },
) {
  return rawJsonRequest(path, {
    method: init.method,
    cookie: init.cookie,
    csrfToken: init.csrfToken,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

function rawJsonRequest(
  path: string,
  init: { body?: string; cookie?: string; csrfToken?: string; method: string },
) {
  let headers = new Headers({ Accept: 'application/json' })
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (init.cookie) headers.set('Cookie', init.cookie)
  if (init.csrfToken) headers.set('X-Csrf-Token', init.csrfToken)

  return new Request(url(path), {
    method: init.method,
    headers,
    body: init.body,
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

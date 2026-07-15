import assert from 'node:assert/strict'

import { describe, it } from 'remix/test'

process.env.SESSION_SECRET = 'test-session-secret'

const { router } = await import('../../router.ts')
const { routes } = await import('../../routes.ts')
const { db, migrator, seed } = await import('../../db.ts')
await migrator.reset(db, { seed })
const { schedules } = await import('../../data/schema.ts')

describe('schedule endpoints', () => {
  it('requires authentication', async () => {
    let anonymousClient = await createAnonymousClient()

    let response = await router.fetch(
      jsonRequest(routes.schedules.index.href(), {
        method: 'GET',
      }),
    )

    assert.equal(response.status, 401)

    let downloadResponse = await router.fetch(
      jsonRequest(routes.schedules.downloadIcs.href({ scheduleId: '1' }), {
        method: 'GET',
      }),
    )

    assert.equal(downloadResponse.status, 401)

    let deleteResponse = await anonymousClient.fetchJson(
      routes.schedules.destroy.href({ scheduleId: '1' }),
      {
        method: 'DELETE',
      },
    )

    assert.equal(deleteResponse.status, 401)
  })

  it('creates schedules and replaces the full schedule document', async () => {
    let client = await createAuthenticatedClient()

    let createScheduleResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: 'regular schedule' },
    })
    assert.equal(createScheduleResponse.status, 201)

    let { schedule: createdSchedule } = await createScheduleResponse.json()
    assert.equal(createdSchedule.name, 'regular schedule')
    assert.equal(createdSchedule.revision, 0)
    assert.deepEqual(createdSchedule.blocks, [])

    let duplicateScheduleResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: 'regular schedule' },
    })
    assert.equal(duplicateScheduleResponse.status, 409)
    assert.deepEqual(await duplicateScheduleResponse.json(), {
      error: 'Name must be unique.',
      fieldErrors: {
        name: 'Name must be unique.',
      },
    })

    let invalidScheduleResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: ' ' },
    })
    assert.equal(invalidScheduleResponse.status, 400)
    let invalidScheduleJson = await invalidScheduleResponse.json()
    assert.equal(invalidScheduleJson.error, 'Validation failed.')
    assert.equal(typeof invalidScheduleJson.fieldErrors.name, 'string')

    let listResponse = await client.fetchJson(routes.schedules.index.href(), {
      method: 'GET',
    })
    assert.equal(listResponse.status, 200)
    let listJson = await listResponse.json()
    assert.equal(listJson.schedules.length, 1)

    let rootResponse = await client.fetchPage(routes.home.index.href())
    assert.equal(rootResponse.status, 302)
    assert.equal(
      new URL(rootResponse.headers.get('Location')!, 'http://localhost').pathname,
      routes.schedules.show.href({ scheduleId: String(createdSchedule.id) }),
    )

    let schedulePageResponse = await client.fetchPage(
      routes.schedules.show.href({ scheduleId: String(createdSchedule.id) }),
    )
    assert.equal(schedulePageResponse.status, 200)
    let schedulePageHtml = await schedulePageResponse.text()
    assert.match(schedulePageHtml, /regular schedule/i)
    assert.match(schedulePageHtml, /Download ICS/)
    assert.match(schedulePageHtml, /aria-label="Delete regular schedule"/)
    assert.match(schedulePageHtml, /aria-current="page"/)

    let showResponse = await client.fetchJson(
      routes.schedules.show.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'GET',
      },
    )
    assert.equal(showResponse.status, 200)
    let { schedule: initialSchedule } = await showResponse.json()
    assert.equal(initialSchedule.revision, 0)

    let replaceScheduleResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'regular schedule',
          baseRevision: initialSchedule.revision,
          blocks: [
            {
              id: 'read',
              name: 'read',
              color: 'blue',
              dayOfWeek: 0,
              startMinute: 390,
              endMinute: 450,
            },
            {
              id: 'workout',
              name: 'workout',
              color: 'green',
              dayOfWeek: 0,
              startMinute: 480,
              endMinute: 540,
            },
          ],
        },
      },
    )
    assert.equal(replaceScheduleResponse.status, 200)
    let { schedule: savedSchedule } = await replaceScheduleResponse.json()
    assert.equal(savedSchedule.revision, 1)
    assert.equal(savedSchedule.blocks.length, 2)

    let downloadResponse = await client.fetchPage(
      routes.schedules.downloadIcs.href({ scheduleId: String(createdSchedule.id) }),
    )
    assert.equal(downloadResponse.status, 200)
    assert.equal(downloadResponse.headers.get('Cache-Control'), 'no-store')
    assert.equal(
      downloadResponse.headers.get('Content-Disposition'),
      'attachment; filename="regular-schedule.ics"',
    )
    assert.equal(downloadResponse.headers.get('Content-Type'), 'text/calendar; charset=utf-8')

    let ics = await downloadResponse.text()
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
    assert.match(ics, /X-WR-CALNAME:regular schedule\r\n/)
    assert.match(ics, /SUMMARY:read\r\n/)
    assert.match(ics, /DTSTART:\d{8}T063000\r\n/)
    assert.match(ics, /DTEND:\d{8}T073000\r\n/)
    assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO\r\n/)
    assert.match(ics, /SUMMARY:workout\r\n/)
    assert.match(ics, /END:VCALENDAR\r\n$/)

    let [readBlock, workoutBlock] = savedSchedule.blocks

    let renameScheduleResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'regular schedule',
          baseRevision: savedSchedule.revision,
          blocks: [{ ...readBlock, name: 'reading' }, workoutBlock],
        },
      },
    )
    assert.equal(renameScheduleResponse.status, 200)
    let { schedule: renamedSchedule } = await renameScheduleResponse.json()
    assert.equal(renamedSchedule.revision, 2)
    assert.equal(renamedSchedule.blocks[0].name, 'reading')

    let staleRevisionResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'regular schedule',
          baseRevision: 0,
          blocks: savedSchedule.blocks,
        },
      },
    )
    assert.equal(staleRevisionResponse.status, 409)

    let overlappingScheduleResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'regular schedule',
          baseRevision: renamedSchedule.revision,
          blocks: [
            {
              ...renamedSchedule.blocks[0],
              dayOfWeek: 0,
              startMinute: 390,
              endMinute: 480,
            },
            {
              ...renamedSchedule.blocks[1],
              dayOfWeek: 0,
              startMinute: 450,
              endMinute: 540,
            },
          ],
        },
      },
    )
    assert.equal(overlappingScheduleResponse.status, 400)

    let persistedSchedule = await getSchedule(client, createdSchedule.id)
    assert.equal(persistedSchedule.revision, 2)
    assert.deepEqual(
      persistedSchedule.blocks.map((block: { endMinute: number; startMinute: number }) => [
        block.startMinute,
        block.endMinute,
      ]),
      [
        [390, 450],
        [480, 540],
      ],
    )
  })

  it('lists schedules by creation date with newest first', async () => {
    let client = await createAuthenticatedClient()

    let olderSchedule = await createScheduleAt(client, 'older schedule', 1000)
    let newerSchedule = await createScheduleAt(client, 'newer schedule', 2000)

    let updateOlderResponse = await withMockedNow(3000, () =>
      client.fetchJson(routes.schedules.update.href({ scheduleId: String(olderSchedule.id) }), {
        method: 'PUT',
        body: {
          name: olderSchedule.name,
          baseRevision: olderSchedule.revision,
          blocks: [],
        },
      }),
    )
    assert.equal(updateOlderResponse.status, 200)

    let listResponse = await client.fetchJson(routes.schedules.index.href(), {
      method: 'GET',
    })
    assert.equal(listResponse.status, 200)

    let listJson = await listResponse.json()
    assert.deepEqual(
      listJson.schedules.map((schedule: { name: string }) => schedule.name),
      ['newer schedule', 'older schedule'],
    )

    let rootResponse = await client.fetchPage(routes.home.index.href())
    assert.equal(rootResponse.status, 302)
    assert.equal(
      new URL(rootResponse.headers.get('Location')!, 'http://localhost').pathname,
      routes.schedules.show.href({ scheduleId: String(newerSchedule.id) }),
    )
  })

  it('deletes schedules', async () => {
    let client = await createAuthenticatedClient()

    let createScheduleResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: 'temporary schedule' },
    })
    assert.equal(createScheduleResponse.status, 201)
    let { schedule: createdSchedule } = await createScheduleResponse.json()

    let deleteScheduleResponse = await client.fetchJson(
      routes.schedules.destroy.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'DELETE',
      },
    )
    assert.equal(deleteScheduleResponse.status, 200)
    assert.deepEqual(await deleteScheduleResponse.json(), {
      deletedScheduleId: createdSchedule.id,
      nextScheduleHref: routes.home.index.href(),
    })

    let listResponse = await client.fetchJson(routes.schedules.index.href(), {
      method: 'GET',
    })
    assert.equal(listResponse.status, 200)
    assert.deepEqual(await listResponse.json(), { schedules: [] })

    let deletedScheduleResponse = await client.fetchJson(
      routes.schedules.show.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'GET',
      },
    )
    assert.equal(deletedScheduleResponse.status, 404)

    let deletedScheduleRow = await db.findOne(schedules, {
      where: { id: createdSchedule.id },
    })
    assert.ok(deletedScheduleRow)
    assert.equal(deletedScheduleRow.status, 'deleted')
  })

  it('treats duplicated block names as independent events', async () => {
    let client = await createAuthenticatedClient()

    let createScheduleResponse = await client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name: 'multi-day schedule' },
    })
    assert.equal(createScheduleResponse.status, 201)
    let { schedule: createdSchedule } = await createScheduleResponse.json()

    let replaceScheduleResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'multi-day schedule',
          baseRevision: createdSchedule.revision,
          blocks: [
            {
              id: 'breakfast-monday',
              name: 'breakfast',
              color: null,
              dayOfWeek: 0,
              startMinute: 480,
              endMinute: 540,
            },
            {
              id: 'breakfast-tuesday',
              name: 'breakfast',
              color: null,
              dayOfWeek: 1,
              startMinute: 480,
              endMinute: 540,
            },
          ],
        },
      },
    )
    assert.equal(replaceScheduleResponse.status, 200)

    let { schedule: savedSchedule } = await replaceScheduleResponse.json()
    assert.deepEqual(
      savedSchedule.blocks.map((block: { dayOfWeek: number; id: string; name: string }) => [
        block.id,
        block.name,
        block.dayOfWeek,
      ]),
      [
        ['breakfast-monday', 'breakfast', 0],
        ['breakfast-tuesday', 'breakfast', 1],
      ],
    )

    let [mondayBreakfast, tuesdayBreakfast] = savedSchedule.blocks
    let renameOneDuplicateResponse = await client.fetchJson(
      routes.schedules.update.href({ scheduleId: String(createdSchedule.id) }),
      {
        method: 'PUT',
        body: {
          name: 'multi-day schedule',
          baseRevision: savedSchedule.revision,
          blocks: [{ ...mondayBreakfast, name: 'early breakfast' }, tuesdayBreakfast],
        },
      },
    )
    assert.equal(renameOneDuplicateResponse.status, 200)

    let { schedule: renamedSchedule } = await renameOneDuplicateResponse.json()
    assert.deepEqual(
      renamedSchedule.blocks.map((block: { dayOfWeek: number; id: string; name: string }) => [
        block.id,
        block.name,
        block.dayOfWeek,
      ]),
      [
        ['breakfast-monday', 'early breakfast', 0],
        ['breakfast-tuesday', 'breakfast', 1],
      ],
    )
  })
})

async function createAnonymousClient() {
  let cookie = ''
  let signupResponse = await router.fetch(new Request(url(routes.auth.signup.index.href())))
  cookie = mergeCookie(cookie, signupResponse.headers)
  let csrfToken = extractCsrfToken(await signupResponse.text())

  return {
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

async function createAuthenticatedClient() {
  let cookie = ''
  let signupResponse = await router.fetch(new Request(url(routes.auth.signup.index.href())))
  cookie = mergeCookie(cookie, signupResponse.headers)
  let csrfToken = extractCsrfToken(await signupResponse.text())

  let formData = new FormData()
  formData.set('username', `user-${process.pid}-${Date.now()}`)
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

async function getSchedule(
  client: Awaited<ReturnType<typeof createAuthenticatedClient>>,
  scheduleId: number,
) {
  let response = await client.fetchJson(
    routes.schedules.show.href({ scheduleId: String(scheduleId) }),
    {
      method: 'GET',
    },
  )
  assert.equal(response.status, 200)
  let json = await response.json()
  return json.schedule
}

async function createScheduleAt(
  client: Awaited<ReturnType<typeof createAuthenticatedClient>>,
  name: string,
  timestamp: number,
) {
  let response = await withMockedNow(timestamp, () =>
    client.fetchJson(routes.schedules.create.href(), {
      method: 'POST',
      body: { name },
    }),
  )
  assert.equal(response.status, 201)

  let { schedule } = await response.json()
  return schedule
}

async function withMockedNow<T>(timestamp: number, callback: () => Promise<T>): Promise<T> {
  let originalNow = Date.now
  Date.now = () => timestamp

  try {
    return await callback()
  } finally {
    Date.now = originalNow
  }
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


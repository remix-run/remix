import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { describe, it } from 'remix/test'

import {
  createSchedule,
  deleteSchedule,
  getScheduleDocument,
  listSchedules,
  replaceScheduleDocument,
  type ScheduleBlockInput,
} from './schedules.ts'
import { db, getMigrations, seed } from '../db.ts'
import { scheduleBlocks, schedules, users } from './schema.ts'

describe('schedule persistence lifecycle', () => {
  it('excludes soft-deleted schedules from list, get, and export lookup paths', async () => {
    await withTestDatabase(async (db) => {
      let user = await createUser(db)
      let schedule = await createSchedule(db, user.id, 'temporary schedule')

      await replaceScheduleDocument(db, user.id, schedule.id, {
        name: schedule.name,
        baseRevision: schedule.revision,
        blocks: [block('read', 0, 540, 600)],
      })
      await deleteSchedule(db, user.id, schedule.id)

      assert.deepEqual(await listSchedules(db, user.id), [])
      await assert.rejects(() => getScheduleDocument(db, user.id, schedule.id), {
        message: 'Schedule not found.',
        status: 404,
      })

      let deletedScheduleRow = await db.find(schedules, schedule.id)
      assert.ok(deletedScheduleRow)
      assert.equal(deletedScheduleRow.status, 'deleted')
      assert.equal(deletedScheduleRow.revision, 2)
    })
  })

  it('keeps deleted schedule names reserved for the same user', async () => {
    await withTestDatabase(async (db) => {
      let user = await createUser(db)
      let otherUser = await createUser(db, 'other-user')
      let schedule = await createSchedule(db, user.id, 'morning routine')

      await deleteSchedule(db, user.id, schedule.id)

      await assert.rejects(() => createSchedule(db, user.id, schedule.name), {
        message: 'Name must be unique.',
        status: 409,
      })

      let reusedByOtherUser = await createSchedule(db, otherUser.id, schedule.name)
      assert.equal(reusedByOtherUser.name, schedule.name)
    })
  })

  it('cascades schedules and blocks when deleting a user', async () => {
    await withTestDatabase(async (db) => {
      let user = await createUser(db)
      let schedule = await createSchedule(db, user.id, 'weekday routine')
      await replaceScheduleDocument(db, user.id, schedule.id, {
        name: schedule.name,
        baseRevision: schedule.revision,
        blocks: [block('breakfast', 0, 480, 510), block('commute', 0, 510, 540)],
      })

      await db.delete(users, user.id)

      assert.deepEqual(await db.findMany(schedules), [])
      assert.deepEqual(await db.findMany(scheduleBlocks), [])
    })
  })

  it('replaces schedule blocks by client id and deletes omitted blocks', async () => {
    await withTestDatabase(async (db) => {
      let user = await createUser(db)
      let schedule = await createScheduleAt(db, user.id, 'weekday routine', 1000)

      let firstSave = await withMockedNow(2000, () =>
        replaceScheduleDocument(db, user.id, schedule.id, {
          name: schedule.name,
          baseRevision: schedule.revision,
          blocks: [block('focus', 0, 540, 600), block('admin', 0, 600, 630)],
        }),
      )

      let initialRows = await listBlockRows(db, schedule.id)
      let initialAdminBlock = initialRows.find((row) => row.client_id === 'admin')
      let initialFocusBlock = initialRows.find((row) => row.client_id === 'focus')
      assert.ok(initialAdminBlock)
      assert.ok(initialFocusBlock)

      let secondSave = await withMockedNow(3000, () =>
        replaceScheduleDocument(db, user.id, schedule.id, {
          name: 'updated routine',
          baseRevision: firstSave.revision,
          blocks: [
            {
              id: 'focus',
              name: 'deep focus',
              color: 'blue',
              dayOfWeek: 1,
              startMinute: 570,
              endMinute: 660,
            },
          ],
        }),
      )

      assert.equal(secondSave.name, 'updated routine')
      assert.equal(secondSave.revision, 2)
      assert.deepEqual(secondSave.blocks, [
        {
          id: 'focus',
          name: 'deep focus',
          color: 'blue',
          dayOfWeek: 1,
          startMinute: 570,
          endMinute: 660,
        },
      ])

      let finalRows = await listBlockRows(db, schedule.id)
      assert.equal(finalRows.length, 1)

      let finalFocusBlock = finalRows[0]!
      assert.equal(finalFocusBlock.id, initialFocusBlock.id)
      assert.equal(finalFocusBlock.client_id, 'focus')
      assert.equal(finalFocusBlock.name, 'deep focus')
      assert.equal(finalFocusBlock.day_of_week, 1)
      assert.equal(finalFocusBlock.start_minute, 570)
      assert.equal(finalFocusBlock.end_minute, 660)
      assert.equal(finalFocusBlock.created_at, initialFocusBlock.created_at)
      assert.equal(finalFocusBlock.updated_at, 3000)

      assert.equal(await db.find(scheduleBlocks, initialAdminBlock.id), null)
    })
  })
})

async function withTestDatabase<T>(callback: (db: Database) => Promise<T>): Promise<T> {
  await db.reset({ migrations: await getMigrations(), seed })
  return await callback(db)
}

async function createUser(db: Database, username = 'test-user') {
  return await db.create(
    users,
    {
      username,
      created_at: Date.now(),
    },
    { returnRow: true },
  )
}

async function createScheduleAt(db: Database, userId: number, name: string, timestamp: number) {
  return await withMockedNow(timestamp, () => createSchedule(db, userId, name))
}

async function listBlockRows(db: Database, scheduleId: number) {
  return await db.findMany(scheduleBlocks, {
    where: { schedule_id: scheduleId },
    orderBy: [['client_id', 'asc']],
  })
}

function block(
  id: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
): ScheduleBlockInput {
  return {
    id,
    name: id,
    color: null,
    dayOfWeek,
    startMinute,
    endMinute,
  }
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

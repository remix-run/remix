import { Database } from 'remix/data-table'

import {
  scheduleBlocks,
  schedules,
  type Schedule,
  type ScheduleBlock,
} from './schema.ts'

export type ScheduleInputId = string

export interface ScheduleBlockDocument {
  color: string | null
  dayOfWeek: number
  endMinute: number
  id: string
  name: string
  startMinute: number
}

export interface ScheduleDocument {
  blocks: ScheduleBlockDocument[]
  id: number
  name: string
  revision: number
  updatedAt: number
}

export interface ScheduleBlockInput {
  color?: string | null
  dayOfWeek: number
  endMinute: number
  id: string
  name: string
  startMinute: number
}

export interface ScheduleReplaceInput {
  baseRevision: number
  blocks: ScheduleBlockInput[]
  name: string
}

export class ScheduleDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const activeScheduleStatus = 'active'
const deletedScheduleStatus = 'deleted'

export async function listSchedules(db: Database, userId: number): Promise<Schedule[]> {
  return await db.findMany(schedules, {
    where: { user_id: userId, status: activeScheduleStatus },
    orderBy: [
      ['created_at', 'desc'],
      ['id', 'desc'],
    ],
  })
}

export async function createSchedule(
  db: Database,
  userId: number,
  name: string,
): Promise<ScheduleDocument> {
  let existingSchedule = await db.findOne(schedules, {
    where: { user_id: userId, name },
  })
  if (existingSchedule) {
    throw new ScheduleDataError('Name must be unique.', 409)
  }

  let now = Date.now()

  let schedule = await db.create(
    schedules,
    {
      user_id: userId,
      name,
      revision: 0,
      status: activeScheduleStatus,
      created_at: now,
      updated_at: now,
    },
    { returnRow: true },
  )

  return toScheduleDocument(schedule, [])
}

export async function getScheduleDocument(
  db: Database,
  userId: number,
  scheduleId: number,
): Promise<ScheduleDocument> {
  let schedule = await requireScheduleForUser(db, userId, scheduleId)
  let blocks = await listScheduleBlocks(db, scheduleId)

  return toScheduleDocument(schedule, blocks)
}

export async function deleteSchedule(
  db: Database,
  userId: number,
  scheduleId: number,
): Promise<void> {
  let schedule = await requireScheduleForUser(db, userId, scheduleId)
  await db.update(schedules, schedule.id, {
    revision: schedule.revision + 1,
    status: deletedScheduleStatus,
    updated_at: Date.now(),
  })
}

export async function replaceScheduleDocument(
  db: Database,
  userId: number,
  scheduleId: number,
  input: ScheduleReplaceInput,
): Promise<ScheduleDocument> {
  let schedule = await requireScheduleForUser(db, userId, scheduleId)

  if (input.baseRevision !== schedule.revision) {
    throw new ScheduleDataError('Schedule is out of date.', 409)
  }

  assertNoOverlaps(input.blocks)

  let now = Date.now()

  return await db.transaction(async (tx) => {
    let updatedSchedule = await tx.update(schedules, scheduleId, {
      name: input.name,
      revision: schedule.revision + 1,
      updated_at: now,
    })

    await syncScheduledBlocks(tx, scheduleId, input.blocks, now)

    let syncedBlocks = await listScheduleBlocks(tx, scheduleId)
    return toScheduleDocument(updatedSchedule, syncedBlocks)
  })
}

async function listScheduleBlocks(
  db: Database,
  scheduleId: number,
): Promise<ScheduleBlock[]> {
  return await db.findMany(scheduleBlocks, {
    where: { schedule_id: scheduleId },
    orderBy: [
      ['day_of_week', 'asc'],
      ['start_minute', 'asc'],
    ],
  })
}

async function requireScheduleForUser(
  db: Database,
  userId: number,
  scheduleId: number,
): Promise<Schedule> {
  let schedule = await db.findOne(schedules, {
    where: {
      id: scheduleId,
      status: activeScheduleStatus,
      user_id: userId,
    },
  })

  if (!schedule) {
    throw new ScheduleDataError('Schedule not found.', 404)
  }

  return schedule
}

async function syncScheduledBlocks(
  db: Database,
  scheduleId: number,
  blocks: ScheduleBlockInput[],
  now: number,
) {
  let existingBlockRows = await listScheduleBlocks(db, scheduleId)
  let existingBlockRowsByClientId = new Map(
    existingBlockRows.map((block) => [block.client_id, block]),
  )
  let seenInputIds = new Set<string>()
  let keptBlockRowIds = new Set<number>()

  for (let block of blocks) {
    if (seenInputIds.has(block.id)) {
      throw new ScheduleDataError('Scheduled block ids must be unique.', 400)
    }
    seenInputIds.add(block.id)

    let blockRow = existingBlockRowsByClientId.get(block.id)
    if (blockRow) {
      blockRow = await db.update(scheduleBlocks, blockRow.id, {
        name: block.name,
        color: block.color ?? null,
        day_of_week: block.dayOfWeek,
        start_minute: block.startMinute,
        end_minute: block.endMinute,
        updated_at: now,
      })
    } else {
      blockRow = await db.create(
        scheduleBlocks,
        {
          schedule_id: scheduleId,
          client_id: block.id,
          name: block.name,
          color: block.color ?? null,
          day_of_week: block.dayOfWeek,
          start_minute: block.startMinute,
          end_minute: block.endMinute,
          created_at: now,
          updated_at: now,
        },
        { returnRow: true },
      )
    }

    keptBlockRowIds.add(blockRow.id)
  }

  for (let existingBlockRow of existingBlockRows) {
    if (!keptBlockRowIds.has(existingBlockRow.id)) {
      await db.delete(scheduleBlocks, existingBlockRow.id)
    }
  }
}

function toScheduleDocument(
  schedule: Schedule,
  blockRows: ScheduleBlock[],
): ScheduleDocument {
  return {
    id: schedule.id,
    name: schedule.name,
    revision: schedule.revision,
    updatedAt: schedule.updated_at,
    blocks: blockRows.map((block) => ({
      color: block.color ?? null,
      dayOfWeek: block.day_of_week,
      endMinute: block.end_minute,
      id: block.client_id,
      name: block.name,
      startMinute: block.start_minute,
    })),
  }
}

function assertNoOverlaps(blocks: ScheduleBlockInput[]) {
  let blocksByDay = new Map<number, ScheduleBlockInput[]>()

  for (let block of blocks) {
    if (
      !Number.isInteger(block.dayOfWeek) ||
      block.dayOfWeek < 0 ||
      block.dayOfWeek > 6 ||
      !Number.isInteger(block.startMinute) ||
      !Number.isInteger(block.endMinute) ||
      block.startMinute < 0 ||
      block.endMinute > 1440 ||
      block.startMinute >= block.endMinute
    ) {
      throw new ScheduleDataError(
        'Scheduled blocks must have valid dayOfWeek, startMinute, and endMinute values.',
        400,
      )
    }

    let dayBlocks = blocksByDay.get(block.dayOfWeek) ?? []
    dayBlocks.push(block)
    blocksByDay.set(block.dayOfWeek, dayBlocks)
  }

  for (let dayBlocks of blocksByDay.values()) {
    let sortedBlocks = [...dayBlocks].sort((left, right) => left.startMinute - right.startMinute)

    for (let index = 0; index < sortedBlocks.length - 1; index++) {
      let current = sortedBlocks[index]!
      let next = sortedBlocks[index + 1]!

      if (current.endMinute > next.startMinute) {
        throw new ScheduleDataError('Scheduled blocks cannot overlap.', 400)
      }
    }
  }
}


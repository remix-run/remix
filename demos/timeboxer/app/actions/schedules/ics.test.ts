import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { ScheduleDocument } from '../../data/schedules.ts'
import { createScheduleIcs } from './ics.ts'

const fixedNow = new Date(Date.UTC(2026, 0, 8, 12, 34, 56))

describe('createScheduleIcs', () => {
  it('escapes text values for calendar and event fields', () => {
    let ics = createScheduleIcs(
      schedule({
        name: 'Planning, review; C\\D\nNext\r\nAgain\rDone',
        blocks: [
          block({
            name: 'Focus, plan; ship\\code\nNext',
          }),
        ],
      }),
      fixedNow,
    )

    assertIcsIncludes(ics, 'X-WR-CALNAME:Planning\\, review\\; C\\\\D\\nNext\\nAgain\\nDone\r\n')
    assertIcsIncludes(ics, 'SUMMARY:Focus\\, plan\\; ship\\\\code\\nNext\r\n')
  })

  it('folds long lines', () => {
    let longName = 'A'.repeat(100)
    let ics = createScheduleIcs(
      schedule({
        blocks: [
          block({
            name: longName,
          }),
        ],
      }),
      fixedNow,
    )
    let lines = ics.split('\r\n')

    assert.ok(lines.includes(`SUMMARY:${'A'.repeat(67)}`))
    assert.ok(lines.includes(` ${'A'.repeat(33)}`))

    for (let line of lines) {
      if (line) {
        assert.ok(line.length <= 75)
      }
    }
  })

  it('maps every weekday to the matching BYDAY code', () => {
    let ics = createScheduleIcs(
      schedule({
        blocks: [
          block({ id: 'monday', name: 'Monday', dayOfWeek: 0 }),
          block({ id: 'tuesday', name: 'Tuesday', dayOfWeek: 1 }),
          block({ id: 'wednesday', name: 'Wednesday', dayOfWeek: 2 }),
          block({ id: 'thursday', name: 'Thursday', dayOfWeek: 3 }),
          block({ id: 'friday', name: 'Friday', dayOfWeek: 4 }),
          block({ id: 'saturday', name: 'Saturday', dayOfWeek: 5 }),
          block({ id: 'sunday', name: 'Sunday', dayOfWeek: 6 }),
        ],
      }),
      fixedNow,
    )

    assertIcsIncludes(ics, eventFields('Monday', '20260105T090000', '20260105T100000', 'MO'))
    assertIcsIncludes(ics, eventFields('Tuesday', '20260106T090000', '20260106T100000', 'TU'))
    assertIcsIncludes(ics, eventFields('Wednesday', '20260107T090000', '20260107T100000', 'WE'))
    assertIcsIncludes(ics, eventFields('Thursday', '20260108T090000', '20260108T100000', 'TH'))
    assertIcsIncludes(ics, eventFields('Friday', '20260109T090000', '20260109T100000', 'FR'))
    assertIcsIncludes(ics, eventFields('Saturday', '20260110T090000', '20260110T100000', 'SA'))
    assertIcsIncludes(ics, eventFields('Sunday', '20260111T090000', '20260111T100000', 'SU'))
  })

  it('renders an empty schedule as a calendar without events', () => {
    let ics = createScheduleIcs(
      schedule({
        name: 'Empty schedule',
        blocks: [],
      }),
      fixedNow,
    )

    assert.equal(
      ics,
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Timeboxer//Schedule Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Empty schedule',
        'END:VCALENDAR',
      ].join('\r\n') + '\r\n',
    )
  })

  it('uses injected time for deterministic timestamps and event dates', () => {
    let ics = createScheduleIcs(
      schedule({
        blocks: [
          block({
            dayOfWeek: 2,
            startMinute: 9 * 60 + 5,
            endMinute: 10 * 60 + 15,
          }),
        ],
      }),
      fixedNow,
    )

    assertIcsIncludes(ics, 'DTSTAMP:20260108T123456Z\r\n')
    assertIcsIncludes(ics, 'DTSTART:20260107T090500\r\n')
    assertIcsIncludes(ics, 'DTEND:20260107T101500\r\n')
  })

  it('creates independent events for duplicate block names', () => {
    let ics = createScheduleIcs(
      schedule({
        id: 99,
        blocks: [
          block({ id: 'deep-work-a', name: 'Deep work', startMinute: 9 * 60 }),
          block({ id: 'deep-work-b', name: 'Deep work', startMinute: 11 * 60 }),
        ],
      }),
      fixedNow,
    )

    assert.equal(countOccurrences(ics, 'BEGIN:VEVENT\r\n'), 2)
    assert.equal(countOccurrences(ics, 'SUMMARY:Deep work\r\n'), 2)
    assertIcsIncludes(ics, 'UID:99-deep-work-a@timeboxer\r\n')
    assertIcsIncludes(ics, 'UID:99-deep-work-b@timeboxer\r\n')
  })
})

function assertIcsIncludes(ics: string, expected: string) {
  assert.ok(ics.includes(expected), `Expected ICS to include:\n${expected}`)
}

function eventFields(summary: string, start: string, end: string, day: string) {
  return (
    [
      `SUMMARY:${summary}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${day}`,
    ].join('\r\n') + '\r\n'
  )
}

function schedule(overrides: Partial<ScheduleDocument> = {}): ScheduleDocument {
  return {
    blocks: [],
    id: 42,
    name: 'Weekly schedule',
    revision: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function block(
  overrides: Partial<ScheduleDocument['blocks'][number]> = {},
): ScheduleDocument['blocks'][number] {
  return {
    color: null,
    dayOfWeek: 0,
    endMinute: 10 * 60,
    id: 'focus',
    name: 'Focus',
    startMinute: 9 * 60,
    ...overrides,
  }
}

function countOccurrences(value: string, search: string) {
  let count = 0
  let index = value.indexOf(search)

  while (index !== -1) {
    count++
    index = value.indexOf(search, index + search.length)
  }

  return count
}

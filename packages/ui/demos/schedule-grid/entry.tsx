import { createRoot, type Handle } from 'remix/ui'
import { RMX_01 } from 'remix/ui/theme'

import { ScheduleGrid, type GridBlockDocument, type GridScheduleDocument } from './schedule-grid.tsx'

const storageKey = 'remix-ui-schedule-grid-demo'

const initialSchedule: GridScheduleDocument = {
  id: 1,
  name: 'Demo Schedule',
  blocks: [
    {
      id: 'block-mon-standup',
      color: null,
      dayOfWeek: 0,
      startMinute: 540,
      endMinute: 600,
      name: 'Standup',
    },
    {
      id: 'block-mon-focus',
      color: null,
      dayOfWeek: 0,
      startMinute: 600,
      endMinute: 720,
      name: 'Focus work',
    },
    {
      id: 'block-mon-lunch',
      color: null,
      dayOfWeek: 0,
      startMinute: 720,
      endMinute: 780,
      name: 'Lunch',
    },
    {
      id: 'block-tue-design',
      color: null,
      dayOfWeek: 1,
      startMinute: 570,
      endMinute: 690,
      name: 'Design review',
    },
    {
      id: 'block-tue-lunch',
      color: null,
      dayOfWeek: 1,
      startMinute: 720,
      endMinute: 780,
      name: 'Lunch',
    },
    {
      id: 'block-wed-pair',
      color: null,
      dayOfWeek: 2,
      startMinute: 540,
      endMinute: 660,
      name: 'Pairing',
    },
    {
      id: 'block-wed-lunch',
      color: null,
      dayOfWeek: 2,
      startMinute: 720,
      endMinute: 780,
      name: 'Lunch',
    },
    {
      id: 'block-thu-deep',
      color: null,
      dayOfWeek: 3,
      startMinute: 540,
      endMinute: 720,
      name: 'Deep work',
    },
    {
      id: 'block-thu-review',
      color: null,
      dayOfWeek: 3,
      startMinute: 840,
      endMinute: 900,
      name: 'Code review',
    },
    {
      id: 'block-fri-demo',
      color: null,
      dayOfWeek: 4,
      startMinute: 600,
      endMinute: 660,
      name: 'Demo',
    },
    {
      id: 'block-fri-retro',
      color: null,
      dayOfWeek: 4,
      startMinute: 900,
      endMinute: 960,
      name: 'Retro',
    },
  ],
}

function App(_handle: Handle) {
  let schedule = loadSchedule()

  return () => (
    <>
      <RMX_01.Style />
      <ScheduleGrid onScheduleChange={saveSchedule} schedule={schedule} />
    </>
  )
}

createRoot(document.body).render(<App />)

function saveSchedule(schedule: GridScheduleDocument) {
  localStorage.setItem(storageKey, JSON.stringify(schedule))
}

function loadSchedule(): GridScheduleDocument {
  let stored = localStorage.getItem(storageKey)
  if (!stored) return copySchedule(initialSchedule)

  try {
    let parsed: unknown = JSON.parse(stored)
    if (isGridScheduleDocument(parsed)) {
      return copySchedule(parsed)
    }
  } catch {}

  return copySchedule(initialSchedule)
}

function copySchedule(schedule: GridScheduleDocument): GridScheduleDocument {
  return {
    ...schedule,
    blocks: schedule.blocks.map((block) => ({ ...block })),
  }
}

function isGridScheduleDocument(value: unknown): value is GridScheduleDocument {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'number' &&
    Number.isInteger(value.id) &&
    typeof value.name === 'string' &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isGridBlockDocument)
  )
}

function isGridBlockDocument(value: unknown): value is GridBlockDocument {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.color === null || typeof value.color === 'string') &&
    typeof value.dayOfWeek === 'number' &&
    Number.isInteger(value.dayOfWeek) &&
    typeof value.startMinute === 'number' &&
    Number.isInteger(value.startMinute) &&
    typeof value.endMinute === 'number' &&
    Number.isInteger(value.endMinute)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

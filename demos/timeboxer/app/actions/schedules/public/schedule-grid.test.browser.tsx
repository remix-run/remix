import { deepEqual, equal, ok } from 'remix/assert'
import { describe as suite, it as test } from 'remix/test'
import { render as renderComponent } from 'remix/component/test'

import { ScheduleGrid } from './schedule-grid.tsx'
import type { GridScheduleDocument } from './schedule-grid.tsx'

type ScheduleBlockDocument = GridScheduleDocument['blocks'][number]

type SavePayload = {
  baseRevision: number
  blocks: ScheduleBlockDocument[]
  name: string
}

type SaveCall = {
  body: SavePayload
  headers: Headers
  method: string | undefined
  url: string
}

type SaveRecorder = SaveCall[] & {
  next: () => Promise<SaveCall>
}

suite('ScheduleGrid', () => {
  test('renders a weekly grid with time cells and scheduled blocks', (t) => {
    let { cleanup, container } = renderScheduleGrid()
    t.after(cleanup)

    ok(container.textContent?.includes('Family Week'))
    for (let day of [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]) {
      ok(container.textContent?.includes(day))
    }

    ok(getByLabel(container, 'Monday 9:00am'))
    ok(getByLabel(container, 'Sunday 11:45pm'))
    equal(getByLabel(container, 'Morning focus').dataset.scheduleBlock, 'true')
  })

  test('starts a focused draft when an empty time cell is clicked', async (t) => {
    let { act, cleanup, container } = renderScheduleGrid(scheduleDocument([]))
    t.after(cleanup)

    await act(() => getByLabel(container, 'Tuesday 9:00am').click())

    let input = getInputByLabel(container, 'New block name')
    equal(document.activeElement, input)
    equal(input.readOnly, false)
    equal(input.value, '')
    equal(container.querySelectorAll('[data-schedule-block="true"]').length, 1)
  })

  test('cancels a draft with Escape', async (t) => {
    let { act, cleanup, container } = renderScheduleGrid(scheduleDocument([]))
    t.after(cleanup)

    await act(() => getByLabel(container, 'Tuesday 9:00am').click())
    await act(() => {
      getInputByLabel(container, 'New block name').dispatchEvent(keydown('Escape'))
    })

    equal(queryByLabel(container, 'New block name'), null)
    equal(container.querySelectorAll('[data-schedule-block="true"]').length, 0)
  })

  test('commits a named draft with Enter and saves the schedule', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid(scheduleDocument([]))
    t.after(cleanup)

    await act(() => getByLabel(container, 'Wednesday 10:00am').click())
    await act(async () => {
      let input = getInputByLabel(container, 'New block name')
      input.value = 'Deep work'
      input.dispatchEvent(inputEvent())
      input.dispatchEvent(keydown('Enter'))
      await saves.next()
    })

    equal(saves.length, 1)
    equal(saves[0]!.url, '/schedules/7')
    equal(saves[0]!.method, 'PUT')
    equal(saves[0]!.headers.get('X-Csrf-Token'), 'csrf-token')
    deepEqual(blockSummaries(saves[0]!.body.blocks), [
      {
        dayOfWeek: 2,
        endMinute: 615,
        name: 'Deep work',
        startMinute: 600,
      },
    ])
    equal(document.activeElement, getByLabel(container, 'Deep work'))
  })

  test('deletes the selected block with the Delete key and saves the schedule', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid()
    t.after(cleanup)

    await act(() => getByLabel(container, 'Morning focus').click())
    equal(getByLabel(container, 'Morning focus').dataset.selected, 'true')

    await act(async () => {
      getByLabel(container, 'Morning focus').dispatchEvent(keydown('Delete'))
      await saves.next()
    })

    equal(queryByLabel(container, 'Morning focus'), null)
    ok(getByLabel(container, 'Lunch'))
    equal(saves.length, 1)
    deepEqual(
      saves[0]!.body.blocks.map((block) => block.id),
      ['lunch'],
    )
  })

  test('renames an existing block on blur and saves the schedule', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid()
    t.after(cleanup)

    await act(() => {
      getByLabel(container, 'Morning focus').dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true }),
      )
    })

    let input = getInputByLabel(container, 'Morning focus name')
    equal(document.activeElement, input)
    equal(input.readOnly, false)

    await act(async () => {
      input.value = 'Planning'
      input.dispatchEvent(inputEvent())
      input.blur()
      await saves.next()
    })

    equal(queryByLabel(container, 'Morning focus'), null)
    ok(getByLabel(container, 'Planning'))
    equal(saves.length, 1)
    deepEqual(blockSummaries(saves[0]!.body.blocks), [
      {
        dayOfWeek: 0,
        endMinute: 570,
        name: 'Planning',
        startMinute: 540,
      },
      {
        dayOfWeek: 0,
        endMinute: 750,
        name: 'Lunch',
        startMinute: 720,
      },
    ])
  })

  test('drags a block to another day and time and saves the schedule', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid()
    t.after(cleanup)

    let delta = cellDelta(container, 'Monday 9:00am', 'Tuesday 10:00am')
    await act(async () => {
      await dragPointer(getByLabel(container, 'Morning focus'), delta)
      await saves.next()
    })

    deepEqual(blockSummaries(saves[0]!.body.blocks), [
      { dayOfWeek: 0, endMinute: 750, name: 'Lunch', startMinute: 720 },
      { dayOfWeek: 1, endMinute: 630, name: 'Morning focus', startMinute: 600 },
    ])
  })

  test('resizes a block end time and saves the schedule', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid()
    t.after(cleanup)

    let delta = cellDelta(container, 'Monday 9:00am', 'Monday 9:30am')
    await act(async () => {
      await dragPointer(
        getByLabel(getByLabel(container, 'Morning focus'), 'End resize handle'),
        delta,
      )
      await saves.next()
    })

    deepEqual(blockSummaries(saves[0]!.body.blocks), [
      { dayOfWeek: 0, endMinute: 600, name: 'Morning focus', startMinute: 540 },
      { dayOfWeek: 0, endMinute: 750, name: 'Lunch', startMinute: 720 },
    ])
  })

  test('copies a block across days with the last day resize handle', async (t) => {
    let saves = captureScheduleSaves(t)
    let { act, cleanup, container } = renderScheduleGrid(
      scheduleDocument([block('morning-focus', 'Morning focus', 0, 540, 570)]),
    )
    t.after(cleanup)

    let delta = cellDelta(container, 'Monday 9:00am', 'Wednesday 9:00am')
    await act(async () => {
      await dragPointer(
        getByLabel(getByLabel(container, 'Morning focus'), 'Last day resize handle'),
        delta,
      )
      await saves.next()
    })

    deepEqual(
      blockSummaries(saves[0]!.body.blocks).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      [
        { dayOfWeek: 0, endMinute: 570, name: 'Morning focus', startMinute: 540 },
        { dayOfWeek: 1, endMinute: 570, name: 'Morning focus', startMinute: 540 },
        { dayOfWeek: 2, endMinute: 570, name: 'Morning focus', startMinute: 540 },
      ],
    )
  })
})

function cellDelta(container: HTMLElement, fromLabel: string, toLabel: string) {
  let from = getByLabel(container, fromLabel).getBoundingClientRect()
  let to = getByLabel(container, toLabel).getBoundingClientRect()
  return { x: to.left - from.left, y: to.top - from.top }
}

async function dragPointer(target: HTMLElement, delta: { x: number; y: number }) {
  let rect = target.getBoundingClientRect()
  let start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  let end = { x: start.x + delta.x, y: start.y + delta.y }

  target.dispatchEvent(pointerEvent('pointerdown', start))
  await Promise.resolve()
  window.dispatchEvent(pointerEvent('pointermove', end))
  await Promise.resolve()
  window.dispatchEvent(pointerEvent('pointerup', end))
}

function pointerEvent(type: string, point: { x: number; y: number }) {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    pointerId: 1,
  })
}

function renderScheduleGrid(schedule = scheduleDocument()) {
  return renderComponent(
    <ScheduleGrid csrfToken="csrf-token" downloadIcsHref="/schedules/7.ics" schedule={schedule} />,
  )
}

function captureScheduleSaves(t: { after(cleanup: () => void): void }): SaveRecorder {
  let originalFetch = globalThis.fetch
  let calls: SaveCall[] = []
  let nextCallIndex = 0
  let pendingNextCalls: Array<(call: SaveCall) => void> = []

  let recorder = Object.assign(calls, {
    next() {
      if (nextCallIndex < calls.length) {
        return Promise.resolve(calls[nextCallIndex++]!)
      }

      return new Promise<SaveCall>((resolve) => {
        pendingNextCalls.push((call) => {
          nextCallIndex++
          resolve(call)
        })
      })
    },
  })

  globalThis.fetch = (async (input, init) => {
    let body = parseSaveBody(init?.body)
    let call = {
      body,
      headers: new Headers(init?.headers),
      method: init?.method,
      url: String(input),
    }
    calls.push(call)
    pendingNextCalls.shift()?.(call)

    let scheduleId = Number(new URL(String(input), window.location.href).pathname.split('/').pop())
    return new Response(
      JSON.stringify({
        schedule: {
          blocks: body.blocks,
          id: scheduleId,
          name: body.name,
          revision: body.baseRevision + 1,
          updatedAt: Date.now(),
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    )
  }) as typeof fetch

  t.after(() => {
    globalThis.fetch = originalFetch
  })

  return recorder
}

function scheduleDocument(blocks = defaultBlocks()): GridScheduleDocument {
  return {
    blocks: blocks.map((block) => ({ ...block })),
    id: 7,
    name: 'Family Week',
    revision: 3,
    updatedAt: 1000,
  }
}

function defaultBlocks() {
  return [
    block('morning-focus', 'Morning focus', 0, 540, 570),
    block('lunch', 'Lunch', 0, 720, 750),
  ]
}

function block(
  id: string,
  name: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
): ScheduleBlockDocument {
  return {
    color: null,
    dayOfWeek,
    endMinute,
    id,
    name,
    startMinute,
  }
}

function getByLabel(container: HTMLElement, label: string) {
  let element = queryByLabel(container, label)
  ok(element, `Expected an element labelled "${label}"`)
  return element
}

function queryByLabel(container: HTMLElement, label: string) {
  for (let element of container.querySelectorAll<HTMLElement>('[aria-label]')) {
    if (element.getAttribute('aria-label') === label) return element
  }

  return null
}

function getInputByLabel(container: HTMLElement, label: string) {
  let element = getByLabel(container, label)
  ok(element instanceof HTMLInputElement, `Expected "${label}" to label an input`)
  return element
}

function inputEvent() {
  return new Event('input', { bubbles: true })
}

function keydown(key: string) {
  return new KeyboardEvent('keydown', { bubbles: true, key })
}

function parseSaveBody(body: BodyInit | null | undefined): SavePayload {
  if (typeof body !== 'string') {
    throw new Error('Expected schedule save body to be a JSON string.')
  }

  return JSON.parse(body) as SavePayload
}

function blockSummaries(blocks: ScheduleBlockDocument[]) {
  return blocks.map((block) => ({
    dayOfWeek: block.dayOfWeek,
    endMinute: block.endMinute,
    name: block.name,
    startMinute: block.startMinute,
  }))
}

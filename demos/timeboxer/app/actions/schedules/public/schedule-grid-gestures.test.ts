import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  adjacentSelection,
  clampToSlot,
  createDragState,
  createHorizontalResizeState,
  createResizeState,
  formatTimeSlot,
  moveDrag,
  moveHorizontalResize,
  moveResize,
  sameBlocks,
  timeToMinute,
} from './schedule-grid-gestures.ts'
import type { DragVisualOffset, GesturePointer, GridMeasurement } from './schedule-grid-gestures.ts'
import type { ScheduleLayoutBlock } from './schedule-layout.ts'

// 100px day columns and 10px rows, with the first row reserved for the header.
const grid: GridMeasurement = { dayWidth: 100, labelWidth: 50, left: 0, rowHeight: 10, top: 0 }

describe('schedule grid gestures', () => {
  it('parses 12- and 24-hour times into minutes of the day', () => {
    assert.equal(timeToMinute('9:30'), 570)
    assert.equal(timeToMinute('12:15am'), 15)
    assert.equal(timeToMinute('12:00 PM'), 720)
    assert.equal(timeToMinute('1:45pm'), 825)
    assert.equal(timeToMinute('not a time'), 0)
  })

  it('formats slot minutes as 12-hour labels', () => {
    assert.equal(formatTimeSlot(0), '12:00am')
    assert.equal(formatTimeSlot(9 * 60 + 15), '9:15am')
    assert.equal(formatTimeSlot(13 * 60), '1:00pm')
  })

  it('snaps values to 15-minute slots within bounds', () => {
    assert.equal(clampToSlot(568, 0, 1440), 570)
    assert.equal(clampToSlot(-20, 0, 1440), 0)
    assert.equal(clampToSlot(1500, 0, 1440), 1440)
    assert.equal(clampToSlot(600, 540, 500), 540)
  })

  it('selects the contiguous run of same-day blocks between the anchor and target', () => {
    let blocks = [
      block('c', 0, 600, 630),
      block('a', 0, 540, 570),
      block('other-day', 1, 570, 600),
      block('b', 0, 570, 600),
    ]

    assert.deepEqual([...adjacentSelection(blocks, 'a', 'c')], ['a', 'b', 'c'])
    assert.deepEqual([...adjacentSelection(blocks, 'c', 'b')], ['b', 'c'])
    assert.deepEqual([...adjacentSelection(blocks, 'a', 'other-day')], ['other-day'])
    assert.deepEqual([...adjacentSelection(blocks, 'missing', 'b')], ['b'])
  })

  it('compares block lists field by field', () => {
    let blocks = [block('a', 0, 540, 570)]

    assert.equal(sameBlocks(blocks, [block('a', 0, 540, 570)]), true)
    assert.equal(sameBlocks(blocks, [block('a', 0, 540, 585)]), false)
    assert.equal(sameBlocks(blocks, []), false)
  })

  it('ignores drags until the pointer passes the drag threshold', () => {
    let blocks = [block('a', 0, 0, 30)]
    let state = createDragState(blocks[0]!, ['a'], blocks, grid, pointer(60, 15))
    let offsets: DragVisualOffset[] = []
    let movement = pointer(62, 16)

    let result = moveDrag(state, movement, (_ids, offset) => offsets.push(offset))

    assert.equal(result, undefined)
    assert.equal(state.moved, false)
    assert.equal(movement.defaultPrevented, false)
    assert.deepEqual(offsets, [])
  })

  it('moves a dragged block to the snapped day and slot', () => {
    let blocks = [block('a', 0, 0, 30)]
    let state = createDragState(blocks[0]!, ['a'], blocks, grid, pointer(60, 15))
    let offsets: DragVisualOffset[] = []
    let movement = pointer(163, 37)

    let result = moveDrag(state, movement, (_ids, offset) => offsets.push(offset))

    assert.ok(result)
    assert.equal(movement.defaultPrevented, true)
    assert.deepEqual(state.placement, { dayOfWeek: 1, startMinute: 30 })
    assert.deepEqual(times(result.blocks), [['a', 1, 30, 60]])
    assert.equal(offsets.length, 1)
    assert.equal(Math.round(offsets[0]!.x), 3)
    assert.equal(Math.round(offsets[0]!.y * 10) / 10, 2)
  })

  it('keeps a resized block at least one slot long', () => {
    let blocks = [block('a', 0, 60, 120)]
    let state = createResizeState(blocks[0]!, 'end', blocks, grid, pointer(60, 90))

    let result = moveResize(state, pointer(60, 0))

    assert.ok(result)
    assert.deepEqual(times(result.blocks), [['a', 0, 60, 75]])
  })

  it('copies a block across the days covered by a horizontal resize', () => {
    let blocks = [block('a', 0, 0, 30)]
    let state = createHorizontalResizeState(
      blocks[0]!,
      'dayEnd',
      'copy',
      blocks,
      grid,
      pointer(150, 5),
    )

    let result = moveHorizontalResize(state, pointer(350, 5))

    assert.ok(result)
    assert.equal(state.activeBlockId, 'copy-2')
    assert.deepEqual(times(result.blocks), [
      ['a', 0, 0, 30],
      ['copy-1', 1, 0, 30],
      ['copy-2', 2, 0, 30],
    ])
  })
})

function pointer(clientX: number, clientY: number): GesturePointer & { defaultPrevented: boolean } {
  return {
    clientX,
    clientY,
    defaultPrevented: false,
    pointerId: 1,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
}

function block(
  id: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
): ScheduleLayoutBlock {
  return { color: null, dayOfWeek, endMinute, id, name: id, startMinute }
}

function times(blocks: ScheduleLayoutBlock[]) {
  return blocks.map((block) => [block.id, block.dayOfWeek, block.startMinute, block.endMinute])
}

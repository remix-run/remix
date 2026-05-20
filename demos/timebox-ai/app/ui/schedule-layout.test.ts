import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  previewCopyBlockAcrossDays,
  previewDeleteBlock,
  previewMoveBlock,
  previewMoveBlockGroup,
  previewResizeBlockTime,
  type ScheduleLayoutBlock,
} from './schedule-layout.ts'

describe('ScheduleLayout', () => {
  it('moves a block later in a stack by reordering the stack', () => {
    let result = previewMoveBlock(
      [
        block('one', 0, 555, 570),
        block('two', 0, 570, 585),
        block('three', 0, 585, 630),
      ],
      'one',
      { dayOfWeek: 0, startMinute: 570 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['two', 0, 555, 570],
      ['one', 0, 570, 585],
      ['three', 0, 585, 630],
    ])
  })

  it('moves a block to the dragged cell and shifts the destination chain', () => {
    let result = previewMoveBlock(
      [
        block('one', 0, 555, 570),
        block('two', 0, 570, 585),
        block('three', 0, 585, 630),
      ],
      'two',
      { dayOfWeek: 0, startMinute: 585 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 555, 570],
      ['two', 0, 585, 600],
      ['three', 0, 600, 645],
    ])
  })

  it('moves a block upward and slides the collided block into the nearest open slot', () => {
    let result = previewMoveBlock(
      [
        block('one', 0, 570, 585),
        block('make-breakfast', 0, 600, 630),
      ],
      'make-breakfast',
      { dayOfWeek: 0, startMinute: 570 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 555, 570],
      ['make-breakfast', 0, 570, 600],
    ])
  })

  it('keeps a taller dragged block anchored when moving up into a shorter block', () => {
    let result = previewMoveBlock(
      [
        block('breakfast', 0, 465, 480),
        block('kids-to-school', 0, 480, 495),
        block('mail', 0, 495, 540),
      ],
      'mail',
      { dayOfWeek: 0, startMinute: 480 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['breakfast', 0, 465, 480],
      ['mail', 0, 480, 525],
      ['kids-to-school', 0, 525, 540],
    ])
  })

  it('moves a block down and slides the collided block into the nearest open slot', () => {
    let result = previewMoveBlock(
      [
        block('mail', 0, 420, 450),
        block('breakfast', 0, 480, 495),
        block('kids-to-school', 0, 495, 510),
      ],
      'mail',
      { dayOfWeek: 0, startMinute: 465 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['breakfast', 0, 450, 465],
      ['mail', 0, 465, 495],
      ['kids-to-school', 0, 495, 510],
    ])
  })

  it('moves down through a stack and slides the collided item into the nearest open slot', () => {
    let result = previewMoveBlock(
      [
        block('make-lunches', 0, 450, 465),
        block('shower', 0, 465, 480),
        block('kids-to-school', 0, 480, 495),
      ],
      'make-lunches',
      { dayOfWeek: 0, startMinute: 465 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['shower', 0, 450, 465],
      ['make-lunches', 0, 465, 480],
      ['kids-to-school', 0, 480, 495],
    ])
  })

  it('swaps days for a clean horizontal move without mutating the source blocks', () => {
    let blocks = [
      block('monday', 0, 540, 570),
      block('tuesday', 1, 540, 570),
    ]

    let result = previewMoveBlock(blocks, 'monday', {
      dayOfWeek: 1,
      startMinute: 540,
    })

    assert.equal(result.unresolved, false)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['tuesday', 0, 540, 570],
      ['monday', 1, 540, 570],
    ])
    assert.deepEqual(
      result.changes.map((change) => change.kind),
      ['moved', 'moved'],
    )
    assert.deepEqual(timesFromBlocks(blocks), [
      ['monday', 0, 540, 570],
      ['tuesday', 1, 540, 570],
    ])
  })

  it('does not swap horizontally when the displaced block would hit a third block', () => {
    let result = previewMoveBlock(
      [
        block('service', 0, 540, 570),
        block('source-conflict', 0, 570, 600),
        block('date-night', 1, 540, 600),
      ],
      'service',
      { dayOfWeek: 1, startMinute: 540 },
    )

    assert.equal(result.unresolved, false)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['source-conflict', 0, 570, 600],
      ['service', 1, 540, 570],
      ['date-night', 1, 570, 630],
    ])
  })

  it('moves across the week without filling the source gap', () => {
    let result = previewMoveBlock(
      [
        block('monday-morning', 0, 540, 570),
        block('monday-after', 0, 570, 600),
        block('friday-night', 4, 1200, 1230),
      ],
      'monday-morning',
      { dayOfWeek: 4, startMinute: 1200 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['monday-after', 0, 570, 600],
      ['monday-morning', 4, 1200, 1230],
      ['friday-night', 4, 1230, 1260],
    ])
  })

  it('moves selected adjacent blocks together as a compound block', () => {
    let result = previewMoveBlockGroup(
      [
        block('read', 0, 540, 555),
        block('mail', 0, 555, 585),
        block('workout', 0, 600, 630),
        block('work', 0, 630, 660),
      ],
      ['mail', 'workout'],
      'mail',
      { dayOfWeek: 0, startMinute: 585 },
    )

    assert.equal(result.unresolved, false)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['read', 0, 540, 555],
      ['mail', 0, 585, 615],
      ['workout', 0, 630, 660],
      ['work', 0, 660, 690],
    ])
  })

  it('keeps grouped block offsets when moving selected blocks across days', () => {
    let result = previewMoveBlockGroup(
      [
        block('plan', 0, 540, 555),
        block('read', 0, 555, 585),
        block('friday-work', 4, 555, 600),
      ],
      ['plan', 'read'],
      'read',
      { dayOfWeek: 4, startMinute: 600 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['friday-work', 4, 540, 585],
      ['plan', 4, 585, 600],
      ['read', 4, 600, 630],
    ])
  })

  it('marks grouped moves unresolved when selected blocks span multiple days', () => {
    let blocks = [
      block('monday', 0, 540, 570),
      block('tuesday', 1, 540, 570),
    ]

    let result = previewMoveBlockGroup(
      blocks,
      ['monday', 'tuesday'],
      'monday',
      { dayOfWeek: 2, startMinute: 540 },
    )

    assert.equal(result.unresolved, true)
    assert.deepEqual(timesFromBlocks(result.blocks), timesFromBlocks(blocks))
  })

  it('marks impossible resizes unresolved without returning an overlapping layout', () => {
    let blocks = [
      block('one', 0, 1380, 1425),
      block('two', 0, 1425, 1440),
    ]

    let result = previewResizeBlockTime(blocks, 'one', {
      edge: 'end',
      minute: 1440,
    })

    assert.equal(result.unresolved, true)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 1380, 1425],
      ['two', 0, 1425, 1440],
    ])
    assert.deepEqual(result.changes, [])
  })

  it('keeps a moved stack within configured visible bounds', () => {
    let result = previewMoveBlock(
      [
        block('read', 0, 390, 405),
        block('breakfast', 0, 405, 420),
        block('make-lunches', 0, 420, 435),
        block('mail', 0, 435, 465),
        block('weasel', 0, 465, 480),
        block('kids-to-school', 0, 480, 495),
      ],
      'weasel',
      { dayOfWeek: 0, startMinute: 450 },
      { minimumMinute: 390 },
    )

    assert.equal(result.unresolved, false)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['read', 0, 390, 405],
      ['breakfast', 0, 405, 420],
      ['make-lunches', 0, 420, 435],
      ['weasel', 0, 450, 465],
      ['mail', 0, 465, 495],
      ['kids-to-school', 0, 495, 510],
    ])
  })

  it('does not squeeze collided blocks by default', () => {
    let blocks = [
      block('one', 0, 1380, 1425),
      block('two', 0, 1425, 1440),
    ]

    let result = previewResizeBlockTime(
      blocks,
      'one',
      {
        edge: 'end',
        minute: 1430,
      },
      { minimumDuration: 5, slotMinutes: 5 },
    )

    assert.equal(result.unresolved, true)
    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 1380, 1425],
      ['two', 0, 1425, 1440],
    ])
    assert.deepEqual(result.changes, [])
  })

  it('moves a block deeper and uses nearby open space for displaced items', () => {
    let result = previewMoveBlock(
      [
        block('early', 0, 540, 570),
        block('middle', 0, 570, 600),
        block('late', 0, 660, 690),
      ],
      'early',
      { dayOfWeek: 0, startMinute: 660 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['middle', 0, 570, 600],
      ['late', 0, 630, 660],
      ['early', 0, 660, 690],
    ])
  })

  it('pushes blocks down when resizing the bottom edge into them', () => {
    let result = previewResizeBlockTime(
      [
        block('one', 0, 540, 570),
        block('two', 0, 570, 600),
      ],
      'one',
      { edge: 'end', minute: 585 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 540, 585],
      ['two', 0, 585, 615],
    ])
  })

  it('pushes blocks up when resizing the top edge into them', () => {
    let result = previewResizeBlockTime(
      [
        block('one', 0, 540, 570),
        block('two', 0, 570, 600),
      ],
      'two',
      { edge: 'start', minute: 555 },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['one', 0, 525, 555],
      ['two', 0, 555, 600],
    ])
  })

  it('copies blocks across days as independent events and reflows each target day', () => {
    let result = previewCopyBlockAcrossDays(
      [
        block('breakfast', 0, 540, 570),
        block('tuesday-existing', 1, 540, 570),
      ],
      'breakfast',
      {
        createId: (_source, dayOfWeek) => `breakfast-${dayOfWeek}`,
        firstDay: 0,
        lastDay: 2,
      },
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [
      ['breakfast', 0, 540, 570],
      ['breakfast-1', 1, 540, 570],
      ['tuesday-existing', 1, 570, 600],
      ['breakfast-2', 2, 540, 570],
    ])
  })

  it('deletes one block without changing the others', () => {
    let result = previewDeleteBlock(
      [
        block('one', 0, 540, 570),
        block('two', 0, 570, 600),
      ],
      'one',
    )

    assert.deepEqual(timesFromBlocks(result.blocks), [['two', 0, 570, 600]])
  })
})

function block(
  id: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
): ScheduleLayoutBlock {
  return {
    color: null,
    dayOfWeek,
    endMinute,
    id,
    name: id,
    startMinute,
  }
}

function timesFromBlocks(blocks: ScheduleLayoutBlock[]) {
  return blocks.map((block) => [
    block.id,
    block.dayOfWeek,
    block.startMinute,
    block.endMinute,
  ])
}

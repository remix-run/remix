export interface ScheduleLayoutBlock {
  color: string | null
  dayOfWeek: number
  endMinute: number
  id: string
  name: string
  startMinute: number
}

export type ResizeEdge = 'start' | 'end'
export type ReflowDirection = 'down' | 'up'

export interface ScheduleLayoutPolicy {
  dayMinutes: number
  minimumMinute: number
  minimumDuration: number
  slotMinutes: number
}

export type ScheduleLayoutChangeKind = 'created' | 'deleted' | 'moved' | 'resized'

export interface ScheduleLayoutChange {
  after?: ScheduleLayoutBlock
  before?: ScheduleLayoutBlock
  id: string
  kind: ScheduleLayoutChangeKind
}

export interface ScheduleLayoutResult {
  blocks: ScheduleLayoutBlock[]
  changes: ScheduleLayoutChange[]
  unresolved: boolean
}

export interface CopyAcrossDaysOptions {
  createId?: (source: ScheduleLayoutBlock, dayOfWeek: number) => string
  firstDay: number
  lastDay: number
}

interface ScheduleBlockGroup {
  dayOfWeek: number
  endMinute: number
  startMinute: number
}

export const defaultScheduleLayoutPolicy: ScheduleLayoutPolicy = {
  dayMinutes: 1440,
  minimumMinute: 0,
  minimumDuration: 15,
  slotMinutes: 15,
}

export function previewDeleteBlock(
  sourceBlocks: ScheduleLayoutBlock[],
  blockId: string,
): ScheduleLayoutResult {
  let blocks = sourceBlocks.filter((block) => block.id !== blockId).map(copyBlock)
  return toResult(sourceBlocks, blocks, false)
}

export function previewMoveBlock(
  sourceBlocks: ScheduleLayoutBlock[],
  blockId: string,
  placement: { dayOfWeek: number; startMinute: number },
  policyInput: Partial<ScheduleLayoutPolicy> = {},
): ScheduleLayoutResult {
  let policy = createPolicy(policyInput)
  let originalBlocks = sourceBlocks.map(copyBlock)
  let movedBlock = requireBlock(originalBlocks, blockId)
  let originalBlock = copyBlock(movedBlock)
  let duration = durationOf(movedBlock)

  let blocks = originalBlocks.filter((block) => block.id !== blockId)
  let movedCopy = copyBlock(movedBlock)
  movedCopy.dayOfWeek = clampDay(placement.dayOfWeek)
  movedCopy.startMinute = clampMinute(
    placement.startMinute,
    policy.minimumMinute,
    policy.dayMinutes - duration,
    policy,
  )
  movedCopy.endMinute = movedCopy.startMinute + duration

  let resolved = insertBlock(blocks, movedCopy, policy, originalBlock)
  return toResult(sourceBlocks, resolved ?? originalBlocks, resolved === null)
}

export function previewMoveBlockGroup(
  sourceBlocks: ScheduleLayoutBlock[],
  blockIds: string[],
  anchorBlockId: string,
  placement: { dayOfWeek: number; startMinute: number },
  policyInput: Partial<ScheduleLayoutPolicy> = {},
): ScheduleLayoutResult {
  let uniqueBlockIds = Array.from(new Set(blockIds))
  if (uniqueBlockIds.length <= 1) {
    return previewMoveBlock(sourceBlocks, anchorBlockId, placement, policyInput)
  }

  let policy = createPolicy(policyInput)
  let originalBlocks = sourceBlocks.map(copyBlock)
  let selectedBlocks = uniqueBlockIds.map((blockId) => requireBlock(originalBlocks, blockId))
  if (!blocksShareDay(selectedBlocks)) return toResult(sourceBlocks, originalBlocks, true)

  let anchorBlock = requireBlock(selectedBlocks, anchorBlockId)
  let group = createBlockGroup(selectedBlocks)
  let groupDuration = group.endMinute - group.startMinute
  let targetDay = clampDay(placement.dayOfWeek)
  let targetGroupStart = clampMinute(
    placement.startMinute - (anchorBlock.startMinute - group.startMinute),
    policy.minimumMinute,
    policy.dayMinutes - groupDuration,
    policy,
  )
  let movedBlocks = selectedBlocks.map((block) => {
    let movedBlock = copyBlock(block)
    moveBlockTo(movedBlock, targetGroupStart + (block.startMinute - group.startMinute))
    movedBlock.dayOfWeek = targetDay
    return movedBlock
  })
  let remainingBlocks = originalBlocks.filter((block) => !uniqueBlockIds.includes(block.id))
  let resolved = insertBlockGroup(remainingBlocks, movedBlocks, policy, group)

  return toResult(sourceBlocks, resolved ?? originalBlocks, resolved === null)
}

export function previewResizeBlockTime(
  sourceBlocks: ScheduleLayoutBlock[],
  blockId: string,
  resize: { edge: ResizeEdge; minute: number },
  policyInput: Partial<ScheduleLayoutPolicy> = {},
): ScheduleLayoutResult {
  let policy = createPolicy(policyInput)
  let originalBlocks = sourceBlocks.map(copyBlock)
  let blocks = originalBlocks.map(copyBlock)
  let resizedBlock = requireBlock(blocks, blockId)

  if (resize.edge === 'start') {
    resizedBlock.startMinute = clampMinute(
      resize.minute,
      policy.minimumMinute,
      resizedBlock.endMinute - policy.minimumDuration,
      policy,
    )
  } else {
    resizedBlock.endMinute = clampMinute(
      resize.minute,
      resizedBlock.startMinute + policy.minimumDuration,
      policy.dayMinutes,
      policy,
    )
  }

  let direction: ReflowDirection = resize.edge === 'start' ? 'up' : 'down'
  let resolved = resolvePush(blocks, resizedBlock, direction, policy)
  return toResult(sourceBlocks, resolved ?? originalBlocks, resolved === null)
}

export function previewCopyBlockAcrossDays(
  sourceBlocks: ScheduleLayoutBlock[],
  blockId: string,
  options: CopyAcrossDaysOptions,
  policyInput: Partial<ScheduleLayoutPolicy> = {},
): ScheduleLayoutResult {
  let policy = createPolicy(policyInput)
  let sourceBlock = requireBlock(sourceBlocks, blockId)
  let firstDay = clampDay(Math.min(options.firstDay, options.lastDay))
  let lastDay = clampDay(Math.max(options.firstDay, options.lastDay))
  let blocks = sourceBlocks.map(copyBlock)
  let unresolved = false

  for (let dayOfWeek = firstDay; dayOfWeek <= lastDay; dayOfWeek++) {
    if (dayOfWeek === sourceBlock.dayOfWeek) continue

    let duplicateBlock: ScheduleLayoutBlock = {
      ...copyBlock(sourceBlock),
      dayOfWeek,
      id: options.createId?.(sourceBlock, dayOfWeek) ?? `${sourceBlock.id}-${dayOfWeek}`,
    }
    let resolved = insertBlock(blocks, duplicateBlock, policy, null)

    if (resolved) {
      blocks = resolved
    } else {
      unresolved = true
    }
  }

  return toResult(sourceBlocks, blocks, unresolved)
}

function insertBlock(
  blocks: ScheduleLayoutBlock[],
  insertedBlock: ScheduleLayoutBlock,
  policy: ScheduleLayoutPolicy,
  originalBlock: ScheduleLayoutBlock | null,
): ScheduleLayoutBlock[] | null {
  let withInserted = [...blocks.map(copyBlock), copyBlock(insertedBlock)]
  let inserted = requireBlock(withInserted, insertedBlock.id)
  if (!getCollisions(withInserted, inserted).length) {
    return isValidLayout(withInserted, policy) ? withInserted : null
  }

  let targetDayBlocks = blocks
    .filter((block) => block.dayOfWeek === inserted.dayOfWeek)
    .sort((left, right) => left.startMinute - right.startMinute)
  let otherBlocks = blocks.filter((block) => block.dayOfWeek !== inserted.dayOfWeek)
  let naturalIndex = insertionIndex(targetDayBlocks, inserted, originalBlock)
  let candidates: Array<{
    blocks: ScheduleLayoutBlock[]
    movedCount: number
    naturalDistance: number
    totalDistance: number
  }> = []

  for (let index = 0; index <= targetDayBlocks.length; index++) {
    let before = targetDayBlocks.slice(0, index)
    let after = targetDayBlocks.slice(index)
    let beforeLayout = layoutBeforeAnchor(before, inserted.startMinute, policy)
    if (!beforeLayout) continue

    let afterLayout = layoutAfterAnchor(after, inserted.endMinute, policy)
    if (!afterLayout) continue

    let candidate = [
      ...otherBlocks.map(copyBlock),
      ...beforeLayout,
      copyBlock(inserted),
      ...afterLayout,
    ]
    if (!isValidLayout(candidate, policy)) continue

    candidates.push({
      blocks: candidate,
      movedCount: countMoved([...beforeLayout, ...afterLayout], targetDayBlocks),
      naturalDistance: Math.abs(index - naturalIndex),
      totalDistance: totalMovement([...beforeLayout, ...afterLayout], targetDayBlocks),
    })
  }

  return (
    candidates.sort(
      (left, right) =>
        left.movedCount - right.movedCount ||
        left.totalDistance - right.totalDistance ||
        left.naturalDistance - right.naturalDistance,
    )[0]?.blocks ?? null
  )
}

function insertBlockGroup(
  blocks: ScheduleLayoutBlock[],
  insertedBlocks: ScheduleLayoutBlock[],
  policy: ScheduleLayoutPolicy,
  originalGroup: ScheduleBlockGroup,
): ScheduleLayoutBlock[] | null {
  let insertedGroup = createBlockGroup(insertedBlocks)
  let withInserted = [...blocks.map(copyBlock), ...insertedBlocks.map(copyBlock)]
  if (isValidLayout(withInserted, policy)) return withInserted

  let targetDayBlocks = blocks
    .filter((block) => block.dayOfWeek === insertedGroup.dayOfWeek)
    .sort((left, right) => left.startMinute - right.startMinute)
  let otherBlocks = blocks.filter((block) => block.dayOfWeek !== insertedGroup.dayOfWeek)
  let naturalIndex = groupInsertionIndex(targetDayBlocks, insertedGroup, originalGroup)
  let candidates: Array<{
    blocks: ScheduleLayoutBlock[]
    movedCount: number
    naturalDistance: number
    totalDistance: number
  }> = []

  for (let index = 0; index <= targetDayBlocks.length; index++) {
    let before = targetDayBlocks.slice(0, index)
    let after = targetDayBlocks.slice(index)
    let beforeLayout = layoutBeforeAnchor(before, insertedGroup.startMinute, policy)
    if (!beforeLayout) continue

    let afterLayout = layoutAfterAnchor(after, insertedGroup.endMinute, policy)
    if (!afterLayout) continue

    let candidate = [
      ...otherBlocks.map(copyBlock),
      ...beforeLayout,
      ...insertedBlocks.map(copyBlock),
      ...afterLayout,
    ]
    if (!isValidLayout(candidate, policy)) continue

    candidates.push({
      blocks: candidate,
      movedCount: countMoved([...beforeLayout, ...afterLayout], targetDayBlocks),
      naturalDistance: Math.abs(index - naturalIndex),
      totalDistance: totalMovement([...beforeLayout, ...afterLayout], targetDayBlocks),
    })
  }

  return (
    candidates.sort(
      (left, right) =>
        left.movedCount - right.movedCount ||
        left.totalDistance - right.totalDistance ||
        left.naturalDistance - right.naturalDistance,
    )[0]?.blocks ?? null
  )
}

function insertionIndex(
  blocks: ScheduleLayoutBlock[],
  insertedBlock: ScheduleLayoutBlock,
  originalBlock: ScheduleLayoutBlock | null,
) {
  if (originalBlock?.dayOfWeek === insertedBlock.dayOfWeek) {
    let movingDown = insertedBlock.startMinute > originalBlock.startMinute
    let edge = movingDown ? insertedBlock.endMinute : insertedBlock.startMinute
    let index = blocks.findIndex((block) =>
      movingDown ? edge <= blockCenter(block) : edge <= blockCenter(block),
    )
    return index === -1 ? blocks.length : index
  }

  let index = blocks.findIndex((block) => insertedBlock.startMinute <= block.startMinute)
  return index === -1 ? blocks.length : index
}

function groupInsertionIndex(
  blocks: ScheduleLayoutBlock[],
  insertedGroup: ScheduleBlockGroup,
  originalGroup: ScheduleBlockGroup,
) {
  if (originalGroup.dayOfWeek === insertedGroup.dayOfWeek) {
    let movingDown = insertedGroup.startMinute > originalGroup.startMinute
    let edge = movingDown ? insertedGroup.endMinute : insertedGroup.startMinute
    let index = blocks.findIndex((block) => edge <= blockCenter(block))
    return index === -1 ? blocks.length : index
  }

  let index = blocks.findIndex((block) => insertedGroup.startMinute <= block.startMinute)
  return index === -1 ? blocks.length : index
}

function layoutBeforeAnchor(
  blocks: ScheduleLayoutBlock[],
  anchorStartMinute: number,
  policy: ScheduleLayoutPolicy,
) {
  let placed: ScheduleLayoutBlock[] = []
  let cursor = anchorStartMinute

  for (let block of [...blocks].reverse()) {
    let nextBlock = copyBlock(block)
    let latestStart = cursor - durationOf(nextBlock)
    let startMinute = Math.min(nextBlock.startMinute, latestStart)
    if (startMinute < policy.minimumMinute) return null

    moveBlockTo(nextBlock, startMinute)
    placed.unshift(nextBlock)
    cursor = nextBlock.startMinute
  }

  return placed
}

function layoutAfterAnchor(
  blocks: ScheduleLayoutBlock[],
  anchorEndMinute: number,
  policy: ScheduleLayoutPolicy,
) {
  let placed: ScheduleLayoutBlock[] = []
  let cursor = anchorEndMinute

  for (let block of blocks) {
    let nextBlock = copyBlock(block)
    let startMinute = Math.max(nextBlock.startMinute, cursor)
    if (startMinute + durationOf(nextBlock) > policy.dayMinutes) return null

    moveBlockTo(nextBlock, startMinute)
    placed.push(nextBlock)
    cursor = nextBlock.endMinute
  }

  return placed
}

function countMoved(
  placedBlocks: ScheduleLayoutBlock[],
  originalBlocks: ScheduleLayoutBlock[],
) {
  let originalById = new Map(originalBlocks.map((block) => [block.id, block]))
  return placedBlocks.filter((block) => {
    let original = originalById.get(block.id)
    return original && original.startMinute !== block.startMinute
  }).length
}

function totalMovement(
  placedBlocks: ScheduleLayoutBlock[],
  originalBlocks: ScheduleLayoutBlock[],
) {
  let originalById = new Map(originalBlocks.map((block) => [block.id, block]))
  return placedBlocks.reduce((total, block) => {
    let original = originalById.get(block.id)
    return total + (original ? Math.abs(original.startMinute - block.startMinute) : 0)
  }, 0)
}

function resolvePush(
  blocks: ScheduleLayoutBlock[],
  anchorBlock: ScheduleLayoutBlock,
  direction: ReflowDirection,
  policy: ScheduleLayoutPolicy,
) {
  let candidate = blocks.map(copyBlock)
  let anchor = requireBlock(candidate, anchorBlock.id)
  let collisions = getCollisions(candidate, anchor)
  if (collisions.length === 0) return isValidLayout(candidate, policy) ? candidate : null

  let dayBlocks = candidate.filter(
    (block) => block.id !== anchor.id && block.dayOfWeek === anchor.dayOfWeek,
  )

  if (direction === 'down') {
    placeBlocksDown(anchor, dayBlocks)
  } else {
    placeBlocksUp(anchor, dayBlocks)
  }

  return isValidLayout(candidate, policy) ? candidate : null
}

function placeBlocksDown(
  anchorBlock: ScheduleLayoutBlock,
  dayBlocks: ScheduleLayoutBlock[],
) {
  let cursor = anchorBlock.endMinute

  for (let block of dayBlocks.sort((left, right) => left.startMinute - right.startMinute)) {
    if (block.endMinute <= anchorBlock.startMinute) continue

    if (block.startMinute < cursor) {
      moveBlockTo(block, cursor)
      cursor = block.endMinute
    }
  }
}

function placeBlocksUp(
  anchorBlock: ScheduleLayoutBlock,
  dayBlocks: ScheduleLayoutBlock[],
) {
  let cursor = anchorBlock.startMinute

  for (let block of dayBlocks.sort((left, right) => right.startMinute - left.startMinute)) {
    if (block.startMinute >= anchorBlock.endMinute) continue

    if (block.endMinute > cursor) {
      moveBlockTo(block, cursor - durationOf(block))
      cursor = block.startMinute
    }
  }
}

function toResult(
  beforeBlocks: ScheduleLayoutBlock[],
  afterBlocks: ScheduleLayoutBlock[],
  unresolved: boolean,
): ScheduleLayoutResult {
  let blocks = sortBlocks(afterBlocks)
  return {
    blocks,
    changes: getChanges(beforeBlocks, blocks),
    unresolved,
  }
}

function getChanges(
  beforeBlocks: ScheduleLayoutBlock[],
  afterBlocks: ScheduleLayoutBlock[],
) {
  let beforeById = new Map(beforeBlocks.map((block) => [block.id, block]))
  let afterById = new Map(afterBlocks.map((block) => [block.id, block]))
  let changes: ScheduleLayoutChange[] = []

  for (let before of beforeBlocks) {
    let after = afterById.get(before.id)
    if (!after) {
      changes.push({ before: copyBlock(before), id: before.id, kind: 'deleted' })
      continue
    }

    if (sameBlockPlacement(before, after)) continue

    changes.push({
      after: copyBlock(after),
      before: copyBlock(before),
      id: before.id,
      kind: durationOf(before) === durationOf(after) ? 'moved' : 'resized',
    })
  }

  for (let after of afterBlocks) {
    if (beforeById.has(after.id)) continue
    changes.push({ after: copyBlock(after), id: after.id, kind: 'created' })
  }

  return changes
}

function getCollisions(blocks: ScheduleLayoutBlock[], anchorBlock: ScheduleLayoutBlock) {
  return blocks.filter(
    (block) =>
      block.id !== anchorBlock.id &&
      block.dayOfWeek === anchorBlock.dayOfWeek &&
      blocksOverlap(block, anchorBlock),
  )
}

function createBlockGroup(blocks: ScheduleLayoutBlock[]): ScheduleBlockGroup {
  let firstBlock = blocks[0]
  if (!firstBlock) throw new Error('Cannot create a schedule block group without blocks.')

  let dayOfWeek = firstBlock.dayOfWeek
  let startMinute = firstBlock.startMinute
  let endMinute = firstBlock.endMinute

  for (let block of blocks) {
    if (block.dayOfWeek !== dayOfWeek) {
      throw new Error('Schedule block groups must be on one day.')
    }

    startMinute = Math.min(startMinute, block.startMinute)
    endMinute = Math.max(endMinute, block.endMinute)
  }

  return { dayOfWeek, endMinute, startMinute }
}

function blocksShareDay(blocks: ScheduleLayoutBlock[]) {
  let firstBlock = blocks[0]
  return firstBlock
    ? blocks.every((block) => block.dayOfWeek === firstBlock.dayOfWeek)
    : false
}

function isValidLayout(blocks: ScheduleLayoutBlock[], policy: ScheduleLayoutPolicy) {
  return blocks.every((block) => isValidBlock(block, policy)) && isNonOverlapping(blocks)
}

function isValidBlock(block: ScheduleLayoutBlock, policy: ScheduleLayoutPolicy) {
  return (
    Number.isInteger(block.dayOfWeek) &&
    block.dayOfWeek >= 0 &&
    block.dayOfWeek <= 6 &&
    Number.isInteger(block.startMinute) &&
    Number.isInteger(block.endMinute) &&
    block.startMinute >= policy.minimumMinute &&
    block.endMinute <= policy.dayMinutes &&
    durationOf(block) >= policy.minimumDuration
  )
}

function isNonOverlapping(blocks: ScheduleLayoutBlock[]) {
  let byDay = new Map<number, ScheduleLayoutBlock[]>()

  for (let block of blocks) {
    let dayBlocks = byDay.get(block.dayOfWeek) ?? []
    dayBlocks.push(block)
    byDay.set(block.dayOfWeek, dayBlocks)
  }

  for (let dayBlocks of byDay.values()) {
    let sorted = dayBlocks.sort((left, right) => left.startMinute - right.startMinute)
    for (let index = 0; index < sorted.length - 1; index++) {
      if (blocksOverlap(sorted[index]!, sorted[index + 1]!)) return false
    }
  }

  return true
}

function sameBlockPlacement(left: ScheduleLayoutBlock, right: ScheduleLayoutBlock) {
  return (
    left.color === right.color &&
    left.dayOfWeek === right.dayOfWeek &&
    left.endMinute === right.endMinute &&
    left.name === right.name &&
    left.startMinute === right.startMinute
  )
}

function blocksOverlap(left: ScheduleLayoutBlock, right: ScheduleLayoutBlock) {
  return left.startMinute < right.endMinute && left.endMinute > right.startMinute
}

function moveBlockTo(block: ScheduleLayoutBlock, startMinute: number) {
  let duration = durationOf(block)
  block.startMinute = startMinute
  block.endMinute = startMinute + duration
}

function blockCenter(block: ScheduleLayoutBlock) {
  return block.startMinute + durationOf(block) / 2
}

function durationOf(block: ScheduleLayoutBlock) {
  return block.endMinute - block.startMinute
}

function requireBlock(blocks: ScheduleLayoutBlock[], blockId: string) {
  let block = blocks.find((block) => block.id === blockId)
  if (!block) throw new Error(`Unknown schedule block: ${blockId}`)
  return block
}

function sortBlocks(blocks: ScheduleLayoutBlock[]) {
  return blocks
    .map(copyBlock)
    .sort(
      (left, right) =>
        left.dayOfWeek - right.dayOfWeek ||
        left.startMinute - right.startMinute ||
        left.id.localeCompare(right.id),
    )
}

function copyBlock(block: ScheduleLayoutBlock): ScheduleLayoutBlock {
  return { ...block }
}

function createPolicy(policy: Partial<ScheduleLayoutPolicy>) {
  return { ...defaultScheduleLayoutPolicy, ...policy }
}

function clampDay(value: number) {
  return clamp(Math.round(value), 0, 6)
}

function clampMinute(
  value: number,
  min: number,
  max: number,
  policy: ScheduleLayoutPolicy,
) {
  let snapped = Math.round(value / policy.slotMinutes) * policy.slotMinutes
  return clamp(snapped, min, Math.max(min, max))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

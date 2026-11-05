import {
  previewCopyBlockAcrossDays,
  previewMoveBlock,
  previewMoveBlockGroup,
  previewResizeBlockTime,
} from './schedule-layout.ts'
import type {
  ResizeEdge,
  ScheduleLayoutBlock,
  ScheduleLayoutPolicy,
  ScheduleLayoutResult,
} from './schedule-layout.ts'

export type GridInputId = string

export type GesturePointer = Pick<
  PointerEvent,
  'clientX' | 'clientY' | 'pointerId' | 'preventDefault'
>

export type DragVisualOffset = {
  x: number
  y: number
}

export type DragState = {
  kind: 'drag'
  blockId: GridInputId
  blockIds: GridInputId[]
  duration: number
  grid: GridMeasurement
  moved: boolean
  offsetX: number
  offsetY: number
  originalBlocks: ScheduleLayoutBlock[]
  placement: BlockPlacement
  pointerId: number
  startX: number
  startY: number
}

export type ResizeState = {
  kind: 'resize'
  blockId: GridInputId
  edge: ResizeEdge
  grid: GridMeasurement
  moved: boolean
  offsetY: number
  originalBlock: ScheduleLayoutBlock
  originalBlocks: ScheduleLayoutBlock[]
  pointerId: number
  startY: number
}

export type HorizontalResizeEdge = 'dayStart' | 'dayEnd'

export type HorizontalResizeState = {
  kind: 'horizontal-resize'
  activeBlockId: GridInputId
  blockId: GridInputId
  edge: HorizontalResizeEdge
  grid: GridMeasurement
  idPrefix: string
  moved: boolean
  offsetX: number
  originalBlock: ScheduleLayoutBlock
  originalBlocks: ScheduleLayoutBlock[]
  pointerId: number
  startX: number
}

export type Gesture = DragState | HorizontalResizeState | ResizeState

export type GridMeasurement = {
  dayWidth: number
  labelWidth: number
  left: number
  rowHeight: number
  top: number
}

export type BlockPlacement = {
  dayOfWeek: number
  startMinute: number
}

export type DragPreview = {
  placement: BlockPlacement
  visualOffset: DragVisualOffset
}

export const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const firstSlotMinute = 0

export const initialScrollMinute = 6 * 60 + 30

export const slotMinutes = 15

const lastSlotMinute = 24 * 60

export const timeSlots = Array.from(
  { length: (lastSlotMinute - firstSlotMinute) / slotMinutes },
  (_, index) => formatTimeSlot(firstSlotMinute + index * slotMinutes),
)

export function isHourSlot(time: string) {
  return time.includes(':00')
}

export function isHalfHourSlot(time: string) {
  return time.includes(':30')
}

export function timeToMinute(time: string) {
  let match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(time)
  if (!match) return firstSlotMinute

  let hour = Number(match[1])
  let minute = Number(match[2])
  let period = match[3]?.toLowerCase()

  if (period === 'pm' && hour !== 12) hour += 12
  if (period === 'am' && hour === 12) hour = 0

  return hour * 60 + minute
}

const scheduleLayoutPolicy: Partial<ScheduleLayoutPolicy> = {
  dayMinutes: lastSlotMinute,
  minimumMinute: firstSlotMinute,
  slotMinutes,
}

export const gridLabelWidth = 72

export const gridRowHeight = 36

const dragThreshold = 4

const horizontalResizeThreshold = 0.15

export function createDragState(
  block: ScheduleLayoutBlock,
  blockIds: GridInputId[],
  blocks: ScheduleLayoutBlock[],
  grid: GridMeasurement,
  event: GesturePointer,
): DragState {
  let blockLeft = grid.left + grid.labelWidth + block.dayOfWeek * grid.dayWidth
  let blockTop = grid.top + (startMinuteToSlotIndex(block.startMinute) + 1) * grid.rowHeight

  return {
    kind: 'drag',
    blockId: block.id,
    blockIds,
    duration: block.endMinute - block.startMinute,
    grid,
    moved: false,
    offsetX: event.clientX - blockLeft,
    offsetY: event.clientY - blockTop,
    originalBlocks: blocks.map(copyBlock),
    placement: { dayOfWeek: block.dayOfWeek, startMinute: block.startMinute },
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  }
}

export function moveDrag(
  state: DragState,
  event: GesturePointer,
  setVisualOffset: (blockIds: GridInputId[], offset: DragVisualOffset) => void,
): ScheduleLayoutResult | undefined {
  let distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
  if (!state.moved && distance < dragThreshold) return

  state.moved = true
  event.preventDefault()

  let nextDrag = pointerToDragPreview(event, state)
  if (samePlacement(state.placement, nextDrag.placement)) {
    setVisualOffset(state.blockIds, nextDrag.visualOffset)
    return
  }

  let nextPreview =
    state.blockIds.length > 1
      ? previewMoveBlockGroup(
          state.originalBlocks,
          state.blockIds,
          state.blockId,
          nextDrag.placement,
          scheduleLayoutPolicy,
        )
      : previewMoveBlock(
          state.originalBlocks,
          state.blockId,
          nextDrag.placement,
          scheduleLayoutPolicy,
        )

  if (nextPreview.unresolved) {
    setVisualOffset(state.blockIds, visualOffsetFromPlacement(nextDrag, state))
    return
  }

  state.placement = nextDrag.placement
  setVisualOffset(state.blockIds, nextDrag.visualOffset)
  return nextPreview
}

export function createResizeState(
  block: ScheduleLayoutBlock,
  edge: ResizeEdge,
  blocks: ScheduleLayoutBlock[],
  grid: GridMeasurement,
  event: GesturePointer,
): ResizeState {
  let edgeMinute = edge === 'start' ? block.startMinute : block.endMinute
  let edgeTop = grid.top + (startMinuteToSlotIndex(edgeMinute) + 1) * grid.rowHeight

  return {
    kind: 'resize',
    blockId: block.id,
    edge,
    grid,
    moved: false,
    offsetY: event.clientY - edgeTop,
    originalBlock: copyBlock(block),
    originalBlocks: blocks.map(copyBlock),
    pointerId: event.pointerId,
    startY: event.clientY,
  }
}

export function moveResize(
  state: ResizeState,
  event: GesturePointer,
): ScheduleLayoutResult | undefined {
  let distance = Math.abs(event.clientY - state.startY)
  if (!state.moved && distance < dragThreshold) return

  state.moved = true
  event.preventDefault()

  return previewResizeBlockTime(
    state.originalBlocks,
    state.blockId,
    { edge: state.edge, minute: pointerToResizeMinute(event, state) },
    scheduleLayoutPolicy,
  )
}

export function createHorizontalResizeState(
  block: ScheduleLayoutBlock,
  edge: HorizontalResizeEdge,
  idPrefix: string,
  blocks: ScheduleLayoutBlock[],
  grid: GridMeasurement,
  event: GesturePointer,
): HorizontalResizeState {
  let edgeColumn = edge === 'dayStart' ? block.dayOfWeek : block.dayOfWeek + 1
  let edgeLeft = grid.left + grid.labelWidth + edgeColumn * grid.dayWidth

  return {
    kind: 'horizontal-resize',
    activeBlockId: block.id,
    blockId: block.id,
    edge,
    grid,
    idPrefix,
    moved: false,
    offsetX: event.clientX - edgeLeft,
    originalBlock: copyBlock(block),
    originalBlocks: blocks.map(copyBlock),
    pointerId: event.pointerId,
    startX: event.clientX,
  }
}

export function moveHorizontalResize(
  state: HorizontalResizeState,
  event: GesturePointer,
): ScheduleLayoutResult | undefined {
  let distance = Math.abs(event.clientX - state.startX)
  if (!state.moved && distance < dragThreshold) return

  state.moved = true
  event.preventDefault()
  let resizeDay = pointerToResizeDay(event, state)
  let firstDay = state.edge === 'dayStart' ? resizeDay : state.originalBlock.dayOfWeek
  let lastDay = state.edge === 'dayEnd' ? resizeDay : state.originalBlock.dayOfWeek
  let activeDay = state.edge === 'dayStart' ? firstDay : lastDay
  state.activeBlockId = horizontalResizeBlockId(state, activeDay)

  return previewCopyBlockAcrossDays(
    state.originalBlocks,
    state.blockId,
    {
      createId: (_source, dayOfWeek) => `${state.idPrefix}-${dayOfWeek}`,
      firstDay,
      lastDay,
    },
    scheduleLayoutPolicy,
  )
}

export function measureGrid(element: HTMLElement): GridMeasurement {
  let rect = element.getBoundingClientRect()
  let labelWidth = gridLabelWidth
  let rowHeight = Math.max(
    1,
    rect.height > 0 ? rect.height / (timeSlots.length + 1) : gridRowHeight,
  )

  return {
    dayWidth: Math.max(1, (rect.width - labelWidth) / weekDays.length),
    labelWidth,
    left: rect.left,
    rowHeight,
    top: rect.top,
  }
}

function pointerToDragPreview(event: GesturePointer, dragState: DragState): DragPreview {
  let blockLeft = event.clientX - dragState.offsetX
  let blockTop = event.clientY - dragState.offsetY
  let rawDay =
    (blockLeft - dragState.grid.left - dragState.grid.labelWidth) / dragState.grid.dayWidth
  let rawSlot =
    (blockTop - dragState.grid.top - dragState.grid.rowHeight) / dragState.grid.rowHeight
  let snappedDay = clamp(Math.round(rawDay), 0, weekDays.length - 1)
  let snappedStartMinute = clampToSlot(
    firstSlotMinute + Math.round(rawSlot) * slotMinutes,
    firstSlotMinute,
    lastSlotMinute - dragState.duration,
  )
  let snappedSlot = (snappedStartMinute - firstSlotMinute) / slotMinutes

  return {
    placement: {
      dayOfWeek: snappedDay,
      startMinute: snappedStartMinute,
    },
    visualOffset: {
      x: (rawDay - snappedDay) * dragState.grid.dayWidth,
      y: (rawSlot - snappedSlot) * dragState.grid.rowHeight,
    },
  }
}

function visualOffsetFromPlacement(
  dragPreview: DragPreview,
  dragState: DragState,
): DragVisualOffset {
  let placementSlot = (dragState.placement.startMinute - firstSlotMinute) / slotMinutes
  let previewSlot = (dragPreview.placement.startMinute - firstSlotMinute) / slotMinutes

  return {
    x:
      dragPreview.visualOffset.x +
      (dragPreview.placement.dayOfWeek - dragState.placement.dayOfWeek) * dragState.grid.dayWidth,
    y: dragPreview.visualOffset.y + (previewSlot - placementSlot) * dragState.grid.rowHeight,
  }
}

function pointerToResizeMinute(event: GesturePointer, resizeState: ResizeState) {
  let edgeTop = event.clientY - resizeState.offsetY
  let rawMinute =
    firstSlotMinute +
    Math.round(
      (edgeTop - resizeState.grid.top - resizeState.grid.rowHeight) / resizeState.grid.rowHeight,
    ) *
      slotMinutes

  if (resizeState.edge === 'start') {
    return clampToSlot(
      rawMinute,
      firstSlotMinute,
      resizeState.originalBlock.endMinute - slotMinutes,
    )
  }

  return clampToSlot(rawMinute, resizeState.originalBlock.startMinute + slotMinutes, lastSlotMinute)
}

function pointerToResizeDay(event: GesturePointer, resizeState: HorizontalResizeState) {
  let edgeLeft = event.clientX - resizeState.offsetX
  let rawEdgeColumn =
    (edgeLeft - resizeState.grid.left - resizeState.grid.labelWidth) / resizeState.grid.dayWidth

  if (resizeState.edge === 'dayStart') {
    return clamp(
      Math.floor(rawEdgeColumn + horizontalResizeThreshold),
      0,
      resizeState.originalBlock.dayOfWeek,
    )
  }

  return clamp(
    Math.ceil(rawEdgeColumn - horizontalResizeThreshold) - 1,
    resizeState.originalBlock.dayOfWeek,
    weekDays.length - 1,
  )
}

function horizontalResizeBlockId(state: HorizontalResizeState, dayOfWeek: number): GridInputId {
  return dayOfWeek === state.originalBlock.dayOfWeek
    ? state.blockId
    : `${state.idPrefix}-${dayOfWeek}`
}

function copyBlock(block: ScheduleLayoutBlock): ScheduleLayoutBlock {
  return { ...block }
}

export function adjacentSelection(
  blocks: ScheduleLayoutBlock[],
  anchorId: GridInputId,
  targetId: GridInputId,
) {
  let anchorBlock = blocks.find((block) => block.id === anchorId)
  let targetBlock = blocks.find((block) => block.id === targetId)
  if (!anchorBlock || !targetBlock || anchorBlock.dayOfWeek !== targetBlock.dayOfWeek) {
    return new Set<GridInputId>([targetId])
  }

  let dayBlocks = blocks
    .filter((block) => block.dayOfWeek === targetBlock.dayOfWeek)
    .sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id))
  let anchorIndex = dayBlocks.findIndex((block) => block.id === anchorId)
  let targetIndex = dayBlocks.findIndex((block) => block.id === targetId)
  if (anchorIndex === -1 || targetIndex === -1) return new Set<GridInputId>([targetId])

  let startIndex = Math.min(anchorIndex, targetIndex)
  let endIndex = Math.max(anchorIndex, targetIndex)

  return new Set(dayBlocks.slice(startIndex, endIndex + 1).map((block) => block.id))
}

export function sameBlocks(
  leftBlocks: ReadonlyArray<ScheduleLayoutBlock>,
  rightBlocks: ReadonlyArray<ScheduleLayoutBlock>,
) {
  if (leftBlocks.length !== rightBlocks.length) return false

  for (let index = 0; index < leftBlocks.length; index++) {
    let left = leftBlocks[index]!
    let right = rightBlocks[index]!

    if (
      left.color !== right.color ||
      left.dayOfWeek !== right.dayOfWeek ||
      left.endMinute !== right.endMinute ||
      left.id !== right.id ||
      left.name !== right.name ||
      left.startMinute !== right.startMinute
    ) {
      return false
    }
  }

  return true
}

function samePlacement(left: BlockPlacement, right: BlockPlacement) {
  return left.dayOfWeek === right.dayOfWeek && left.startMinute === right.startMinute
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function clampToSlot(value: number, min: number, max: number) {
  let snapped = Math.round(value / slotMinutes) * slotMinutes
  return clamp(snapped, min, Math.max(min, max))
}

export function startMinuteToSlotIndex(startMinute: number) {
  return Math.max(0, Math.round((startMinute - firstSlotMinute) / slotMinutes))
}

export function durationToSlotSpan(startMinute: number, endMinute: number) {
  return Math.max(1, Math.round((endMinute - startMinute) / slotMinutes))
}

export function formatTimeSlot(minuteOfDay: number) {
  let hour24 = Math.floor(minuteOfDay / 60) % 24
  let minute = minuteOfDay % 60
  let period = hour24 < 12 ? 'am' : 'pm'
  let hour12 = hour24 % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')}${period}`
}

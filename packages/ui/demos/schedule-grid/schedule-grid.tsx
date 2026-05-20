import { css, on, ref, type Handle } from 'remix/ui'
import { animateLayout, spring } from 'remix/ui/animation'
import { theme } from 'remix/ui/theme'

import {
  previewCopyBlockAcrossDays,
  previewDeleteBlock,
  previewMoveBlock,
  previewMoveBlockGroup,
  previewResizeBlockTime,
  type ScheduleLayoutBlock,
  type ScheduleLayoutResult,
} from './schedule-layout.ts'

export type GridBlockDocument = ScheduleLayoutBlock

export type GridScheduleDocument = {
  blocks: GridBlockDocument[]
  id: number
  name: string
}

type GridInputId = string

type DragState = {
  active: boolean
  blockId: GridInputId
  blockIds: GridInputId[]
  duration: number
  grid: GridMeasurement
  moved: boolean
  offsetX: number
  offsetY: number
  originalBlocks: ScheduleLayoutBlock[]
  pointerId: number
  startX: number
  startY: number
}

type ResizeEdge = 'start' | 'end'

type ResizeState = {
  active: boolean
  blockId: GridInputId
  edge: ResizeEdge
  grid: GridMeasurement
  moved: boolean
  offsetY: number
  originalBlock: GridBlockDocument
  originalBlocks: ScheduleLayoutBlock[]
  pointerId: number
  startY: number
}

type HorizontalResizeEdge = 'dayStart' | 'dayEnd'

type HorizontalResizeState = {
  active: boolean
  activeBlockId: GridInputId
  blockId: GridInputId
  edge: HorizontalResizeEdge
  grid: GridMeasurement
  idPrefix: string
  moved: boolean
  offsetX: number
  originalBlock: GridBlockDocument
  originalBlocks: ScheduleLayoutBlock[]
  pointerId: number
  startX: number
}

type GestureKind = 'drag' | 'horizontal-resize' | 'resize'

type GridMeasurement = {
  dayWidth: number
  labelWidth: number
  left: number
  rowHeight: number
  top: number
}

type BlockPlacement = {
  dayOfWeek: number
  startMinute: number
}

export function ScheduleGrid(
  handle: Handle<{
    onScheduleChange?: (schedule: GridScheduleDocument) => void
    schedule: GridScheduleDocument
  }>,
) {
  let schedule = handle.props.schedule
  let draftBlock: GridBlockDocument | null = null
  let dragState: DragState | null = null
  let horizontalResizeState: HorizontalResizeState | null = null
  let preview: ScheduleLayoutResult | null = null
  let resizeState: ResizeState | null = null
  let gridElement: HTMLDivElement | null = null
  let activeGesture: GestureKind | null = null
  let horizontalResizeSequence = 0
  let selectedBlockIds = new Set<GridInputId>()
  let selectionAnchorId: GridInputId | null = null
  let suppressDraftClickUntil = 0
  let suppressSelectionClickUntil = 0

  return () => {
    if (handle.props.schedule.id !== schedule.id) {
      schedule = handle.props.schedule
      draftBlock = null
      dragState = null
      horizontalResizeState = null
      preview = null
      resizeState = null
      activeGesture = null
      horizontalResizeSequence = 0
      selectedBlockIds = new Set()
      selectionAnchorId = null
      suppressDraftClickUntil = 0
      suppressSelectionClickUntil = 0
    }

    let visibleBlocks = (preview?.blocks ?? schedule.blocks) as GridBlockDocument[]

    return (
      <section
        aria-label="Weekly schedule"
        data-schedule-dragging={dragState?.active === true ? 'true' : undefined}
        data-schedule-resizing={
          resizeState ? 'vertical' : horizontalResizeState ? 'horizontal' : undefined
        }
        mix={weekScheduleStyle}
      >
        <div mix={calendarHeaderStyle}>
          <div aria-hidden="true" />
          <div mix={calendarTitleStyle}>{schedule.name}</div>
          <div aria-hidden="true" />
        </div>

        <div mix={dayHeaderGridStyle}>
          <div aria-hidden="true" />
          {weekDays.map((day) => (
            <div key={day} mix={dayHeaderStyle}>
              {day}
            </div>
          ))}
        </div>

        <div mix={timeGridScrollerStyle}>
          <div
            mix={[
              timeGridStyle,
              ref((node, signal) => {
                gridElement = node
                signal.addEventListener('abort', () => {
                  if (gridElement === node) gridElement = null
                })
              }),
            ]}
          >
            <div mix={timeRowsStyle}>
              <div aria-hidden="true" mix={timeRowStyle}>
                <div />
                {weekDays.map((day) => (
                  <div key={`spacer-${day}`} mix={spacerTimeCellStyle} />
                ))}
              </div>
              {timeSlots.map((time) => (
                <div key={time} mix={timeRowStyle}>
                  <div
                    mix={[
                      timeLabelStyle,
                      isHourSlot(time) ? hourTimeLabelStyle : undefined,
                    ]}
                  >
                    {time}
                  </div>
                  {weekDays.map((day) => (
                    <div
                      aria-label={`${day} ${time}`}
                      key={`${day}-${time}`}
                      mix={[
                        timeCellStyle,
                        on('pointerdown', (event) => {
                          if (event.button === 0 && clearBlockFocusOrSelection()) {
                            suppressDraftClickUntil = performance.now() + 250
                          }
                        }),
                        on('click', () => {
                          if (performance.now() < suppressDraftClickUntil) return
                          if (clearBlockFocusOrSelection()) return
                          startDraft(day, time)
                        }),
                        isHourSlot(time) ? hourTimeCellStyle : undefined,
                        isHalfHourSlot(time) ? halfHourTimeCellStyle : undefined,
                      ]}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div aria-label="Scheduled blocks" mix={blockLayerStyle}>
              {visibleBlocks.map((block) => (
                <ScheduleBlock
                  activeHorizontalResizeEdge={horizontalResizeState?.edge}
                  activeResizeEdge={resizeState?.edge}
                  block={block}
                  isDragging={dragState?.active === true && dragState.blockIds.includes(block.id)}
                  isDraft={draftBlock?.id === block.id}
                  isHorizontalResizing={horizontalResizeState?.activeBlockId === block.id}
                  isResizing={resizeState?.blockId === block.id}
                  isSelected={selectedBlockIds.has(block.id)}
                  key={block.id}
                  onCancelDraft={cancelDraft}
                  onClearSelection={clearBlockFocusOrSelection}
                  onCommit={commitBlock}
                  onDelete={deleteBlock}
                  onDragStart={startDrag}
                  onHorizontalResizeStart={startHorizontalResize}
                  onPointerDown={prepareBlockPointerDown}
                  onResizeStart={startResize}
                  onSelect={selectBlock}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  function startDraft(day: string, time: string) {
    if (draftBlock) return

    let startMinute = timeToMinute(time)
    draftBlock = {
      color: null,
      dayOfWeek: weekDays.indexOf(day),
      endMinute: startMinute + slotMinutes,
      id: `block-${Date.now()}`,
      name: '',
      startMinute,
    }
    schedule.blocks.push(draftBlock)
    handle.update()
  }

  function cancelDraft() {
    if (draftBlock) {
      schedule.blocks = schedule.blocks.filter((block) => block.id !== draftBlock?.id)
    }
    draftBlock = null
    handle.update()
  }

  function commitBlock(block: GridBlockDocument) {
    let name = block.name.trim()

    if (!name) {
      if (draftBlock?.id === block.id) cancelDraft()
      return
    }

    block.name = name
    if (draftBlock?.id === block.id) draftBlock = null
    handle.update()
    saveSchedule()
  }

  function deleteBlock(block: GridBlockDocument) {
    if (draftBlock?.id === block.id) {
      cancelDraft()
      return
    }

    let result = previewDeleteBlock(schedule.blocks, block.id)
    schedule.blocks = result.blocks as GridBlockDocument[]
    selectedBlockIds.delete(block.id)
    if (selectionAnchorId === block.id) selectionAnchorId = null
    handle.update()
    saveSchedule()
  }

  function startDrag(block: GridBlockDocument, event: PointerEvent) {
    if (
      draftBlock ||
      activeGesture ||
      horizontalResizeState ||
      resizeState ||
      event.button !== 0 ||
      !gridElement
    ) {
      return
    }

    let grid = measureGrid(gridElement)
    let blockLeft = grid.left + grid.labelWidth + block.dayOfWeek * grid.dayWidth
    let blockTop =
      grid.top + (startMinuteToSlotIndex(block.startMinute) + 1) * grid.rowHeight
    let blockIds = selectedBlockIds.has(block.id)
      ? Array.from(selectedBlockIds)
      : [block.id]
    if (!selectedBlockIds.has(block.id)) {
      selectedBlockIds = new Set(blockIds)
      selectionAnchorId = block.id
    }

    dragState = {
      active: true,
      blockId: block.id,
      blockIds,
      duration: block.endMinute - block.startMinute,
      grid,
      moved: false,
      offsetX: event.clientX - blockLeft,
      offsetY: event.clientY - blockTop,
      originalBlocks: schedule.blocks.map(copyBlock),
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    bindGesture('drag')
    handle.update()
  }

  function moveDrag(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) return

    let distance = Math.hypot(
      event.clientX - dragState.startX,
      event.clientY - dragState.startY,
    )
    if (!dragState.moved && distance < dragThreshold) return

    dragState.moved = true
    event.preventDefault()

    let placement = pointerToPlacement(event, dragState)
    updatePreview(
      dragState.blockIds.length > 1
        ? previewMoveBlockGroup(
            dragState.originalBlocks,
            dragState.blockIds,
            dragState.blockId,
            placement,
            scheduleLayoutPolicy,
          )
        : previewMoveBlock(
            dragState.originalBlocks,
            dragState.blockId,
            placement,
            scheduleLayoutPolicy,
          ),
    )
  }

  function endDrag(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) return

    unbindGesture()
    let finalPreview =
      dragState.moved && preview && !preview.unresolved ? preview : null
    let didMove = dragState.moved
    if (didMove) suppressSelectionClickUntil = performance.now() + 250
    let draggedBlockIds = dragState.blockIds
    dragState = null

    if (finalPreview) {
      event.preventDefault()
      schedule.blocks = finalPreview.blocks as GridBlockDocument[]
      selectedBlockIds = new Set(draggedBlockIds)
      preview = null
      handle.update()
      saveSchedule()
      return
    }

    if (preview) {
      preview = null
      handle.update()
      return
    }

    handle.update()
  }

  function selectBlock(block: GridBlockDocument, event: MouseEvent) {
    if (draftBlock || activeGesture) return
    if (!event.shiftKey && performance.now() < suppressSelectionClickUntil) return

    if (!event.shiftKey || !selectionAnchorId) {
      selectedBlockIds = new Set([block.id])
      selectionAnchorId = block.id
      handle.update()
      return
    }

    selectedBlockIds = adjacentSelection(schedule.blocks, selectionAnchorId, block.id)
    handle.update()
  }

  function prepareBlockPointerDown(block: GridBlockDocument, event: PointerEvent) {
    if (draftBlock || activeGesture || event.shiftKey || selectedBlockIds.has(block.id)) {
      return
    }

    selectedBlockIds = new Set([block.id])
    selectionAnchorId = block.id
    handle.update()
  }

  function clearBlockFocusOrSelection() {
    let focusedBlock = focusedScheduleBlockElement()
    let hadSelection = selectedBlockIds.size > 0
    if (!focusedBlock && !hadSelection) return false

    selectedBlockIds = new Set()
    selectionAnchorId = null
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    handle.update()
    return true
  }

  function clearOtherBlockFocusOrSelection(blockId: GridInputId) {
    let focusedBlock = focusedScheduleBlockElement()
    let focusedBlockId = focusedBlock?.dataset.scheduleBlockId
    let hadOtherSelection =
      selectedBlockIds.size > 0 &&
      !(selectedBlockIds.size === 1 && selectedBlockIds.has(blockId))

    if (focusedBlockId === blockId && !hadOtherSelection) return false
    if (!focusedBlockId && !hadOtherSelection) return false

    selectedBlockIds = new Set()
    selectionAnchorId = null
    if (focusedBlockId !== blockId && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    handle.update()
    return true
  }

  function startResize(
    block: GridBlockDocument,
    edge: ResizeEdge,
    event: PointerEvent,
  ) {
    if (
      (draftBlock && draftBlock.id !== block.id) ||
      dragState ||
      horizontalResizeState ||
      event.button !== 0 ||
      !gridElement
    ) {
      return
    }

    clearOtherBlockFocusOrSelection(block.id)
    let grid = measureGrid(gridElement)
    let edgeMinute = edge === 'start' ? block.startMinute : block.endMinute
    let edgeTop = grid.top + (startMinuteToSlotIndex(edgeMinute) + 1) * grid.rowHeight

    resizeState = {
      active: true,
      blockId: block.id,
      edge,
      grid,
      moved: false,
      offsetY: event.clientY - edgeTop,
      originalBlock: copyBlock(block),
      originalBlocks: schedule.blocks.map(copyBlock),
      pointerId: event.pointerId,
      startY: event.clientY,
    }
    bindGesture('resize')
    handle.update()
  }

  function moveResize(event: PointerEvent) {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return

    let distance = Math.abs(event.clientY - resizeState.startY)
    if (!resizeState.moved && distance < dragThreshold) return

    resizeState.moved = true
    event.preventDefault()

    updatePreview(
      previewResizeBlockTime(
        resizeState.originalBlocks,
        resizeState.blockId,
        {
          edge: resizeState.edge,
          minute: pointerToResizeMinute(event, resizeState),
        },
        scheduleLayoutPolicy,
      ),
    )
  }

  function endResize(event: PointerEvent) {
    if (!resizeState || resizeState.pointerId !== event.pointerId) return

    unbindGesture()
    let finalPreview =
      resizeState.moved && preview && !preview.unresolved ? preview : null
    resizeState = null

    if (finalPreview) {
      event.preventDefault()
      schedule.blocks = finalPreview.blocks as GridBlockDocument[]
      preview = null
      handle.update()
      saveSchedule()
      return
    }

    if (preview) {
      preview = null
      handle.update()
      return
    }

    handle.update()
  }

  function startHorizontalResize(
    block: GridBlockDocument,
    edge: HorizontalResizeEdge,
    event: PointerEvent,
  ) {
    if (
      (draftBlock && draftBlock.id !== block.id) ||
      dragState ||
      horizontalResizeState ||
      resizeState ||
      event.button !== 0 ||
      !gridElement
    ) {
      return
    }

    clearOtherBlockFocusOrSelection(block.id)
    let grid = measureGrid(gridElement)
    let edgeColumn = edge === 'dayStart' ? block.dayOfWeek : block.dayOfWeek + 1
    let edgeLeft = grid.left + grid.labelWidth + edgeColumn * grid.dayWidth

    horizontalResizeState = {
      active: true,
      activeBlockId: block.id,
      blockId: block.id,
      edge,
      grid,
      idPrefix: `repeat-${++horizontalResizeSequence}-${Date.now().toString(36)}`,
      moved: false,
      offsetX: event.clientX - edgeLeft,
      originalBlock: copyBlock(block),
      originalBlocks: schedule.blocks.map(copyBlock),
      pointerId: event.pointerId,
      startX: event.clientX,
    }
    bindGesture('horizontal-resize')
    handle.update()
  }

  function moveHorizontalResize(event: PointerEvent) {
    if (!horizontalResizeState || horizontalResizeState.pointerId !== event.pointerId) {
      return
    }

    let state = horizontalResizeState
    let distance = Math.abs(event.clientX - state.startX)
    if (!state.moved && distance < dragThreshold) return

    state.moved = true
    event.preventDefault()
    let resizeDay = pointerToResizeDay(event, state)
    let firstDay = state.edge === 'dayStart' ? resizeDay : state.originalBlock.dayOfWeek
    let lastDay = state.edge === 'dayEnd' ? resizeDay : state.originalBlock.dayOfWeek
    let activeDay = state.edge === 'dayStart' ? firstDay : lastDay
    state.activeBlockId = horizontalResizeBlockId(state, activeDay)

    updatePreview(
      previewCopyBlockAcrossDays(
        state.originalBlocks,
        state.blockId,
        {
          createId: (_source, dayOfWeek) => `${state.idPrefix}-${dayOfWeek}`,
          firstDay,
          lastDay,
        },
        scheduleLayoutPolicy,
      ),
    )
  }

  function endHorizontalResize(event: PointerEvent) {
    if (!horizontalResizeState || horizontalResizeState.pointerId !== event.pointerId) {
      return
    }

    unbindGesture()
    let finalPreview =
      horizontalResizeState.moved && preview && !preview.unresolved ? preview : null
    horizontalResizeState = null

    if (finalPreview) {
      event.preventDefault()
      schedule.blocks = finalPreview.blocks as GridBlockDocument[]
      preview = null
      handle.update()
      saveSchedule()
      return
    }

    if (preview) {
      preview = null
      handle.update()
      return
    }

    handle.update()
  }

  function bindGesture(kind: GestureKind) {
    activeGesture = kind

    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerEnd)
    window.addEventListener('pointercancel', handleWindowPointerEnd)
  }

  function unbindGesture() {
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerEnd)
    window.removeEventListener('pointercancel', handleWindowPointerEnd)
    activeGesture = null
  }

  function handleWindowPointerMove(event: PointerEvent) {
    if (activeGesture === 'drag') {
      moveDrag(event)
      return
    }

    if (activeGesture === 'resize') {
      moveResize(event)
      return
    }

    if (activeGesture === 'horizontal-resize') {
      moveHorizontalResize(event)
    }
  }

  function handleWindowPointerEnd(event: PointerEvent) {
    if (activeGesture === 'drag') {
      endDrag(event)
      return
    }

    if (activeGesture === 'resize') {
      endResize(event)
      return
    }

    if (activeGesture === 'horizontal-resize') {
      endHorizontalResize(event)
    }
  }

  function updatePreview(nextPreview: ScheduleLayoutResult) {
    if (sameBlocks(preview?.blocks ?? schedule.blocks, nextPreview.blocks)) return
    preview = nextPreview
    handle.update()
  }

  function saveSchedule() {
    handle.props.onScheduleChange?.(copySchedule(schedule))
  }
}

function ScheduleBlock(
  handle: Handle<{
    activeHorizontalResizeEdge?: HorizontalResizeEdge
    activeResizeEdge?: ResizeEdge
    block: GridBlockDocument
    isDragging: boolean
    isDraft: boolean
    isHorizontalResizing: boolean
    isResizing: boolean
    isSelected: boolean
    onCancelDraft: () => void
    onClearSelection: () => void
    onCommit: (block: GridBlockDocument) => void
    onDelete: (block: GridBlockDocument) => void
    onDragStart: (block: GridBlockDocument, event: PointerEvent) => void
    onHorizontalResizeStart: (
      block: GridBlockDocument,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) => void
    onPointerDown: (block: GridBlockDocument, event: PointerEvent) => void
    onResizeStart: (
      block: GridBlockDocument,
      edge: ResizeEdge,
      event: PointerEvent,
    ) => void
    onSelect: (block: GridBlockDocument, event: MouseEvent) => void
  }>,
) {
  let block = handle.props.block
  let name = block.name
  let lastCommittedName = block.name

  return () => {
    if (handle.props.block.id !== block.id) {
      name = handle.props.block.name
      lastCommittedName = handle.props.block.name
    }
    block = handle.props.block

    let label = name || 'Untitled'

    return (
      <div
        aria-label={label}
        data-dragging={handle.props.isDragging ? 'true' : undefined}
        data-resizing={
          handle.props.isResizing || handle.props.isHorizontalResizing ? 'true' : undefined
        }
        data-schedule-block="true"
        data-schedule-block-id={block.id}
        data-selected={handle.props.isSelected ? 'true' : undefined}
        key={block.id}
        mix={[
          blockBoxStyle,
          draggingBlockBoxStyle,
          on('click', (event) => {
            if (!event.shiftKey && event.target === event.currentTarget) {
              handle.props.onSelect(block, event)
            }

            if (event.target === event.currentTarget) {
              event.currentTarget.focus()
            }
          }),
          on('keydown', (event) => {
            if (event.target !== event.currentTarget) return

            if (event.key === 'Escape') {
              event.preventDefault()
              handle.props.onClearSelection()
              return
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault()
              handle.props.onDelete(block)
            }
          }),
          on('pointerdown', (event) => {
            if (event.shiftKey) {
              handle.props.onSelect(block, event)
              return
            }
            handle.props.onPointerDown(block, event)
            if (event.target instanceof HTMLInputElement) return

            if (event.target === event.currentTarget) {
              event.currentTarget.focus()
            }
            handle.props.onDragStart(block, event)
          }),
          animateLayout(handle.props.isDragging ? false : scheduleBlockLayoutAnimation),
        ]}
        tabIndex={0}
        style={{
          backgroundColor: blockBackgroundColor(block),
          gridColumn: block.dayOfWeek + 2,
          gridRow: `${startMinuteToSlotIndex(block.startMinute) + 2} / span ${durationToSlotSpan(
            block.startMinute,
            block.endMinute,
          )}`,
        }}
      >
        <input
          aria-label={handle.props.isDraft ? 'New block name' : `${label} name`}
          mix={[
            blockInputStyle,
            ref((node) => {
              if (handle.props.isDraft) node.focus()
            }),
            on('input', (event) => {
              name = event.currentTarget.value
              event.currentTarget.size = inputSize(name)
            }),
            on('keydown', (event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                if (handle.props.isDraft) {
                  handle.props.onCancelDraft()
                } else {
                  handle.props.onClearSelection()
                }
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }),
            on('blur', commit),
          ]}
          defaultValue={name}
          size={inputSize(name)}
          type="text"
        />
        <ResizeHandle
          block={block}
          edge="start"
          isActive={handle.props.isResizing && handle.props.activeResizeEdge === 'start'}
          onResizeStart={handle.props.onResizeStart}
        />
        <ResizeHandle
          block={block}
          edge="end"
          isActive={handle.props.isResizing && handle.props.activeResizeEdge === 'end'}
          onResizeStart={handle.props.onResizeStart}
        />
        <HorizontalResizeHandle
          block={block}
          edge="dayStart"
          isActive={
            handle.props.isHorizontalResizing &&
            handle.props.activeHorizontalResizeEdge === 'dayStart'
          }
          onResizeStart={handle.props.onHorizontalResizeStart}
        />
        <HorizontalResizeHandle
          block={block}
          edge="dayEnd"
          isActive={
            handle.props.isHorizontalResizing &&
            handle.props.activeHorizontalResizeEdge === 'dayEnd'
          }
          onResizeStart={handle.props.onHorizontalResizeStart}
        />
      </div>
    )
  }

  function commit() {
    let trimmedName = name.trim()
    if (!handle.props.isDraft && trimmedName === lastCommittedName) return

    block.name = trimmedName
    lastCommittedName = trimmedName
    handle.props.onCommit(block)
  }
}

function ResizeHandle(
  handle: Handle<{
    block: GridBlockDocument
    edge: ResizeEdge
    isActive: boolean
    onResizeStart: (
      block: GridBlockDocument,
      edge: ResizeEdge,
      event: PointerEvent,
    ) => void
  }>,
) {
  return () => (
    <div
      aria-label={`${handle.props.edge === 'start' ? 'Start' : 'End'} resize handle`}
      className="resize-handle"
      data-active-resize-handle={handle.props.isActive ? 'true' : undefined}
      mix={[
        resizeHandleStyle,
        handle.props.edge === 'start' ? startResizeHandleStyle : endResizeHandleStyle,
        on('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          handle.props.onResizeStart(handle.props.block, handle.props.edge, event)
        }),
      ]}
    />
  )
}

function HorizontalResizeHandle(
  handle: Handle<{
    block: GridBlockDocument
    edge: HorizontalResizeEdge
    isActive: boolean
    onResizeStart: (
      block: GridBlockDocument,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) => void
  }>,
) {
  return () => (
    <div
      aria-label={`${handle.props.edge === 'dayStart' ? 'First day' : 'Last day'} resize handle`}
      className="resize-handle"
      data-active-resize-handle={handle.props.isActive ? 'true' : undefined}
      mix={[
        horizontalResizeHandleStyle,
        handle.props.edge === 'dayStart'
          ? dayStartResizeHandleStyle
          : dayEndResizeHandleStyle,
        on('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          handle.props.onResizeStart(handle.props.block, handle.props.edge, event)
        }),
      ]}
    />
  )
}

const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const timeSlots = [
  '6:30 am',
  '6:45 am',
  '7:00am',
  '7:15am',
  '7:30am',
  '7:45am',
  '8:00am',
  '8:15am',
  '8:30am',
  '8:45am',
  '9:00am',
  '9:15am',
  '9:30am',
  '9:45am',
  '10:00am',
  '10:15am',
  '10:30am',
  '10:45am',
  '11:00am',
  '11:15am',
  '11:30am',
  '11:45am',
  '12:00pm',
  '12:15pm',
  '12:30pm',
  '12:45pm',
  '1:00pm',
  '1:15pm',
  '1:30pm',
  '1:45pm',
  '2:00pm',
  '2:15pm',
  '2:30pm',
  '2:45pm',
  '3:00pm',
  '3:15pm',
  '3:30pm',
  '3:45pm',
  '4:00pm',
  '4:15pm',
  '4:30pm',
  '4:45pm',
  '5:00pm',
  '5:15pm',
  '5:30pm',
  '5:45pm',
  '6:00pm',
  '6:15pm',
  '6:30pm',
  '6:45pm',
  '7:00pm',
  '7:15pm',
  '7:30pm',
  '7:45pm',
  '8:00pm',
  '8:15pm',
  '8:30pm',
  '8:45pm',
  '9:00pm',
  '9:15pm',
  '9:30pm',
  '9:45pm',
  '10:00pm',
  '10:15pm',
  '10:30pm',
]

function isHourSlot(time: string) {
  return time.includes(':00')
}

function isHalfHourSlot(time: string) {
  return time.includes(':30')
}

function timeToMinute(time: string) {
  let match = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(time)
  if (!match) return firstSlotMinute

  let hour = Number(match[1])
  let minute = Number(match[2])
  let period = match[3]?.toLowerCase()

  if (period === 'pm' && hour !== 12) hour += 12
  if (period === 'am' && hour === 12) hour = 0

  return hour * 60 + minute
}

const firstSlotMinute = 390
const slotMinutes = 15
const lastSlotMinute = firstSlotMinute + timeSlots.length * slotMinutes
const scheduleLayoutPolicy = {
  dayMinutes: lastSlotMinute,
  minimumMinute: firstSlotMinute,
  slotMinutes,
}
const gridLabelWidth = 72
const gridRowHeight = 44
const dragThreshold = 4
const horizontalResizeThreshold = 0.15

function measureGrid(element: HTMLElement): GridMeasurement {
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

function pointerToPlacement(
  event: PointerEvent,
  dragState: DragState,
): BlockPlacement {
  let blockLeft = event.clientX - dragState.offsetX
  let blockTop = event.clientY - dragState.offsetY
  let rawDay = Math.round(
    (blockLeft - dragState.grid.left - dragState.grid.labelWidth) /
      dragState.grid.dayWidth,
  )
  let rawStart =
    firstSlotMinute +
    Math.round(
      (blockTop - dragState.grid.top - dragState.grid.rowHeight) /
        dragState.grid.rowHeight,
    ) *
      slotMinutes

  return {
    dayOfWeek: clamp(rawDay, 0, weekDays.length - 1),
    startMinute: clampToSlot(
      rawStart,
      firstSlotMinute,
      lastSlotMinute - dragState.duration,
    ),
  }
}

function pointerToResizeMinute(event: PointerEvent, resizeState: ResizeState) {
  let edgeTop = event.clientY - resizeState.offsetY
  let rawMinute =
    firstSlotMinute +
    Math.round(
      (edgeTop - resizeState.grid.top - resizeState.grid.rowHeight) /
        resizeState.grid.rowHeight,
    ) *
      slotMinutes

  if (resizeState.edge === 'start') {
    return clampToSlot(
      rawMinute,
      firstSlotMinute,
      resizeState.originalBlock.endMinute - slotMinutes,
    )
  }

  return clampToSlot(
    rawMinute,
    resizeState.originalBlock.startMinute + slotMinutes,
    lastSlotMinute,
  )
}

function pointerToResizeDay(event: PointerEvent, resizeState: HorizontalResizeState) {
  let edgeLeft = event.clientX - resizeState.offsetX
  let rawEdgeColumn =
    (edgeLeft - resizeState.grid.left - resizeState.grid.labelWidth) /
    resizeState.grid.dayWidth

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

function horizontalResizeBlockId(
  state: HorizontalResizeState,
  dayOfWeek: number,
): GridInputId {
  return dayOfWeek === state.originalBlock.dayOfWeek
    ? state.blockId
    : `${state.idPrefix}-${dayOfWeek}`
}

function copyBlock(block: GridBlockDocument): GridBlockDocument {
  return { ...block }
}

function copySchedule(schedule: GridScheduleDocument): GridScheduleDocument {
  return {
    ...schedule,
    blocks: schedule.blocks.map(copyBlock),
  }
}

function adjacentSelection(
  blocks: GridBlockDocument[],
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
    .sort(
      (left, right) =>
        left.startMinute - right.startMinute || left.id.localeCompare(right.id),
    )
  let anchorIndex = dayBlocks.findIndex((block) => block.id === anchorId)
  let targetIndex = dayBlocks.findIndex((block) => block.id === targetId)
  if (anchorIndex === -1 || targetIndex === -1) return new Set<GridInputId>([targetId])

  let startIndex = Math.min(anchorIndex, targetIndex)
  let endIndex = Math.max(anchorIndex, targetIndex)

  return new Set(dayBlocks.slice(startIndex, endIndex + 1).map((block) => block.id))
}

function focusedScheduleBlockElement() {
  let activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return null

  return activeElement.closest('[data-schedule-block="true"]') as HTMLElement | null
}

function sameBlocks(
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampToSlot(value: number, min: number, max: number) {
  let snapped = Math.round(value / slotMinutes) * slotMinutes
  return clamp(snapped, min, Math.max(min, max))
}

function startMinuteToSlotIndex(startMinute: number) {
  return Math.max(0, Math.round((startMinute - firstSlotMinute) / slotMinutes))
}

function durationToSlotSpan(startMinute: number, endMinute: number) {
  return Math.max(1, Math.round((endMinute - startMinute) / slotMinutes))
}

function inputSize(value: string) {
  return Math.max(1, value.length)
}

function blockBackgroundColor(block: GridBlockDocument) {
  let hue = hashString(block.name.trim().toLowerCase() || String(block.id)) % 360
  return `hsl(${hue} 78% 88%)`
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

const scheduleBlockLayoutAnimation = {
  ...spring('snappy'),
}

const weekScheduleStyle = css({
  display: 'grid',
  gridTemplateRows: '72px 40px minmax(0, 1fr)',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  '&[data-schedule-dragging="true"], &[data-schedule-dragging="true"] *': {
    cursor: 'grabbing !important',
  },
  '&[data-schedule-dragging="true"] .resize-handle': {
    opacity: '0 !important',
    pointerEvents: 'none',
  },
  '&[data-schedule-resizing="vertical"], &[data-schedule-resizing="vertical"] *': {
    cursor: 'ns-resize !important',
  },
  '&[data-schedule-resizing="horizontal"], &[data-schedule-resizing="horizontal"] *': {
    cursor: 'ew-resize !important',
  },
})

const calendarHeaderStyle = css({
  alignItems: 'center',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: theme.space.md,
  padding: `0 ${theme.space.lg}`,
})

const calendarTitleStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.bold,
  justifyContent: 'center',
  letterSpacing: theme.letterSpacing.tight,
})

const dayHeaderGridStyle = css({
  alignItems: 'end',
  borderBottom: `1px solid ${theme.colors.border.strong}`,
  display: 'grid',
  gridTemplateColumns: '72px repeat(7, minmax(88px, 1fr))',
  paddingRight: '12px',
})

const dayHeaderStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  textAlign: 'center',
})

const timeGridScrollerStyle = css({
  minHeight: 0,
  overflowY: 'auto',
})

const timeGridStyle = css({
  minWidth: '760px',
  position: 'relative',
})

const timeRowsStyle = css({
  position: 'relative',
})

const timeRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '72px repeat(7, minmax(88px, 1fr))',
  minHeight: '44px',
})

const timeLabelStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  padding: `0 ${theme.space.sm} 0 0`,
  textAlign: 'right',
  transform: 'translateY(-0.75em)',
})

const hourTimeLabelStyle = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
})

const timeCellStyle = css({
  borderLeft: `1px dashed ${theme.colors.border.default}`,
  borderTop: `1px dashed ${theme.colors.border.default}`,
  minHeight: '44px',
})

const hourTimeCellStyle = css({
  borderTop: `1px solid ${theme.colors.border.strong}`,
})

const halfHourTimeCellStyle = css({
  borderTop: `1px dotted ${theme.colors.border.strong}`,
})

const spacerTimeCellStyle = css({
  borderLeft: `1px dashed ${theme.colors.border.default}`,
  minHeight: '44px',
})

const blockLayerStyle = css({
  display: 'grid',
  gridTemplateColumns: '72px repeat(7, minmax(88px, 1fr))',
  gridAutoRows: '44px',
  inset: 0,
  pointerEvents: 'none',
  position: 'absolute',
  zIndex: 1,
})

const blockBoxStyle = css({
  alignItems: 'center',
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.shadow.xs,
  color: '#111111',
  cursor: 'grab',
  display: 'flex',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  justifyContent: 'center',
  margin: '3px 6px',
  overflow: 'hidden',
  padding: theme.space.sm,
  pointerEvents: 'auto',
  position: 'relative',
  textAlign: 'center',
  touchAction: 'none',
  transition: 'background-color 120ms ease, border-color 120ms ease',
  userSelect: 'none',
  '&:hover .resize-handle': {
    opacity: 1,
  },
  '&[data-resizing="true"] .resize-handle': {
    opacity: 1,
  },
  '&:focus, &[data-selected="true"]': {
    borderColor: theme.colors.focus.ring,
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: 0,
  },
})

const draggingBlockBoxStyle = css({
  '&[data-dragging="true"]': {
    backgroundColor: theme.surface.lvl2,
    borderColor: theme.colors.focus.ring,
    cursor: 'grabbing',
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: 0,
    zIndex: 2,
    '& .resize-handle': {
      opacity: 0,
    },
  },
})

const resizeHandleStyle = css({
  cursor: 'ns-resize',
  height: '14px',
  left: theme.space.sm,
  opacity: 0,
  position: 'absolute',
  right: theme.space.sm,
  touchAction: 'none',
  zIndex: 3,
  '&::before': {
    backgroundColor: theme.colors.focus.ring,
    borderRadius: '999px',
    content: '""',
    height: '3px',
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '36px',
  },
  '&:hover': {
    opacity: 1,
  },
  '&[data-active-resize-handle="true"]': {
    opacity: 1,
  },
})

const startResizeHandleStyle = css({
  top: 0,
  transform: 'translateY(-4px)',
})

const endResizeHandleStyle = css({
  bottom: 0,
  transform: 'translateY(4px)',
})

const horizontalResizeHandleStyle = css({
  bottom: theme.space.lg,
  cursor: 'ew-resize',
  opacity: 0,
  position: 'absolute',
  top: theme.space.lg,
  touchAction: 'none',
  width: '14px',
  zIndex: 3,
  '&::before': {
    backgroundColor: theme.colors.focus.ring,
    borderRadius: '999px',
    content: '""',
    height: '24px',
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '3px',
  },
  '&:hover': {
    opacity: 1,
  },
  '&[data-active-resize-handle="true"]': {
    opacity: 1,
  },
})

const dayStartResizeHandleStyle = css({
  left: 0,
  transform: 'translateX(-4px)',
})

const dayEndResizeHandleStyle = css({
  right: 0,
  transform: 'translateX(4px)',
})

const blockInputStyle = css({
  backgroundColor: 'transparent',
  border: 0,
  boxSizing: 'content-box',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  lineHeight: 1.2,
  maxWidth: '100%',
  minWidth: '1ch',
  outline: 0,
  padding: 0,
  textAlign: 'center',
})

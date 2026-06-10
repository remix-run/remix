import {
  clientEntry,
  createMixin,
  css,
  on,
  ref,
  type Handle,
  type SerializableValue,
} from 'remix/ui'
import { animateLayout, spring } from 'remix/ui/animation'
import * as btn from 'remix/components/button'
import { theme } from './design.ts'

import {
  previewCopyBlockAcrossDays,
  previewDeleteBlock,
  previewMoveBlock,
  previewMoveBlockGroup,
  previewResizeBlockTime,
  type ScheduleLayoutBlock,
  type ScheduleLayoutResult,
} from './schedule-layout.ts'

type GridBlockDocument = ScheduleLayoutBlock & {
  [key: string]: SerializableValue
}

export type GridScheduleDocument = {
  [key: string]: SerializableValue
  blocks: GridBlockDocument[]
  id: number
  name: string
  revision: number
  updatedAt: number
}

type GridInputId = string

type DraftBlock = GridBlockDocument & {
  id: string
}

type DragVisualOffset = {
  x: number
  y: number
}

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
  placement: BlockPlacement
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

type DragPreview = {
  placement: BlockPlacement
  visualOffset: DragVisualOffset
}

const dragVisualOffsetEventType = 'timebox:schedule-block-drag-visual-offset'

class DragVisualOffsetEvent extends Event {
  offset: DragVisualOffset

  constructor(offset: DragVisualOffset) {
    super(dragVisualOffsetEventType)
    this.offset = offset
  }
}

export const ScheduleGrid = clientEntry(
  import.meta.url,
  function ScheduleGrid(
    handle: Handle<{
      csrfToken: string
      downloadIcsHref: string
      schedule: GridScheduleDocument
    }>,
  ) {
    let schedule = handle.props.schedule
    let draftBlock: DraftBlock | null = null
    let dragState: DragState | null = null
    let horizontalResizeState: HorizontalResizeState | null = null
    let preview: ScheduleLayoutResult | null = null
    let resizeState: ResizeState | null = null
    let gridElement: HTMLDivElement | null = null
    let scrollerElement: HTMLDivElement | null = null
    let activeGesture: GestureKind | null = null
    let horizontalResizeSequence = 0
    let saveSequence = 0
    let latestAppliedSaveSequence = 0
    let scrolledScheduleId: number | null = null
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
        saveSequence = 0
        latestAppliedSaveSequence = 0
        scrolledScheduleId = null
        selectedBlockIds = new Set()
        selectionAnchorId = null
        suppressDraftClickUntil = 0
        suppressSelectionClickUntil = 0
      }

      if (scrolledScheduleId !== schedule.id) {
        scrolledScheduleId = schedule.id
        handle.queueTask((signal) => {
          if (signal.aborted) return

          scrollGridToInitialTime()
        })
      }

      let visibleBlocks = (preview?.blocks ?? schedule.blocks) as GridBlockDocument[]
      let activeDragState = dragState?.active === true ? dragState : null
      let dragGhostBlocks = activeDragState
        ? visibleBlocks.filter((block) => activeDragState.blockIds.includes(block.id))
        : []

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
            <div mix={calendarActionsStyle}>
              <a
                download
                href={handle.props.downloadIcsHref}
                mix={[btn.baseStyle, btn.secondaryStyle]}
              >
                Download ICS
              </a>
            </div>
          </div>

          <div mix={dayHeaderGridStyle}>
            <div aria-hidden="true" />
            {weekDays.map((day) => (
              <div key={day} mix={dayHeaderStyle}>
                {day}
              </div>
            ))}
          </div>

          <div
            mix={[
              timeGridScrollerStyle,
              ref((node, signal) => {
                scrollerElement = node
                signal.addEventListener('abort', () => {
                  if (scrollerElement === node) scrollerElement = null
                })
              }),
            ]}
          >
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
                    <div mix={[timeLabelStyle, isHourSlot(time) ? hourTimeLabelStyle : undefined]}>
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
                {dragGhostBlocks.map((block) => (
                  <ScheduleBlockGhost block={block} key={`drop-ghost-${block.id}`} />
                ))}
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
                    shouldAnimateLayout={
                      dragState?.active === true && !dragState.blockIds.includes(block.id)
                    }
                    onCancelDraft={cancelDraft}
                    onClearSelection={clearBlockFocusOrSelection}
                    onCommit={commitBlock}
                    onDelete={deleteBlock}
                    onDragStart={startDrag}
                    onHorizontalResizeStart={startHorizontalResize}
                    onFocus={focusBlock}
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

      let deleteIds = selectedBlockIds.has(block.id) ? Array.from(selectedBlockIds) : [block.id]
      let deleteIdSet = new Set(deleteIds)
      let nextBlocks = schedule.blocks
      for (let blockId of deleteIds) {
        nextBlocks = previewDeleteBlock(nextBlocks, blockId).blocks as GridBlockDocument[]
      }

      schedule.blocks = nextBlocks
      selectedBlockIds = new Set(
        Array.from(selectedBlockIds).filter((blockId) => !deleteIdSet.has(blockId)),
      )
      if (selectionAnchorId && deleteIdSet.has(selectionAnchorId)) selectionAnchorId = null
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
      let blockTop = grid.top + (startMinuteToSlotIndex(block.startMinute) + 1) * grid.rowHeight
      let blockIds = selectedBlockIds.has(block.id) ? Array.from(selectedBlockIds) : [block.id]
      if (!selectedBlockIds.has(block.id)) {
        selectedBlockIds = new Set(blockIds)
        selectionAnchorId = block.id
      }
      let placement = {
        dayOfWeek: block.dayOfWeek,
        startMinute: block.startMinute,
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
        placement,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      }
      bindGesture('drag')
      handle.update()
    }

    function moveDrag(event: PointerEvent) {
      if (!dragState || dragState.pointerId !== event.pointerId) return

      let distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      if (!dragState.moved && distance < dragThreshold) return

      dragState.moved = true
      event.preventDefault()

      let nextDrag = pointerToDragPreview(event, dragState)
      if (samePlacement(dragState.placement, nextDrag.placement)) {
        dispatchDragVisualOffset(dragState.blockIds, nextDrag.visualOffset)
        return
      }

      let nextPreview =
        dragState.blockIds.length > 1
          ? previewMoveBlockGroup(
              dragState.originalBlocks,
              dragState.blockIds,
              dragState.blockId,
              nextDrag.placement,
              scheduleLayoutPolicy,
            )
          : previewMoveBlock(
              dragState.originalBlocks,
              dragState.blockId,
              nextDrag.placement,
              scheduleLayoutPolicy,
            )

      if (nextPreview.unresolved) {
        dispatchDragVisualOffset(dragState.blockIds, visualOffsetFromPlacement(nextDrag, dragState))
        return
      }

      dragState.placement = nextDrag.placement
      dispatchDragVisualOffset(dragState.blockIds, nextDrag.visualOffset)
      updatePreview(nextPreview)
    }

    function endDrag(event: PointerEvent) {
      if (!dragState || dragState.pointerId !== event.pointerId) return

      unbindGesture()
      let finalPreview = dragState.moved && preview && !preview.unresolved ? preview : null
      let didMove = dragState.moved
      if (didMove) suppressSelectionClickUntil = performance.now() + 250
      let draggedBlockIds = dragState.blockIds
      dispatchDragVisualOffset(draggedBlockIds, { x: 0, y: 0 })
      dragState = null

      if (finalPreview) {
        event.preventDefault()
        schedule.blocks = finalPreview.blocks as GridBlockDocument[]
        selectedBlockIds = new Set(draggedBlockIds)
        preview = null
        saveSchedule()
        handle.update()
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

    function focusBlock(block: GridBlockDocument) {
      if (draftBlock || activeGesture) return
      if (selectedBlockIds.size === 1 && selectedBlockIds.has(block.id)) return
      if (selectedBlockIds.size > 1 && selectedBlockIds.has(block.id)) return

      selectedBlockIds = new Set([block.id])
      selectionAnchorId = block.id
      handle.update()
    }

    function prepareBlockPointerDown(block: GridBlockDocument, event: PointerEvent) {
      if (draftBlock || activeGesture || event.shiftKey) {
        return
      }

      if (selectedBlockIds.has(block.id)) {
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
        selectedBlockIds.size > 0 && !(selectedBlockIds.size === 1 && selectedBlockIds.has(blockId))

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

    function startResize(block: GridBlockDocument, edge: ResizeEdge, event: PointerEvent) {
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
      let finalPreview = resizeState.moved && preview && !preview.unresolved ? preview : null
      resizeState = null

      if (finalPreview) {
        event.preventDefault()
        schedule.blocks = finalPreview.blocks as GridBlockDocument[]
        preview = null
        saveSchedule()
        handle.update()
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
        saveSchedule()
        handle.update()
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
      if (sameBlocks(preview?.blocks ?? schedule.blocks, nextPreview.blocks)) {
        return false
      }
      preview = nextPreview
      handle.update()
      return true
    }

    function dispatchDragVisualOffset(blockIds: GridInputId[], offset: DragVisualOffset) {
      if (!gridElement) return

      let blockIdSet = new Set(blockIds)
      for (let node of gridElement.querySelectorAll<HTMLElement>('[data-schedule-block="true"]')) {
        if (!node.dataset.scheduleBlockId) continue
        if (!blockIdSet.has(node.dataset.scheduleBlockId)) continue

        node.dispatchEvent(new DragVisualOffsetEvent(offset))
      }
    }

    async function saveSchedule() {
      let sequence = ++saveSequence
      let scheduleId = schedule.id
      let response = await fetch(`/schedules/${scheduleId}`, {
        body: JSON.stringify({
          baseRevision: schedule.revision,
          blocks: schedule.blocks,
          name: schedule.name,
        }),
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': handle.props.csrfToken,
        },
        method: 'PUT',
      })

      if (!response.ok || sequence < latestAppliedSaveSequence) return

      let json = (await response.json()) as { schedule: GridScheduleDocument }
      if (schedule.id !== scheduleId || sequence < saveSequence) return

      latestAppliedSaveSequence = sequence
      schedule = json.schedule
      handle.update()
    }

    function scrollGridToInitialTime() {
      if (!gridElement || !scrollerElement) return

      let grid = measureGrid(gridElement)
      scrollerElement.scrollTop = (startMinuteToSlotIndex(initialScrollMinute) + 1) * grid.rowHeight
    }
  },
)

const blockDragVisual = createMixin<HTMLElement>((handle) => {
  let node: HTMLElement | null = null
  let offset: DragVisualOffset | undefined

  function updateOffset(event: Event) {
    if (!(event instanceof DragVisualOffsetEvent)) return

    offset = event.offset
    handle.update()
  }

  handle.addEventListener('insert', (event) => {
    node = event.node
    node.addEventListener(dragVisualOffsetEventType, updateOffset)
  })

  handle.addEventListener('remove', () => {
    node?.removeEventListener(dragVisualOffsetEventType, updateOffset)
    node = null
    offset = undefined
  })

  return (props) => (
    <handle.element
      {...props}
      style={{
        ...props.style,
        translate: dragVisualTranslate(offset),
      }}
    />
  )
})

function ScheduleBlockGhost(
  handle: Handle<{
    block: GridBlockDocument
  }>,
) {
  return () => {
    let block = handle.props.block

    return (
      <div
        aria-hidden="true"
        mix={blockGhostGridItemStyle}
        style={{
          gridColumn: block.dayOfWeek + 2,
          gridRow: `${startMinuteToSlotIndex(block.startMinute) + 2} / span ${durationToSlotSpan(
            block.startMinute,
            block.endMinute,
          )}`,
        }}
      >
        <div mix={blockGhostBoxStyle} />
      </div>
    )
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
    shouldAnimateLayout: boolean
    onCancelDraft: () => void
    onClearSelection: () => void
    onCommit: (block: GridBlockDocument) => void
    onDelete: (block: GridBlockDocument) => void
    onDragStart: (block: GridBlockDocument, event: PointerEvent) => void
    onFocus: (block: GridBlockDocument) => void
    onHorizontalResizeStart: (
      block: GridBlockDocument,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) => void
    onPointerDown: (block: GridBlockDocument, event: PointerEvent) => void
    onResizeStart: (block: GridBlockDocument, edge: ResizeEdge, event: PointerEvent) => void
    onSelect: (block: GridBlockDocument, event: MouseEvent) => void
  }>,
) {
  let block = handle.props.block
  let state: 'editing' | 'idle' = handle.props.isDraft ? 'editing' : 'idle'
  let name = block.name
  let lastCommittedName = block.name
  let blockElement: HTMLDivElement | null = null
  let inputElement: HTMLInputElement | null = null

  return () => {
    if (handle.props.block.id !== block.id) {
      state = handle.props.isDraft ? 'editing' : 'idle'
      name = handle.props.block.name
      lastCommittedName = handle.props.block.name
    }
    block = handle.props.block
    if (handle.props.isDraft) state = 'editing'

    let label = name || 'Untitled'
    let isEditing = state === 'editing'

    return (
      <div
        data-dragging={handle.props.isDragging ? 'true' : undefined}
        key={block.id}
        mix={[
          blockGridItemStyle,
          animateLayout(handle.props.shouldAnimateLayout ? scheduleBlockLayoutAnimation : false),
        ]}
        style={{
          gridColumn: block.dayOfWeek + 2,
          gridRow: `${startMinuteToSlotIndex(block.startMinute) + 2} / span ${durationToSlotSpan(
            block.startMinute,
            block.endMinute,
          )}`,
        }}
      >
        <div
          aria-label={label}
          data-dragging={handle.props.isDragging ? 'true' : undefined}
          data-editing={isEditing ? 'true' : undefined}
          data-resizing={
            handle.props.isResizing || handle.props.isHorizontalResizing ? 'true' : undefined
          }
          data-schedule-block="true"
          data-schedule-block-id={block.id}
          data-selected={handle.props.isSelected ? 'true' : undefined}
          mix={[
            blockBoxStyle,
            draggingBlockBoxStyle,
            blockDragVisual(),
            ref((node) => {
              blockElement = node
            }),
            on('click', (event) => {
              if (!event.shiftKey && event.target === event.currentTarget) {
                handle.props.onSelect(block, event)
              }

              if (event.target === event.currentTarget) {
                event.currentTarget.focus({ preventScroll: true })
              }
            }),
            on('dblclick', (event) => {
              if (event.target !== event.currentTarget) return

              event.preventDefault()
              startEditing()
            }),
            on('focus', (event) => {
              if (event.target !== event.currentTarget) return

              handle.props.onFocus(block)
            }),
            on('keydown', (event) => {
              if (event.target !== event.currentTarget) return

              if (event.key === 'Escape') {
                event.preventDefault()
                handle.props.onClearSelection()
                return
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                startEditing()
                return
              }

              if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault()
                handle.props.onDelete(block)
              }
            }),
            on('pointerdown', (event) => {
              if (state === 'editing') return

              if (event.shiftKey) {
                handle.props.onSelect(block, event)
                return
              }
              if (event.target instanceof HTMLInputElement) return

              handle.props.onPointerDown(block, event)

              event.preventDefault()
              if (event.target === event.currentTarget) {
                event.currentTarget.focus({ preventScroll: true })
              }
              handle.props.onDragStart(block, event)
            }),
          ]}
          tabIndex={0}
          style={{
            backgroundColor: blockBackgroundColor(block),
          }}
        >
          <input
            aria-label={handle.props.isDraft ? 'New block name' : `${label} name`}
            data-editable={isEditing ? 'true' : undefined}
            mix={[
              blockInputStyle,
              ref((node) => {
                inputElement = node
                if (handle.props.isDraft) node.focus({ preventScroll: true })
              }),
              on('input', (event) => {
                name = event.currentTarget.value
              }),
              on('keydown', (event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  if (handle.props.isDraft) {
                    handle.props.onCancelDraft()
                  } else {
                    cancelEditing()
                  }
                  return
                }

                if (event.key === 'Enter') {
                  event.preventDefault()
                  finishEditing('focus-block')
                }
              }),
              on('focus', (event) => {
                event.currentTarget.select()
              }),
              on('blur', () => {
                if (state === 'editing') finishEditing()
              }),
            ]}
            defaultValue={name}
            readOnly={!isEditing}
            tabIndex={isEditing ? 0 : -1}
            type="text"
          />
          {!isEditing ? (
            <>
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
            </>
          ) : null}
        </div>
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

  function startEditing() {
    state = 'editing'
    handle.update()
    inputElement?.focus({ preventScroll: true })
    inputElement?.select()
  }

  function finishEditing(after: 'focus-block' | 'none' = 'none') {
    if (state !== 'editing') return

    commit()
    state = 'idle'
    handle.update()

    if (after === 'focus-block' && blockElement) {
      blockElement.focus({ preventScroll: true })
    }
  }

  function cancelEditing() {
    name = lastCommittedName
    if (inputElement) {
      inputElement.value = lastCommittedName
      inputElement.setSelectionRange(0, 0)
    }
    state = 'idle'
    handle.update()
    blockElement?.focus({ preventScroll: true })
  }
}

function ResizeHandle(
  handle: Handle<{
    block: GridBlockDocument
    edge: ResizeEdge
    isActive: boolean
    onResizeStart: (block: GridBlockDocument, edge: ResizeEdge, event: PointerEvent) => void
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
        handle.props.edge === 'dayStart' ? dayStartResizeHandleStyle : dayEndResizeHandleStyle,
        on('pointerdown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          handle.props.onResizeStart(handle.props.block, handle.props.edge, event)
        }),
      ]}
    />
  )
}

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const firstSlotMinute = 0
const initialScrollMinute = 6 * 60 + 30
const slotMinutes = 15
const lastSlotMinute = 24 * 60
const timeSlots = Array.from(
  { length: (lastSlotMinute - firstSlotMinute) / slotMinutes },
  (_, index) => formatTimeSlot(firstSlotMinute + index * slotMinutes),
)

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

const scheduleLayoutPolicy = {
  dayMinutes: lastSlotMinute,
  minimumMinute: firstSlotMinute,
  slotMinutes,
}
const gridLabelWidth = 72
const gridRowHeight = 36
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

function pointerToDragPreview(event: PointerEvent, dragState: DragState): DragPreview {
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

function pointerToResizeMinute(event: PointerEvent, resizeState: ResizeState) {
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

function pointerToResizeDay(event: PointerEvent, resizeState: HorizontalResizeState) {
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

function copyBlock(block: GridBlockDocument): GridBlockDocument {
  return { ...block }
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
    .sort((left, right) => left.startMinute - right.startMinute || left.id.localeCompare(right.id))
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

function samePlacement(left: BlockPlacement, right: BlockPlacement) {
  return left.dayOfWeek === right.dayOfWeek && left.startMinute === right.startMinute
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

function blockBackgroundColor(block: GridBlockDocument) {
  let hue = hashString(block.name.trim().toLowerCase() || String(block.id)) % 360
  return `hsl(${hue} 78% 88%)`
}

function dragVisualTranslate(offset: DragVisualOffset | undefined) {
  if (!offset) return 'none'
  return `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px`
}

function formatTimeSlot(minuteOfDay: number) {
  let hour24 = Math.floor(minuteOfDay / 60) % 24
  let minute = minuteOfDay % 60
  let period = hour24 < 12 ? 'am' : 'pm'
  let hour12 = hour24 % 12 || 12

  return `${hour12}:${String(minute).padStart(2, '0')}${period}`
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
  gridTemplateRows: '56px 32px minmax(0, 1fr)',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  '&[data-schedule-dragging="true"], &[data-schedule-dragging="true"] *': {
    cursor: 'grabbing !important',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  '&[data-schedule-dragging="true"] .resize-handle': {
    opacity: '0 !important',
    pointerEvents: 'none',
  },
  '&[data-schedule-resizing="vertical"], &[data-schedule-resizing="vertical"] *': {
    cursor: 'ns-resize !important',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  '&[data-schedule-resizing="horizontal"], &[data-schedule-resizing="horizontal"] *': {
    cursor: 'ew-resize !important',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
})

const calendarHeaderStyle = css({
  alignItems: 'center',
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  gap: theme.space.sm,
  padding: `0 ${theme.space.md}`,
})

const calendarTitleStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  justifyContent: 'center',
  letterSpacing: theme.letterSpacing.tight,
})

const calendarActionsStyle = css({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  justifySelf: 'end',
})

const dayHeaderGridStyle = css({
  alignItems: 'end',
  borderBottom: `1px solid ${theme.colors.border.strong}`,
  display: 'grid',
  gridTemplateColumns: `${gridLabelWidth}px repeat(7, minmax(88px, 1fr))`,
  paddingRight: '10px',
})

const dayHeaderStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  padding: `2px ${theme.space.xs}`,
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
  gridTemplateColumns: `${gridLabelWidth}px repeat(7, minmax(88px, 1fr))`,
  minHeight: `${gridRowHeight}px`,
})

const timeLabelStyle = css({
  color: theme.colors.text.secondary,
  fontSize: '0.6875rem',
  padding: `0 ${theme.space.xs} 0 0`,
  textAlign: 'right',
  transform: 'translateY(-0.7em)',
})

const hourTimeLabelStyle = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
})

const timeCellStyle = css({
  borderLeft: `1px dashed ${theme.colors.border.default}`,
  borderTop: `1px dashed ${theme.colors.border.default}`,
  minHeight: `${gridRowHeight}px`,
})

const hourTimeCellStyle = css({
  borderTop: `1px solid ${theme.colors.border.strong}`,
})

const halfHourTimeCellStyle = css({
  borderTop: `1px dotted ${theme.colors.border.strong}`,
})

const spacerTimeCellStyle = css({
  borderLeft: `1px dashed ${theme.colors.border.default}`,
  minHeight: `${gridRowHeight}px`,
})

const blockLayerStyle = css({
  display: 'grid',
  gridTemplateColumns: `${gridLabelWidth}px repeat(7, minmax(88px, 1fr))`,
  gridAutoRows: `${gridRowHeight}px`,
  inset: 0,
  pointerEvents: 'none',
  position: 'absolute',
  zIndex: 1,
})

const blockGridItemStyle = css({
  display: 'grid',
  minHeight: 0,
  minWidth: 0,
  pointerEvents: 'none',
  position: 'relative',
  '&[data-dragging="true"]': {
    zIndex: 2,
  },
})

const blockGhostGridItemStyle = css({
  display: 'grid',
  minHeight: 0,
  minWidth: 0,
  pointerEvents: 'none',
  position: 'relative',
  zIndex: 1,
})

const blockGhostBoxStyle = css({
  backgroundColor: 'rgb(209 213 219 / 0.72)',
  border: `2px dashed ${theme.colors.text.secondary}`,
  borderRadius: theme.radius,
  margin: '2px 4px',
  opacity: 0.5,
})

const blockBoxStyle = css({
  alignItems: 'center',
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius,
  boxShadow: '0 1px 1px rgb(0 0 0 / 0.05)',
  color: '#111111',
  cursor: 'grab',
  display: 'flex',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  justifyContent: 'center',
  margin: '2px 4px',
  overflow: 'hidden',
  padding: theme.space.xs,
  pointerEvents: 'auto',
  position: 'relative',
  textAlign: 'center',
  touchAction: 'none',
  transition: 'background-color 120ms ease, border-color 120ms ease',
  userSelect: 'none',
  '&:not([data-dragging="true"])': {
    transition: 'background-color 120ms ease, border-color 120ms ease, translate 120ms ease',
  },
  '&:hover .resize-handle': {
    opacity: 1,
  },
  '&[data-resizing="true"] .resize-handle': {
    opacity: 1,
  },
  '&[data-editing="true"]': {
    cursor: 'text',
  },
  '&:focus, &[data-selected="true"]': {
    borderColor: theme.colors.focusRing,
    outline: `2px solid ${theme.colors.focusRing}`,
    outlineOffset: 0,
  },
})

const draggingBlockBoxStyle = css({
  '&[data-dragging="true"]': {
    backgroundColor: theme.surface.lvl2,
    borderColor: theme.colors.focusRing,
    cursor: 'grabbing',
    outline: `2px solid ${theme.colors.focusRing}`,
    outlineOffset: 0,
    zIndex: 2,
    '& .resize-handle': {
      opacity: 0,
    },
  },
})

const resizeHandleStyle = css({
  cursor: 'ns-resize',
  height: '12px',
  left: theme.space.xs,
  opacity: 0,
  position: 'absolute',
  right: theme.space.xs,
  touchAction: 'none',
  zIndex: 3,
  '&::before': {
    backgroundColor: theme.colors.focusRing,
    borderRadius: '999px',
    content: '""',
    height: '3px',
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '28px',
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
  bottom: theme.space.sm,
  cursor: 'ew-resize',
  opacity: 0,
  position: 'absolute',
  top: theme.space.sm,
  touchAction: 'none',
  width: '12px',
  zIndex: 3,
  '&::before': {
    backgroundColor: theme.colors.focusRing,
    borderRadius: '999px',
    content: '""',
    height: '20px',
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
  boxSizing: 'border-box',
  color: 'inherit',
  cursor: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  height: '100%',
  inset: 0,
  lineHeight: 1.2,
  outline: 0,
  padding: theme.space.xs,
  pointerEvents: 'none',
  position: 'absolute',
  textAlign: 'center',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  width: '100%',
  '&[data-editable="true"]': {
    pointerEvents: 'auto',
    userSelect: 'text',
    WebkitUserSelect: 'text',
  },
})

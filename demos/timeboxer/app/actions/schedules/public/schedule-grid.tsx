import { clientEntry, createMixin, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { animateLayout, spring } from '@remix-run/ui/animation'
import { button } from '../../../ui/public/button.ts'
import { theme } from '../../../ui/public/design.ts'

import { previewDeleteBlock } from './schedule-layout.ts'
import type { ResizeEdge, ScheduleLayoutBlock, ScheduleLayoutResult } from './schedule-layout.ts'
import {
  adjacentSelection,
  createDragState,
  createHorizontalResizeState,
  createResizeState,
  durationToSlotSpan,
  gridLabelWidth,
  gridRowHeight,
  initialScrollMinute,
  isHalfHourSlot,
  isHourSlot,
  measureGrid,
  moveDrag,
  moveHorizontalResize,
  moveResize,
  sameBlocks,
  slotMinutes,
  startMinuteToSlotIndex,
  timeSlots,
  timeToMinute,
  weekDays,
} from './schedule-grid-gestures.ts'
import type {
  DragVisualOffset,
  Gesture,
  GridInputId,
  HorizontalResizeEdge,
} from './schedule-grid-gestures.ts'

export type GridScheduleDocument = {
  blocks: ScheduleLayoutBlock[]
  id: number
  name: string
  revision: number
  updatedAt: number
}

type DraftBlock = ScheduleLayoutBlock & {
  id: string
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
    let gesture: Gesture | null = null
    let preview: ScheduleLayoutResult | null = null
    let gridElement: HTMLDivElement | null = null
    let scrollerElement: HTMLDivElement | null = null
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
        gesture = null
        preview = null
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

      let visibleBlocks = preview?.blocks ?? schedule.blocks
      let dragState = gesture?.kind === 'drag' ? gesture : null
      let resizeState = gesture?.kind === 'resize' ? gesture : null
      let horizontalResizeState = gesture?.kind === 'horizontal-resize' ? gesture : null
      let dragGhostBlocks = dragState
        ? visibleBlocks.filter((block) => dragState.blockIds.includes(block.id))
        : []

      return (
        <section
          aria-label="Weekly schedule"
          data-schedule-dragging={dragState ? 'true' : undefined}
          data-schedule-resizing={
            resizeState ? 'vertical' : horizontalResizeState ? 'horizontal' : undefined
          }
          mix={weekScheduleStyle}
        >
          <div mix={calendarHeaderStyle}>
            <div aria-hidden="true" />
            <div mix={calendarTitleStyle}>{schedule.name}</div>
            <div mix={calendarActionsStyle}>
              <a download href={handle.props.downloadIcsHref} mix={button()}>
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
                    isDragging={dragState?.blockIds.includes(block.id) === true}
                    isDraft={draftBlock?.id === block.id}
                    isHorizontalResizing={horizontalResizeState?.activeBlockId === block.id}
                    isResizing={resizeState?.blockId === block.id}
                    isSelected={selectedBlockIds.has(block.id)}
                    key={block.id}
                    shouldAnimateLayout={
                      dragState !== null && !dragState.blockIds.includes(block.id)
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

    function commitBlock(block: ScheduleLayoutBlock) {
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

    function deleteBlock(block: ScheduleLayoutBlock) {
      if (draftBlock?.id === block.id) {
        cancelDraft()
        return
      }

      let deleteIds = selectedBlockIds.has(block.id) ? Array.from(selectedBlockIds) : [block.id]
      let deleteIdSet = new Set(deleteIds)
      let nextBlocks = schedule.blocks
      for (let blockId of deleteIds) {
        nextBlocks = previewDeleteBlock(nextBlocks, blockId).blocks
      }

      schedule.blocks = nextBlocks
      selectedBlockIds = new Set(
        Array.from(selectedBlockIds).filter((blockId) => !deleteIdSet.has(blockId)),
      )
      if (selectionAnchorId && deleteIdSet.has(selectionAnchorId)) selectionAnchorId = null
      handle.update()
      saveSchedule()
    }

    function selectBlock(block: ScheduleLayoutBlock, event: MouseEvent) {
      if (draftBlock || gesture) return
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

    function focusBlock(block: ScheduleLayoutBlock) {
      if (draftBlock || gesture) return
      if (selectedBlockIds.size === 1 && selectedBlockIds.has(block.id)) return
      if (selectedBlockIds.size > 1 && selectedBlockIds.has(block.id)) return

      selectedBlockIds = new Set([block.id])
      selectionAnchorId = block.id
      handle.update()
    }

    function prepareBlockPointerDown(block: ScheduleLayoutBlock, event: PointerEvent) {
      if (draftBlock || gesture || event.shiftKey) {
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

    function startDrag(block: ScheduleLayoutBlock, event: PointerEvent) {
      if (draftBlock || gesture || event.button !== 0 || !gridElement) return

      let blockIds = selectedBlockIds.has(block.id) ? Array.from(selectedBlockIds) : [block.id]
      if (!selectedBlockIds.has(block.id)) {
        selectedBlockIds = new Set(blockIds)
        selectionAnchorId = block.id
      }

      startGesture(
        createDragState(block, blockIds, schedule.blocks, measureGrid(gridElement), event),
      )
    }

    function startResize(block: ScheduleLayoutBlock, edge: ResizeEdge, event: PointerEvent) {
      if (!canStartResize(block, event) || !gridElement) return

      clearOtherBlockFocusOrSelection(block.id)
      startGesture(createResizeState(block, edge, schedule.blocks, measureGrid(gridElement), event))
    }

    function startHorizontalResize(
      block: ScheduleLayoutBlock,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) {
      if (!canStartResize(block, event) || !gridElement) return

      clearOtherBlockFocusOrSelection(block.id)
      let idPrefix = `repeat-${++horizontalResizeSequence}-${Date.now().toString(36)}`
      startGesture(
        createHorizontalResizeState(
          block,
          edge,
          idPrefix,
          schedule.blocks,
          measureGrid(gridElement),
          event,
        ),
      )
    }

    function canStartResize(block: ScheduleLayoutBlock, event: PointerEvent) {
      return (!draftBlock || draftBlock.id === block.id) && !gesture && event.button === 0
    }

    function startGesture(nextGesture: Gesture) {
      gesture = nextGesture
      window.addEventListener('pointermove', handleWindowPointerMove)
      window.addEventListener('pointerup', handleWindowPointerEnd)
      window.addEventListener('pointercancel', handleWindowPointerEnd)
      handle.update()
    }

    function handleWindowPointerMove(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return

      let nextPreview =
        gesture.kind === 'drag'
          ? moveDrag(gesture, event, dispatchDragVisualOffset)
          : gesture.kind === 'resize'
            ? moveResize(gesture, event)
            : moveHorizontalResize(gesture, event)

      if (nextPreview) updatePreview(nextPreview)
    }

    function handleWindowPointerEnd(event: PointerEvent) {
      if (!gesture || gesture.pointerId !== event.pointerId) return

      let endedGesture = gesture
      gesture = null
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerEnd)
      window.removeEventListener('pointercancel', handleWindowPointerEnd)

      let finalPreview = endedGesture.moved && preview && !preview.unresolved ? preview : null

      if (endedGesture.kind === 'drag') {
        if (endedGesture.moved) suppressSelectionClickUntil = performance.now() + 250
        dispatchDragVisualOffset(endedGesture.blockIds, { x: 0, y: 0 })
        if (finalPreview) selectedBlockIds = new Set(endedGesture.blockIds)
      }

      preview = null
      if (finalPreview) {
        event.preventDefault()
        schedule.blocks = finalPreview.blocks
        saveSchedule()
      }
      handle.update()
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
          'Content-Type': 'application/json',
          'X-Csrf-Token': handle.props.csrfToken,
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
    block: ScheduleLayoutBlock
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
    block: ScheduleLayoutBlock
    isDragging: boolean
    isDraft: boolean
    isHorizontalResizing: boolean
    isResizing: boolean
    isSelected: boolean
    shouldAnimateLayout: boolean
    onCancelDraft: () => void
    onClearSelection: () => void
    onCommit: (block: ScheduleLayoutBlock) => void
    onDelete: (block: ScheduleLayoutBlock) => void
    onDragStart: (block: ScheduleLayoutBlock, event: PointerEvent) => void
    onFocus: (block: ScheduleLayoutBlock) => void
    onHorizontalResizeStart: (
      block: ScheduleLayoutBlock,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) => void
    onPointerDown: (block: ScheduleLayoutBlock, event: PointerEvent) => void
    onResizeStart: (block: ScheduleLayoutBlock, edge: ResizeEdge, event: PointerEvent) => void
    onSelect: (block: ScheduleLayoutBlock, event: MouseEvent) => void
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
    block: ScheduleLayoutBlock
    edge: ResizeEdge
    isActive: boolean
    onResizeStart: (block: ScheduleLayoutBlock, edge: ResizeEdge, event: PointerEvent) => void
  }>,
) {
  return () => (
    <div
      aria-label={`${handle.props.edge === 'start' ? 'Start' : 'End'} resize handle`}
      class="resize-handle"
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
    block: ScheduleLayoutBlock
    edge: HorizontalResizeEdge
    isActive: boolean
    onResizeStart: (
      block: ScheduleLayoutBlock,
      edge: HorizontalResizeEdge,
      event: PointerEvent,
    ) => void
  }>,
) {
  return () => (
    <div
      aria-label={`${handle.props.edge === 'dayStart' ? 'First day' : 'Last day'} resize handle`}
      class="resize-handle"
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

function focusedScheduleBlockElement() {
  let activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return null

  return activeElement.closest('[data-schedule-block="true"]') as HTMLElement | null
}

function blockBackgroundColor(block: ScheduleLayoutBlock) {
  let hue = hashString(block.name.trim().toLowerCase() || String(block.id)) % 360
  return `hsl(${hue} 78% 88%)`
}

function dragVisualTranslate(offset: DragVisualOffset | undefined) {
  if (!offset) return 'none'
  return `${offset.x.toFixed(2)}px ${offset.y.toFixed(2)}px`
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

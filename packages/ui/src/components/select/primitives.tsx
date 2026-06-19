import {
  attrs,
  createMixin,
  on,
  ref,
  type Dispatched,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type MixinFactory,
  type Props,
  type RemixNode,
} from '@remix-run/ui'
import * as listbox from '../listbox/index.ts'
import * as popover from '../popover/index.ts'
import { hiddenTypeahead } from '../../interactions/typeahead/typeahead-mixin.ts'
import { onKeyDown } from '../../interactions/keydown/keydown.ts'
import { waitForCssTransition } from '../../utils/wait-for-css-transition.ts'
import { wait } from '../../utils/wait.ts'
import type { AnchorOptions } from '../anchor/index.ts'

const SELECT_CHANGE_EVENT = 'rmx:select-change' as const
const DEFAULT_LABEL_SWAP_DELAY_MS = 75

type SelectChangeHandler<target extends HTMLElement> = (
  event: Dispatched<SelectChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

declare global {
  interface HTMLElementEventMap {
    [SELECT_CHANGE_EVENT]: SelectChangeEvent
  }
}

export class SelectChangeEvent extends Event {
  readonly label: string | null
  readonly optionId: string | null
  readonly value: string | null

  constructor({
    label,
    optionId,
    value,
  }: {
    label: string | null
    optionId: string | null
    value: string | null
  }) {
    super(SELECT_CHANGE_EVENT, { bubbles: true })
    this.label = label
    this.optionId = optionId
    this.value = value
  }
}

export interface SelectContextProps {
  children?: RemixNode
  defaultLabel: string
  defaultValue?: string | null
  disabled?: boolean
  labelSwapDelayMs?: number
  name?: string
}

export interface SelectProps extends Omit<Props<'button'>, 'children' | 'name'> {
  children?: RemixNode
  defaultLabel: string
  defaultValue?: string | null
  name?: string
}

export type SelectOptionProps = Props<'div'> & Omit<listbox.ListboxOption, 'id'>

type State = 'initializing' | 'closed' | 'open' | 'selecting'

type PendingChange = {
  label: string | null
  optionId: string | null
  value: string | null
} | null

interface SelectContextValue {
  readonly activeId: string | undefined
  readonly disabled: boolean
  readonly displayedLabel: string
  readonly isExpanded: boolean
  readonly isOpen: boolean
  readonly listId: string
  readonly name: string | undefined
  readonly selectedId: string | undefined
  readonly value: listbox.ListboxValue
  close: () => void
  open: () => void
  registerPopoverContext: (context: popover.PopoverContext) => void
  registerSurface: (node: HTMLElement) => void
  registerTrigger: (node: HTMLButtonElement) => void
  selectTypeaheadMatch: (text: string) => void
  syncPopoverMinWidth: () => void
  unregisterPopoverContext: (context: popover.PopoverContext) => void
  unregisterSurface: (node: HTMLElement) => void
  unregisterTrigger: (node: HTMLButtonElement) => void
}

function SelectProvider(handle: Handle<SelectContextProps, SelectContextValue>): () => RemixNode {
  let triggerRef: HTMLButtonElement | undefined
  let listboxRef: listbox.ListboxRef | undefined
  let surfaceRef: HTMLElement | undefined
  let popoverContextRef: popover.PopoverContext | undefined

  let state: State = 'initializing'

  let value: listbox.ListboxValue = null
  let activeValue: listbox.ListboxValue = null
  let activeId: string | undefined = undefined
  let selectedId: string | undefined = undefined
  let selectedLabel = ''
  let displayedLabel = ''
  let pendingChange: PendingChange = null

  let listId = `${handle.id}-list`

  function open() {
    if (state !== 'closed' || handle.props.disabled) return
    state = 'open'
    activeValue = value
    handle.update()
  }

  function syncPopoverMinWidth() {
    if (state !== 'open' || !surfaceRef || !triggerRef) {
      return
    }

    surfaceRef.style.minWidth = `${triggerRef.offsetWidth}px`
  }

  function getPopoverAnchorOptions(): AnchorOptions {
    return {
      placement: 'left',
      inset: true,
      relativeTo: selectedId ? `#${selectedId}` : '[role="option"]',
    }
  }

  function syncPopoverContext() {
    if (!popoverContextRef) {
      return
    }

    popoverContextRef.hideFocusTarget = triggerRef ?? null
    popoverContextRef.anchor = triggerRef
      ? {
          target: triggerRef,
          options: getPopoverAnchorOptions(),
        }
      : null
  }

  function close() {
    if (state !== 'open') return
    state = 'closed'
    handle.update()
  }

  function setSelectedOption(
    nextValue: listbox.ListboxValue,
    option: listbox.ListboxOption | undefined,
    syncDisplayedLabel = false,
  ) {
    value = nextValue
    activeValue = nextValue
    activeId = option?.id
    selectedId = option?.id
    selectedLabel = option ? option.label : handle.props.defaultLabel
    syncPopoverContext()

    if (syncDisplayedLabel) {
      displayedLabel = selectedLabel
    }
  }

  function getPendingChange(
    nextValue: listbox.ListboxValue,
    option: listbox.ListboxOption | undefined,
  ): PendingChange {
    if (!option || value === nextValue) {
      return null
    }

    return {
      label: option.label,
      optionId: option.id,
      value: option.value,
    }
  }

  function dispatchChange(change: PendingChange) {
    if (!change) {
      return
    }

    let target = triggerRef ?? surfaceRef
    target?.dispatchEvent(new SelectChangeEvent(change))
  }

  function selectOption(
    nextValue: listbox.ListboxValue,
    option: listbox.ListboxOption | undefined,
  ) {
    if (state !== 'open') return
    pendingChange = getPendingChange(nextValue, option)
    setSelectedOption(nextValue, option)
    handle.update()
  }

  async function settleSelectedOption() {
    if (state !== 'open') return

    let change = pendingChange
    pendingChange = null
    state = 'selecting'

    if (!surfaceRef) {
      displayedLabel = selectedLabel
      state = 'closed'
      let signal = await handle.update()
      if (signal.aborted) return
      dispatchChange(change)
      return
    }

    await Promise.all([handle.update(), waitForCssTransition(surfaceRef, handle.signal)])
    await wait(handle.props.labelSwapDelayMs ?? DEFAULT_LABEL_SWAP_DELAY_MS)
    if (handle.signal.aborted) return
    displayedLabel = selectedLabel
    state = 'closed'
    let signal = await handle.update()
    if (signal.aborted) return
    dispatchChange(change)
  }

  function selectTypeaheadMatch(text: string) {
    if (state !== 'closed' || handle.props.disabled) return

    let option = listboxRef?.matchSearchText(text, value)
    if (!option) return

    let change = getPendingChange(option.value, option)
    pendingChange = null
    setSelectedOption(option.value, option, true)
    void handle.update().then((signal) => {
      if (signal.aborted) return
      dispatchChange(change)
    })
  }

  function highlightOption(
    nextActiveValue: listbox.ListboxValue,
    option: listbox.ListboxOption | undefined,
  ) {
    if (state !== 'open') return
    activeValue = nextActiveValue
    activeId = option?.id
    handle.update()
  }

  handle.context.set({
    get activeId() {
      return activeId
    },

    get disabled() {
      return !!handle.props.disabled
    },

    get displayedLabel() {
      return displayedLabel
    },

    get isExpanded() {
      return state === 'open' || state === 'selecting'
    },

    get isOpen() {
      return state === 'open'
    },

    get listId() {
      return listId
    },

    get name() {
      return handle.props.name
    },

    get selectedId() {
      return selectedId
    },

    get value() {
      return value
    },

    close,

    open,

    registerSurface(node) {
      surfaceRef = node
    },

    registerTrigger(node) {
      triggerRef = node
      syncPopoverContext()
    },

    registerPopoverContext(context) {
      popoverContextRef = context
      syncPopoverContext()
    },

    selectTypeaheadMatch,

    syncPopoverMinWidth,

    unregisterSurface(node) {
      if (surfaceRef === node) {
        surfaceRef = undefined
      }
    },

    unregisterPopoverContext(context) {
      if (popoverContextRef !== context) {
        return
      }

      popoverContextRef.anchor = null
      popoverContextRef.hideFocusTarget = null
      popoverContextRef = undefined
    },

    unregisterTrigger(node) {
      if (triggerRef === node) {
        triggerRef = undefined
        syncPopoverContext()
      }
    },
  })

  return () => {
    if (state === 'initializing') {
      selectedLabel = displayedLabel = handle.props.defaultLabel
      value = handle.props.defaultValue ?? null
      activeValue = value
      state = 'closed'

      handle.queueTask(() => {
        if (selectedId || !surfaceRef) {
          return
        }

        let selected = surfaceRef.querySelector(`[aria-selected="true"]`)
        if (selected && !selectedId) {
          selectedId = selected.id
          syncPopoverContext()
          handle.update()
        }
      })
    }

    return (
      <listbox.Context
        flashSelection
        ref={(nextListboxRef: listbox.ListboxRef) => {
          listboxRef = nextListboxRef
        }}
        value={value}
        activeValue={activeValue}
        onSelectSettled={settleSelectedOption}
        onSelect={selectOption}
        onHighlight={highlightOption}
        selectionFlashAttribute="data-select-flash"
      >
        {handle.props.children}
      </listbox.Context>
    )
  }
}

function getSelectContext(handle: Handle | MixinHandle) {
  return handle.context.get(SelectProvider)
}

const triggerMixin: MixinFactory<HTMLButtonElement, [], ElementProps> = createMixin<
  HTMLButtonElement,
  [],
  ElementProps
>((handle) => {
  let context = getSelectContext(handle)

  return (props) => [
    attrs({
      'aria-haspopup': 'listbox',
      'aria-expanded': context.isExpanded ? 'true' : 'false',
      'aria-controls': context.listId,
      'aria-describedby': context.selectedId,
      disabled: context.disabled ? true : props.disabled,
    }),
    ref((node: HTMLButtonElement, signal) => {
      context.registerTrigger(node)
      signal.addEventListener('abort', () => {
        context.unregisterTrigger(node)
      })
    }),
    hiddenTypeahead((text) => {
      context.selectTypeaheadMatch(text)
    }),
    on('click', () => {
      context.open()
    }),
    onKeyDown('ArrowDown', () => {
      context.open()
    }),
    onKeyDown('ArrowUp', () => {
      context.open()
    }),
  ]
})

const popoverMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSelectContext(handle)
  let popoverState = handle.context.get(popover.Context)

  return () => [
    ref((node: HTMLElement, signal) => {
      context.registerSurface(node)
      context.registerPopoverContext(popoverState)
      signal.addEventListener('abort', () => {
        context.unregisterSurface(node)
        context.unregisterPopoverContext(popoverState)
      })
    }),
    popover.surface({
      open: context.isOpen,
      onHide: context.close,
    }),
    on('beforetoggle', (event) => {
      if (event.newState === 'open') {
        context.syncPopoverMinWidth()
      }
    }),
  ]
})

const listMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getSelectContext(handle)

  return () => [
    attrs({
      id: context.listId,
      'aria-activedescendant': context.activeId,
    }),
    popover.focusOnShow(),
    listbox.list(),
  ]
})

const hiddenInputMixin: MixinFactory<HTMLInputElement, [], ElementProps> = createMixin<
  HTMLInputElement,
  [],
  ElementProps
>((handle) => {
  let context = getSelectContext(handle)

  return () =>
    attrs({
      disabled: context.disabled ? true : undefined,
      name: context.name,
      type: 'hidden',
      value: context.value ?? '',
    })
})

export const Context = SelectProvider
export const hiddenInput = hiddenInputMixin
export const list = listMixin
export const option = listbox.option
export { popoverMixin as popover }
export const trigger = triggerMixin

const select = {
  Context,
  hiddenInput,
  list,
  option,
  popover: popoverMixin,
  trigger,
} as const

export function onSelectChange<target extends HTMLElement>(
  handler: SelectChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof SELECT_CHANGE_EVENT>> {
  return on(SELECT_CHANGE_EVENT, handler, captureBoolean)
}

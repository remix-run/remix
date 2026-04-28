// @jsxRuntime classic
// @jsx createElement
import {
  attrs,
  createElement,
  createMixin,
  css,
  on,
  ref,
  type CSSMixinDescriptor,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type Props,
  type RemixNode,
} from '@remix-run/component'
import * as button from '../button/button.tsx'
import { Glyph } from '../glyph/glyph.tsx'
import * as listbox from '../listbox/listbox.ts'
import * as popover from '../popover/popover.ts'
import { theme } from '../theme/theme.ts'
import { hiddenTypeahead } from '../typeahead/typeahead-mixin.ts'
import { onKeyDown } from '../keydown/keydown.ts'
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'
import { wait } from '../utils/wait.ts'
import type { AnchorOptions } from '../anchor/anchor.ts'

const SELECT_CHANGE_EVENT = 'rmx:select-change' as const
const LABEL_SWAP_DELAY_MS = 75

type SelectChangeHandler = (event: SelectChangeEvent, signal: AbortSignal) => void | Promise<void>

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
  name?: string
}

export interface SelectProps extends Omit<Props<'button'>, 'children' | 'name'> {
  children?: RemixNode
  defaultLabel: string
  defaultValue?: string | null
  name?: string
}

export type SelectOptionProps = Props<'div'> & Omit<listbox.ListboxOption, 'id'>

enum State {
  Initializing = 'initializing',
  Closed = 'closed',
  Open = 'open',
  Selecting = 'selecting',
}

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

function SelectProvider(handle: Handle<SelectContextProps, SelectContextValue>) {
  let triggerRef: HTMLButtonElement | undefined
  let listboxRef: listbox.ListboxRef | undefined
  let surfaceRef: HTMLElement | undefined
  let popoverContextRef: popover.PopoverContext | undefined

  let state: State = State.Initializing

  let value: listbox.ListboxValue = null
  let activeValue: listbox.ListboxValue = null
  let activeId: string | undefined = undefined
  let selectedId: string | undefined = undefined
  let selectedLabel = ''
  let displayedLabel = ''
  let pendingChange: PendingChange = null

  let listId = `${handle.id}-list`

  function open() {
    if (state !== State.Closed || handle.props.disabled) return
    state = State.Open
    activeValue = value
    handle.update()
  }

  function syncPopoverMinWidth() {
    if (state !== State.Open || !surfaceRef || !triggerRef) {
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
          node: triggerRef,
          options: getPopoverAnchorOptions(),
        }
      : null
  }

  function close() {
    if (state !== State.Open) return
    state = State.Closed
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
    if (state !== State.Open) return
    pendingChange = getPendingChange(nextValue, option)
    setSelectedOption(nextValue, option)
    handle.update()
  }

  async function settleSelectedOption() {
    if (state !== State.Open) return

    let change = pendingChange
    pendingChange = null
    state = State.Selecting

    if (!surfaceRef) {
      displayedLabel = selectedLabel
      state = State.Closed
      let signal = await handle.update()
      if (signal.aborted) return
      dispatchChange(change)
      return
    }

    await Promise.all([handle.update(), waitForCssTransition(surfaceRef, handle.signal)])
    await wait(LABEL_SWAP_DELAY_MS) // UX delay label swap for clear value change
    if (handle.signal.aborted) return
    displayedLabel = selectedLabel
    state = State.Closed
    let signal = await handle.update()
    if (signal.aborted) return
    dispatchChange(change)
  }

  function selectTypeaheadMatch(text: string) {
    if (state !== State.Closed || handle.props.disabled) return

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
    if (state !== State.Open) return
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
      return state === State.Open || state === State.Selecting
    },

    get isOpen() {
      return state === State.Open
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
    if (state === State.Initializing) {
      selectedLabel = displayedLabel = handle.props.defaultLabel
      value = handle.props.defaultValue ?? null
      activeValue = value
      state = State.Closed

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

const triggerMixin = createMixin<HTMLButtonElement, [], ElementProps>((handle) => {
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

const popoverMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
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

const listMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
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

const hiddenInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let context = getSelectContext(handle)

  return () =>
    attrs({
      disabled: context.disabled ? true : undefined,
      name: context.name,
      type: 'hidden',
      value: context.value ?? '',
    })
})

const selectTriggerCss: CSSMixinDescriptor = css({
  minHeight: theme.control.height.sm,
  width: '100%',
  paddingInline: theme.space.md,
  paddingInlineEnd: theme.space.sm,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundImage: 'none',
  border: '0.5px solid transparent',
  boxShadow: 'none',
  fontSize: theme.fontSize.xs,
  textAlign: 'left',
  backgroundColor: theme.surface.lvl3,
  color: theme.colors.text.secondary,
  '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible':
    {
      backgroundColor: theme.surface.lvl4,
      color: theme.colors.text.primary,
    },
  '&:active': {
    backgroundColor: theme.surface.lvl3,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.6,
  },
})

export const triggerStyle = selectTriggerCss
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

export function onSelectChange(handler: SelectChangeHandler, captureBoolean?: boolean) {
  return on<HTMLElement, typeof SELECT_CHANGE_EVENT>(SELECT_CHANGE_EVENT, handler, captureBoolean)
}

function SelectLabel(handle: Handle) {
  let context = getSelectContext(handle)

  return () => <span mix={button.labelStyle}>{context.displayedLabel}</span>
}

export function Select(handle: Handle<SelectProps>) {
  return () => {
    let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = handle.props

    return (
      <select.Context
        defaultLabel={defaultLabel}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
      >
        <button {...buttonProps} mix={[button.baseStyle, triggerStyle, select.trigger(), mix]}>
          <SelectLabel />
          <Glyph mix={button.iconStyle} name="chevronVertical" />
        </button>
        <popover.Context>
          <div mix={[popover.surfaceStyle, select.popover()]}>
            <div mix={[popover.contentStyle, listbox.listStyle, select.list()]}>{children}</div>
          </div>
        </popover.Context>
        {name && <input mix={select.hiddenInput()} />}
      </select.Context>
    )
  }
}

export function Option(handle: Handle<SelectOptionProps>) {
  return () => {
    let { label, value, disabled, textValue, children, mix, ...divProps } = handle.props

    return (
      <div
        {...divProps}
        mix={[listbox.optionStyle, select.option({ value, label, disabled, textValue }), mix]}
      >
        <Glyph mix={listbox.glyphStyle} name="check" />
        <span mix={listbox.labelStyle}>{children ?? handle.props.label}</span>
      </div>
    )
  }
}

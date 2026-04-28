// @jsxRuntime classic
// @jsx createElement
import {
  attrs,
  css,
  createElement,
  createMixin,
  on,
  ref,
  type CSSMixinDescriptor,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'

import { Glyph } from '../glyph/glyph.tsx'
import * as listbox from '../listbox/listbox.ts'
import * as popover from '../popover/popover.ts'
import { theme } from '../../theme/theme.ts'
import { type SearchValue } from '../../interactions/typeahead/typeahead-mixin.ts'
import { waitForCssTransition } from '../../utils/wait-for-css-transition.ts'
import { wait } from '../../utils/wait.ts'

const COMBOBOX_CHANGE_EVENT = 'rmx:combobox-change' as const
const INPUT_COMMIT_DELAY_MS = 50

type ComboboxChangeHandler = (
  event: ComboboxChangeEvent,
  signal: AbortSignal,
) => void | Promise<void>

type ShowReason = 'hint' | 'nav'

const comboboxPopoverCss: CSSMixinDescriptor = css({
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
  },
  '&[data-show-reason="nav"]:not(:popover-open)': {
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
  '&[data-show-reason="hint"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})

const comboboxInputCss: CSSMixinDescriptor = css({
  minHeight: theme.control.height.sm,
  width: '100%',
  paddingInline: theme.space.sm,
  border: `0.5px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.7)',
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: theme.space.none,
  },
  '&[data-surface-visible="true"][aria-activedescendant]:focus-visible': {
    outline: 'none',
  },
})

export const inputStyle = comboboxInputCss
export const popoverStyle = comboboxPopoverCss

declare global {
  interface HTMLElementEventMap {
    [COMBOBOX_CHANGE_EVENT]: ComboboxChangeEvent
  }
}

export class ComboboxChangeEvent extends Event {
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
    super(COMBOBOX_CHANGE_EVENT, { bubbles: true })
    this.label = label
    this.optionId = optionId
    this.value = value
  }
}

export type ComboboxOpenStrategy = 'selected' | 'selected-or-none' | 'first' | 'last'

export interface ComboboxHandle {
  readonly activeOptionId: string | null
  readonly id: string
  readonly inputText: string
  readonly isOpen: boolean
  readonly label: string | null
  readonly value: string | null
  close: () => void
  open: (strategy?: ComboboxOpenStrategy) => Promise<void>
}

export interface ComboboxContextProps {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  name?: string
  ref?: (handle: ComboboxHandle) => void
}

export interface ComboboxProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  inputId?: string
  name?: string
  placeholder?: string
}

export interface ComboboxOptionOptions {
  disabled?: boolean
  label: string
  searchValue?: SearchValue
  value: string
}

export interface ComboboxOptionProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
  disabled?: boolean
  label: string
  searchValue?: SearchValue
  value: string
}

interface ComboboxContextValue {
  readonly activeId: string | undefined
  readonly disabled: boolean
  readonly filterText: string
  readonly inputText: string
  readonly isOpen: boolean
  readonly listId: string
  readonly name: string | undefined
  readonly showReason: ShowReason
  readonly surfaceVisible: boolean
  readonly value: listbox.ListboxValue
  clearInputSelection: () => void
  close: () => void
  handleBlur: () => void
  handleEscape: () => void
  navigateNext: () => void
  navigatePrevious: () => void
  open: (strategy?: ComboboxOpenStrategy) => Promise<void>
  openFromArrow: (direction: 'first' | 'last') => Promise<void>
  openFromInputActivation: () => Promise<void>
  registerInput: (node: HTMLInputElement) => void
  registerSurface: (node: HTMLElement) => void
  setInputText: (text: string) => Promise<void>
  syncPopoverMinWidth: () => void
  selectActive: () => Promise<void>
  unregisterInput: (node: HTMLInputElement) => void
  unregisterSurface: (node: HTMLElement) => void
}

type PendingChange = {
  label: string
  optionId: string
  value: string
} | null

function getSearchValues(value: SearchValue) {
  return Array.isArray(value) ? value : [value]
}

function matchesSearchValue(value: SearchValue, text: string) {
  if (text === '') {
    return true
  }

  let normalizedText = text.toLowerCase()
  return getSearchValues(value).some((candidate) =>
    candidate.toLowerCase().startsWith(normalizedText),
  )
}

function matchesExactSearchValue(value: SearchValue, text: string) {
  if (text === '') {
    return false
  }

  let normalizedText = text.toLowerCase()
  return getSearchValues(value).some((candidate) => candidate.toLowerCase() === normalizedText)
}

function getOptionSearchValue(option: {
  label: string
  searchValue?: SearchValue
  textValue?: SearchValue
}) {
  return option.searchValue ?? option.textValue ?? option.label
}

function ComboboxProvider(handle: Handle<ComboboxContextProps, ComboboxContextValue>) {
  let inputRef: HTMLInputElement | undefined
  let listboxRef: listbox.ListboxRef | undefined
  let surfaceRef: HTMLElement | undefined

  let hasInitialized = false
  let hasProvidedRef = false

  let activeValue: listbox.ListboxValue = null
  let activeId: string | undefined = undefined
  let value: listbox.ListboxValue = null
  let selectedId: string | undefined = undefined
  let selectedLabel = ''
  let inputText = ''
  let filterText = ''
  let open = false
  let surfaceVisible = false
  let showReason: ShowReason = 'nav'
  let pendingInputValue: string | null = null
  let pendingChange: PendingChange = null
  let selectInputAfterClose = false
  let closeSequenceId = 0

  let listId = `${handle.id}-combobox-list`

  function getOptions() {
    return listboxRef?.options ?? []
  }

  function getSelectedOption() {
    return getOptions().find((option) => option.value === value)
  }

  function getMatchingOptions(text: string) {
    if (text === '') {
      return getOptions()
    }

    return getOptions().filter((option) =>
      matchesSearchValue(option.textValue ?? option.label, text),
    )
  }

  function getEnabledMatchingOptions(text: string) {
    return getMatchingOptions(text).filter((option) => !option.disabled)
  }

  function getExactInputMatch(text = inputText) {
    return (
      getOptions().find(
        (option) =>
          !option.disabled && matchesExactSearchValue(option.textValue ?? option.label, text),
      ) ?? null
    )
  }

  function getOpenFilterText() {
    if (inputText === '') {
      return ''
    }

    if (getExactInputMatch(inputText)) {
      return ''
    }

    if (getMatchingOptions(inputText).length === 0) {
      return ''
    }

    return inputText
  }

  function resolveOpenOption(strategy: ComboboxOpenStrategy, nextFilterText: string) {
    let enabledMatchingOptions = getEnabledMatchingOptions(nextFilterText)
    if (enabledMatchingOptions.length === 0) {
      return null
    }

    if (strategy === 'selected-or-none') {
      let selectedOption = getSelectedOption()
      if (
        selectedOption &&
        !selectedOption.disabled &&
        matchesSearchValue(selectedOption.textValue ?? selectedOption.label, nextFilterText)
      ) {
        return selectedOption
      }

      return null
    }

    if (strategy === 'selected') {
      let exactInputMatch = getExactInputMatch(inputText)
      if (
        exactInputMatch &&
        matchesSearchValue(exactInputMatch.textValue ?? exactInputMatch.label, nextFilterText)
      ) {
        return exactInputMatch
      }

      let selectedOption = getSelectedOption()
      if (
        selectedOption &&
        !selectedOption.disabled &&
        matchesSearchValue(selectedOption.textValue ?? selectedOption.label, nextFilterText)
      ) {
        return selectedOption
      }
    }

    return strategy === 'last'
      ? enabledMatchingOptions[enabledMatchingOptions.length - 1]
      : enabledMatchingOptions[0]
  }

  function setInputValue(nextValue: string) {
    if (!inputRef || inputRef.value === nextValue) {
      return
    }

    inputRef.value = nextValue
  }

  function clearInputSelection() {
    if (!inputRef || inputRef.selectionStart === null || inputRef.selectionEnd === null) {
      return
    }

    let cursor = inputRef.value.length
    if (inputRef.selectionStart === cursor && inputRef.selectionEnd === cursor) {
      return
    }

    inputRef.setSelectionRange(cursor, cursor)
  }

  function syncPopoverMinWidth() {
    if (!surfaceRef || !inputRef) {
      return
    }

    let width = inputRef.offsetWidth
    if (width <= 0) {
      return
    }

    surfaceRef.style.minWidth = `${width}px`
  }

  function dispatchChange(selection: {
    label: string | null
    optionId: string | null
    value: string | null
  }) {
    let target = inputRef ?? surfaceRef
    target?.dispatchEvent(
      new ComboboxChangeEvent({
        label: selection.label,
        optionId: selection.optionId,
        value: selection.value,
      }),
    )
  }

  function clearCommittedSelection() {
    let selectionChanged = value !== null || selectedId !== undefined
    value = null
    selectedId = undefined
    selectedLabel = ''
    return selectionChanged
  }

  function clearInputAndSelection() {
    closeSequenceId++
    pendingInputValue = null
    pendingChange = null
    selectInputAfterClose = false

    inputText = ''
    activeValue = null
    activeId = undefined
    if (!open) {
      filterText = ''
    }

    let selectionChanged = clearCommittedSelection()
    setInputValue('')

    if (selectionChanged) {
      dispatchChange({ label: null, optionId: null, value: null })
    }
  }

  async function closePopover() {
    if (!open) {
      return
    }

    let closeId = ++closeSequenceId
    let shouldWaitForTransition = showReason === 'nav'
    open = false

    if (!shouldWaitForTransition) {
      surfaceVisible = false
      filterText = ''
      activeValue = null
      activeId = undefined
      await handle.update()
      return
    }

    let signal = await handle.update()
    if (signal.aborted || closeId !== closeSequenceId || open) {
      return
    }

    if (surfaceRef?.isConnected) {
      await waitForCssTransition(surfaceRef, signal)
    }

    if (signal.aborted || closeId !== closeSequenceId || open) {
      return
    }

    surfaceVisible = false
    filterText = ''
    activeValue = null
    activeId = undefined

    signal = await handle.update()
    if (signal.aborted || closeId !== closeSequenceId || open) {
      return
    }

    if (pendingInputValue !== null) {
      let nextValue = pendingInputValue
      await wait(INPUT_COMMIT_DELAY_MS)
      if (
        signal.aborted ||
        closeId !== closeSequenceId ||
        open ||
        pendingInputValue !== nextValue
      ) {
        return
      }

      setInputValue(nextValue)
      pendingInputValue = null
    }

    if (selectInputAfterClose && inputRef?.isConnected && document.activeElement === inputRef) {
      inputRef.select()
    }

    selectInputAfterClose = false
  }

  async function openPopover(
    strategy: ComboboxOpenStrategy = 'selected',
    nextShowReason: ShowReason = 'nav',
  ) {
    if (handle.props.disabled) {
      return
    }

    if (pendingInputValue !== null) {
      setInputValue(pendingInputValue)
      pendingInputValue = null
    }

    closeSequenceId++
    selectInputAfterClose = false

    let nextFilterText = getOpenFilterText()
    let matchingOptions = getMatchingOptions(nextFilterText)
    if (matchingOptions.length === 0) {
      return
    }

    let activeOption = resolveOpenOption(strategy, nextFilterText)

    filterText = nextFilterText
    showReason = nextShowReason
    open = true
    surfaceVisible = true
    activeValue = activeOption?.value ?? null
    activeId = activeOption?.id

    let signal = await handle.update()
    if (signal.aborted) {
      return
    }

    listboxRef?.scrollActiveOptionIntoView()
  }

  function beginSelection(
    nextValue: listbox.ListboxValue,
    option: listbox.ListboxRegisteredOption | undefined,
  ) {
    if (!option) {
      return
    }

    let selectionChanged = value !== nextValue
    value = nextValue
    selectedId = option.id
    selectedLabel = option.label
    activeValue = nextValue
    activeId = option.id
    inputText = option.label
    showReason = 'nav'
    pendingInputValue = inputRef?.value === option.label ? null : option.label
    pendingChange = selectionChanged
      ? {
          label: option.label,
          optionId: option.id,
          value: option.value,
        }
      : null
    selectInputAfterClose = true
    void handle.update()
  }

  async function finishSelection() {
    let change = pendingChange
    pendingChange = null

    if (change) {
      dispatchChange(change)
    }

    await closePopover()
  }

  async function setInputText(nextText: string) {
    closeSequenceId++
    pendingInputValue = null
    pendingChange = null
    selectInputAfterClose = false

    let selectionChanged = clearCommittedSelection()

    inputText = nextText
    showReason = 'hint'
    activeValue = null
    activeId = undefined

    let nextFilterText = nextText !== '' || !open ? nextText : filterText
    let matchingOptions = getMatchingOptions(nextText)
    filterText = nextFilterText

    if (selectionChanged) {
      dispatchChange({ label: null, optionId: null, value: null })
    }

    if (nextText === '' || matchingOptions.length === 0) {
      if (open) {
        open = false
        surfaceVisible = false
      } else {
        filterText = ''
      }

      await handle.update()
      return
    }

    open = true
    surfaceVisible = true
    await handle.update()
  }

  function handleBlur() {
    let exactMatch = getExactInputMatch(inputText)
    if (!exactMatch) {
      clearInputAndSelection()
    } else {
      let selectionChanged = value !== exactMatch.value
      value = exactMatch.value
      selectedId = exactMatch.id
      selectedLabel = exactMatch.label
      activeValue = exactMatch.value
      activeId = exactMatch.id

      if (selectionChanged) {
        dispatchChange({
          label: exactMatch.label,
          optionId: exactMatch.id,
          value: exactMatch.value,
        })
      }
    }

    void closePopover()
  }

  function handleEscape() {
    if (!getExactInputMatch(inputText)) {
      clearInputAndSelection()
    }

    if (open) {
      void closePopover()
    }
  }

  function openFromArrow(direction: 'first' | 'last') {
    let strategy: ComboboxOpenStrategy = getExactInputMatch(inputText) ? 'selected' : direction
    clearInputSelection()
    return openPopover(strategy)
  }

  function openFromInputActivation() {
    clearInputSelection()
    return openPopover('selected-or-none')
  }

  function navigateNext() {
    clearInputSelection()
    listboxRef?.navigateNext()
  }

  function navigatePrevious() {
    clearInputSelection()
    listboxRef?.navigatePrevious()
  }

  function selectActive() {
    return listboxRef?.selectActive() ?? Promise.resolve()
  }

  function registerInput(node: HTMLInputElement) {
    inputRef = node
    setInputValue(inputText)
  }

  function unregisterInput(node: HTMLInputElement) {
    if (inputRef === node) {
      inputRef = undefined
    }
  }

  function registerSurface(node: HTMLElement) {
    surfaceRef = node
  }

  function unregisterSurface(node: HTMLElement) {
    if (surfaceRef === node) {
      surfaceRef = undefined
    }
  }

  let publicHandle: ComboboxHandle = {
    get activeOptionId() {
      return activeId ?? null
    },
    get id() {
      return listId
    },
    get inputText() {
      return inputText
    },
    get isOpen() {
      return open
    },
    get label() {
      return selectedLabel || null
    },
    get value() {
      return value
    },
    close() {
      void closePopover()
    },
    open(strategy = 'selected') {
      return openPopover(strategy)
    },
  }

  handle.context.set({
    get activeId() {
      return activeId
    },
    get disabled() {
      return handle.props.disabled === true
    },
    get filterText() {
      return filterText
    },
    get inputText() {
      return inputText
    },
    get isOpen() {
      return open
    },
    get listId() {
      return listId
    },
    get name() {
      return handle.props.name
    },
    get showReason() {
      return showReason
    },
    get surfaceVisible() {
      return surfaceVisible
    },
    get value() {
      return value
    },
    clearInputSelection,
    close() {
      void closePopover()
    },
    handleBlur,
    handleEscape,
    navigateNext,
    navigatePrevious,
    open(strategy = 'selected') {
      return openPopover(strategy)
    },
    openFromArrow,
    openFromInputActivation,
    registerInput,
    registerSurface,
    setInputText,
    selectActive,
    syncPopoverMinWidth,
    unregisterInput,
    unregisterSurface,
  })

  return () => {
    if (!hasInitialized) {
      value = handle.props.defaultValue ?? null
      inputText = handle.props.defaultValue ?? ''
      hasInitialized = true
    }

    handle.queueTask(() => {
      let selectedOption = getSelectedOption()
      if (selectedOption) {
        selectedId = selectedOption.id
        selectedLabel = selectedOption.label
      } else if (value === null) {
        selectedId = undefined
        selectedLabel = ''
      }
    })

    if (!hasProvidedRef) {
      handle.queueTask(() => {
        handle.props.ref?.(publicHandle)
      })
      hasProvidedRef = true
    }

    return (
      <popover.Context>
        <listbox.Context
          activeValue={activeValue}
          flashSelection
          onHighlight={(nextActiveValue, option) => {
            if (!open) {
              return
            }

            activeValue = nextActiveValue
            activeId = option?.id
            if (option) {
              showReason = 'nav'
            }
            void handle.update()
          }}
          onSelect={beginSelection}
          onSelectSettled={finishSelection}
          ref={(ref) => {
            listboxRef = ref
          }}
          selectionFlashAttribute="data-combobox-flash"
          value={value}
        >
          {handle.props.children}
        </listbox.Context>
      </popover.Context>
    )
  }
}

function getComboboxContext(handle: Handle | MixinHandle) {
  return handle.context.get(ComboboxProvider)
}

const inputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let context = getComboboxContext(handle)

  return (props) => [
    attrs({
      'aria-activedescendant': context.activeId,
      'aria-autocomplete': 'list',
      'aria-controls': context.listId,
      'aria-expanded': context.isOpen ? 'true' : 'false',
      'aria-haspopup': 'listbox',
      autocomplete: props.autocomplete ?? 'off',
      'data-surface-visible': context.surfaceVisible ? 'true' : undefined,
      disabled: context.disabled ? true : props.disabled,
      role: 'combobox',
      type: props.type ?? 'text',
    }),
    ref((node: HTMLInputElement, signal) => {
      context.registerInput(node)
      signal.addEventListener('abort', () => {
        context.unregisterInput(node)
      })
    }),
    popover.anchor({ placement: 'bottom-start' }),
    on('click', () => {
      if (context.isOpen) {
        return
      }

      void context.openFromInputActivation()
    }),
    on('input', (event) => {
      void context.setInputText(event.currentTarget.value)
    }),
    on('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          if (context.isOpen) {
            context.navigateNext()
          } else {
            void context.openFromArrow('first')
          }
          return
        case 'ArrowUp':
          event.preventDefault()
          if (context.isOpen) {
            context.navigatePrevious()
          } else {
            void context.openFromArrow('last')
          }
          return
        case 'Enter':
          if (!context.isOpen) {
            return
          }

          event.preventDefault()
          void context.selectActive()
          return
        case 'Escape':
          if (!context.isOpen && context.inputText === '') {
            return
          }

          event.preventDefault()
          context.handleEscape()
          return
      }
    }),
    on('blur', () => {
      context.handleBlur()
    }),
  ]
})

const popoverMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = getComboboxContext(handle)

  return () => [
    attrs({ 'data-show-reason': context.showReason }),
    ref((node: HTMLElement, signal) => {
      context.registerSurface(node)
      signal.addEventListener('abort', () => {
        context.unregisterSurface(node)
      })
    }),
    popover.surface({
      open: context.isOpen,
      onHide() {
        context.close()
      },
      closeOnAnchorClick: false,
    }),
    on('beforetoggle', (event) => {
      if (event.newState === 'open') {
        context.syncPopoverMinWidth()
      }
    }),
  ]
})

const listMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = getComboboxContext(handle)
  return () => [attrs({ id: context.listId }), listbox.list()]
})

const hiddenInputMixin = createMixin<HTMLInputElement, [], ElementProps>((handle) => {
  let context = getComboboxContext(handle)
  return () =>
    attrs({
      disabled: context.disabled ? true : undefined,
      name: context.name,
      type: 'hidden',
      value: context.value ?? '',
    })
})

const optionMixin = createMixin<HTMLElement, [options: ComboboxOptionOptions], ElementProps>(
  (handle) => {
    let context = getComboboxContext(handle)

    return (options) => {
      let hidden = !matchesSearchValue(getOptionSearchValue(options), context.filterText)

      return [
        attrs({ hidden: hidden ? true : undefined }),
        on('pointerdown', (event) => {
          if (event.button === 0) {
            event.preventDefault()
          }
        }),
        listbox.option({
          disabled: options.disabled,
          label: options.label,
          textValue: options.searchValue,
          value: options.value,
        }),
      ]
    }
  },
)

export const Context = ComboboxProvider
export const hiddenInput = hiddenInputMixin
export const input = inputMixin
export const list = listMixin
export const option = optionMixin
export { popoverMixin as popover }

const combobox = {
  Context,
  hiddenInput,
  input,
  list,
  option,
  popover: popoverMixin,
} as const

export function onComboboxChange(handler: ComboboxChangeHandler, captureBoolean?: boolean) {
  return on<HTMLElement, typeof COMBOBOX_CHANGE_EVENT>(
    COMBOBOX_CHANGE_EVENT,
    handler,
    captureBoolean,
  )
}

export function Combobox(handle: Handle<ComboboxProps>) {
  return () => {
    let { children, defaultValue, disabled, inputId, name, placeholder, ...divProps } = handle.props

    return (
      <combobox.Context defaultValue={defaultValue} disabled={disabled} name={name}>
        <div {...divProps}>
          <input
            defaultValue={defaultValue ?? undefined}
            id={inputId}
            mix={[inputStyle, combobox.input()]}
            placeholder={placeholder}
          />
          <div mix={[popover.surfaceStyle, popoverStyle, combobox.popover()]}>
            <div mix={[popover.contentStyle, listbox.listStyle, combobox.list()]}>{children}</div>
          </div>
          {name && <input mix={combobox.hiddenInput()} />}
        </div>
      </combobox.Context>
    )
  }
}

export function ComboboxOption(handle: Handle<ComboboxOptionProps>) {
  return () => {
    let { children, disabled, label, mix, searchValue, value, ...divProps } = handle.props

    return (
      <div
        {...divProps}
        mix={[listbox.optionStyle, combobox.option({ disabled, label, searchValue, value }), mix]}
      >
        <Glyph mix={listbox.glyphStyle} name="check" />
        <span mix={listbox.labelStyle}>{children ?? label}</span>
      </div>
    )
  }
}

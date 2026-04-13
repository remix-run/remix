// @jsxRuntime classic
// @jsx createElement
import { createElement, on, ref, type Handle, type Props } from '@remix-run/component'
import { Glyph } from '../glyph/glyph.tsx'
import {
  listbox,
  type ListboxOption,
  type ListboxRef,
  type ListboxValue,
} from '../listbox/listbox.ts'
import { popover } from '../popover/popover.ts'
import { ui } from '../theme/theme.ts'
import { hiddenTypeahead } from '../typeahead/typeahead-mixin.tsx'
import { onKeyDown } from '../keydown/keydown.ts'
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'
import { wait } from '../utils/wait.ts'

interface SelectProps extends Props<'button'> {
  defaultLabel: string
  defaultValue: string
}

enum State {
  Initializing = 'initializing',
  Closed = 'closed',
  Open = 'open',
  Selecting = 'selecting',
}

export function Select(handle: Handle) {
  let state: State = State.Initializing

  let value: ListboxValue = null
  let activeValue: ListboxValue = null

  let activeId: string | undefined = undefined
  let selectedId: string | undefined = undefined

  let selectedLabel = ''
  let displayedLabel = ''
  let defaultLabel = ''

  let buttonRef: HTMLElement
  let listboxRef: ListboxRef | undefined
  let surfaceRef: HTMLElement

  let listId = handle.id + '-list'

  function openPopover() {
    if (state !== State.Closed) return
    state = State.Open
    activeValue = value
    handle.update()
  }

  function syncPopoverMinWidth() {
    if (state !== State.Open) return
    surfaceRef.style.minWidth = `${buttonRef.offsetWidth}px`
  }

  function closePopover() {
    if (state !== State.Open) return
    state = State.Closed
    handle.update()
  }

  function setSelectedOption(
    nextValue: ListboxValue,
    option: ListboxOption | undefined,
    syncDisplayedLabel = false,
  ) {
    value = nextValue
    activeValue = nextValue
    activeId = option?.id
    selectedId = option?.id
    selectedLabel = option ? option.label : defaultLabel

    if (syncDisplayedLabel) {
      displayedLabel = selectedLabel
    }
  }

  async function selectOption(nextValue: ListboxValue, option: ListboxOption | undefined) {
    if (state !== State.Open) return
    state = State.Selecting
    setSelectedOption(nextValue, option)
    await Promise.all([handle.update(), waitForCssTransition(surfaceRef, handle.signal)])
    await wait(75) // UX delay label swap for clear value change
    if (handle.signal.aborted) return
    displayedLabel = selectedLabel
    state = State.Closed
    handle.update()
  }

  function selectTypeaheadMatch(text: string) {
    if (state !== State.Closed) return

    let option = listboxRef?.matchSearchText(text, value)
    if (!option) return

    setSelectedOption(option.value, option, true)
    handle.update()
  }

  function highlightOption(nextActiveValue: ListboxValue, option: ListboxOption | undefined) {
    if (state !== State.Open) return
    activeValue = nextActiveValue
    activeId = option ? option.id : undefined
    handle.update()
  }

  return (props: SelectProps) => {
    let { defaultLabel: defaultLabelProp, defaultValue, mix, ...buttonProps } = props
    defaultLabel = defaultLabelProp

    if (state === State.Initializing) {
      selectedLabel = displayedLabel = defaultLabel
      value = defaultValue ?? null
      activeValue = value
      state = State.Closed
      handle.queueTask(() => {
        let selected = surfaceRef.querySelector(`[aria-selected="true"]`)
        if (selected && !selectedId) {
          selectedId = selected.id
          handle.update()
        }
      })
    }

    return (
      <popover.context>
        <button
          {...buttonProps}
          aria-haspopup="listbox"
          aria-expanded={state === State.Open || state === State.Selecting}
          aria-controls={listId}
          aria-describedby={selectedId}
          mix={[
            ui.button.select,
            ref((node) => (buttonRef = node)),
            popover.focusOnHide(),
            popover.anchor({
              placement: 'left',
              inset: true,
              relativeTo: selectedId ? `#${selectedId}` : '[role="option"]',
            }),
            hiddenTypeahead(selectTypeaheadMatch),
            on('click', openPopover),
            onKeyDown('ArrowDown', openPopover),
            onKeyDown('ArrowUp', openPopover),
            mix,
          ]}
        >
          <span mix={ui.button.label}>{displayedLabel}</span>
          <Glyph mix={ui.button.icon} name="chevronVertical" />
        </button>
        <div
          mix={[
            ui.popover.surface,
            ref((node) => (surfaceRef = node)),
            popover.surface({
              open: state === State.Open,
              onHide: closePopover,
            }),
            on('beforetoggle', syncPopoverMinWidth),
          ]}
        >
          <listbox.context
            flashSelection
            ref={(ref) => {
              listboxRef = ref
            }}
            value={value}
            activeValue={activeValue}
            onSelect={selectOption}
            onHighlight={highlightOption}
          >
            <div
              id={listId}
              aria-activedescendant={activeId}
              mix={[ui.popover.content, ui.listbox.surface, popover.focusOnShow(), listbox.list()]}
            >
              {props.children}
            </div>
          </listbox.context>
        </div>
      </popover.context>
    )
  }
}

type OptionProps = Props<'div'> & Omit<ListboxOption, 'id'>

export function Option() {
  return (props: OptionProps) => {
    let { label, value, disabled, textValue, children, mix, ...divProps } = props
    return (
      <div
        {...divProps}
        mix={[ui.listbox.option, listbox.option({ value, label, disabled, textValue }), mix]}
      >
        <Glyph mix={ui.listbox.glyph} name="check" />
        <span mix={ui.listbox.label}>{children ?? props.label}</span>
      </div>
    )
  }
}

// @jsxRuntime classic
// @jsx createElement
import { createElement, on, ref, type Handle, type Props } from '@remix-run/component'
import { filterText } from './filter-text.tsx'
import { flashAttribute } from './flash-attribute.ts'
import { Glyph } from './glyph.tsx'
import { popover } from './popover.tsx'
import { ui } from './theme.ts'
import { waitForCssTransition } from './wait-for-css-transition.ts'

type HighlightOnOpen = 'selectedOrFirst' | 'first' | 'last'

let MENU_POINTER_UP_DELAY = 200
let SELECTION_FLASH_DELAY = 75
let enabledOptionSelector = '[role="option"]:not([aria-disabled="true"])'

type ListboxContext = {
  disabled: boolean
  highlightedValue: string | null
  selectedValue: string | null
}

export interface ListboxProps extends Props<'button'> {
  initialLabel: string
}

export interface ListboxOptionProps extends Props<'div'> {
  disabled?: boolean
  textValue?: string
  value: string
}

function getTargetOptionNode(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  let node = target.closest(enabledOptionSelector)
  if (!(node instanceof HTMLElement)) {
    return null
  }

  return node
}

export function Listbox(handle: Handle<ListboxContext>) {
  let highlightedValue: string | null = null
  let buttonPointerDownTime: number | null = null
  let menuPointerDownStarted = false
  let open = false
  let popupId = `${handle.id}-popup`
  let listId = `${handle.id}-list`
  let selectionActive = false
  let selectedValue: string | null = null
  let triggerNode: HTMLButtonElement
  let popupNode: HTMLDivElement

  handle.queueTask(() => {
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!open || event.button !== 0) {
          return
        }

        if (!(event.target instanceof Node)) {
          return
        }

        if (triggerNode.contains(event.target) || popupNode.contains(event.target)) {
          return
        }

        event.preventDefault()

        if (selectionActive) {
          return
        }

        closePopup({ focusTrigger: true })
      },
      {
        capture: true,
        signal: handle.signal,
      },
    )
  })

  function getOptionNodes() {
    return Array.from(popupNode.querySelectorAll(enabledOptionSelector)).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
  }

  function getOptionNodeByValue(value: string | null) {
    if (value == null) {
      return null
    }

    return getOptionNodes().find((node) => node.dataset.value === value) ?? null
  }

  function getHighlightedOptionNode() {
    return getOptionNodeByValue(highlightedValue)
  }

  function getSelectedOptionNode() {
    return getOptionNodeByValue(selectedValue)
  }

  function setHighlightedValue(value: string | null) {
    if (highlightedValue === value) {
      return
    }

    highlightedValue = value
    void handle.update()
  }

  function resolveHighlightedValue(strategy: HighlightOnOpen) {
    let enabledOptions = getOptionNodes()

    if (strategy === 'first') {
      return enabledOptions[0]?.dataset.value ?? null
    }

    if (strategy === 'last') {
      let option = enabledOptions.at(-1)
      return option?.dataset.value ?? null
    }

    let selectedOption = getSelectedOptionNode()
    if (selectedOption) {
      return selectedOption.dataset.value ?? null
    }

    return enabledOptions[0]?.dataset.value ?? null
  }

  function moveHighlight(direction: 'next' | 'previous' | 'first' | 'last') {
    let enabledOptions = getOptionNodes()
    if (enabledOptions.length === 0) {
      return
    }

    if (direction === 'first') {
      setHighlightedValue(enabledOptions[0]?.dataset.value ?? null)
      return
    }

    if (direction === 'last') {
      let option = enabledOptions.at(-1)
      setHighlightedValue(option?.dataset.value ?? null)
      return
    }

    let currentIndex = enabledOptions.findIndex(
      (option) => option.dataset.value === highlightedValue,
    )
    if (currentIndex === -1) {
      setHighlightedValue(
        enabledOptions[direction === 'next' ? 0 : enabledOptions.length - 1].dataset.value ?? null,
      )
      return
    }

    let nextIndex = currentIndex + (direction === 'next' ? 1 : -1)
    if (nextIndex < 0 || nextIndex >= enabledOptions.length) {
      return
    }

    setHighlightedValue(enabledOptions[nextIndex]!.dataset.value ?? null)
  }

  async function openPopup(disabled: boolean, strategy: HighlightOnOpen = 'selectedOrFirst') {
    if (disabled || open || selectionActive) {
      return
    }

    menuPointerDownStarted = false
    let nextHighlightedValue = resolveHighlightedValue(strategy)
    open = true
    highlightedValue = nextHighlightedValue
    await handle.update()
    popupNode.showPopover()
    popupNode.style.minWidth = `${triggerNode.offsetWidth}px`

    getHighlightedOptionNode()?.scrollIntoView({
      block: 'nearest',
    })
  }

  function closePopup({ focusTrigger = false }: { focusTrigger?: boolean } = {}) {
    open = false
    highlightedValue = null
    menuPointerDownStarted = false
    buttonPointerDownTime = null
    popupNode.hidePopover()
    void handle.update()

    if (focusTrigger) {
      handle.queueTask(() => {
        triggerNode.focus()
      })
    }
  }

  async function selectValue(
    option: HTMLElement,
    { focusTrigger = true }: { focusTrigger?: boolean } = {},
  ) {
    let value = option.dataset.value!
    selectionActive = true
    highlightedValue = null
    await handle.update()

    await flashAttribute(option, 'data-flash', SELECTION_FLASH_DELAY)
    if (handle.signal.aborted) return

    await waitForCssTransition(popupNode, handle.signal, () => {
      closePopup({ focusTrigger })
    })
    if (handle.signal.aborted) return

    selectionActive = false
    selectedValue = value
    await handle.update()
  }

  async function selectHighlightedValue() {
    let option = getHighlightedOptionNode()
    if (!(option instanceof HTMLElement)) {
      return
    }

    await selectValue(option)
  }

  function selectFilteredValue(text: string) {
    if (selectionActive || text === '') {
      return
    }

    let option = getOptionNodes().find((node) =>
      node.dataset.label?.toLowerCase().includes(text.toLowerCase()),
    )
    if (!(option instanceof HTMLElement)) {
      return
    }

    highlightedValue = null
    selectedValue = option.dataset.value!

    if (open) {
      closePopup()
      return
    }

    void handle.update()
  }

  return (props: ListboxProps) => {
    let { children, initialLabel, mix, type, ...buttonProps } = props

    handle.context.set({
      disabled: props.disabled === true,
      highlightedValue,
      selectedValue,
    })

    return (
      <button
        {...buttonProps}
        aria-activedescendant={open ? (getHighlightedOptionNode()?.id ?? undefined) : undefined}
        aria-expanded={open}
        popovertarget={popupId}
        role="combobox"
        mix={[
          ui.listbox.trigger,
          mix,
          ref((node: HTMLButtonElement) => {
            triggerNode = node
          }),
          filterText((text) => {
            selectFilteredValue(text)
          }),
          on('click', (event) => {
            event.preventDefault()
          }),
          on('pointerdown', (event) => {
            if (event.currentTarget.disabled) {
              return
            }

            if (selectionActive) {
              return
            }

            if (event.button !== 0) {
              return
            }

            event.preventDefault()
            buttonPointerDownTime = Date.now()
            event.currentTarget.focus()

            if (open) {
              closePopup()
              return
            }

            void openPopup(event.currentTarget.disabled)
          }),
          on('keydown', (event) => {
            if (event.currentTarget.disabled) {
              return
            }

            if (selectionActive) {
              event.preventDefault()
              return
            }

            switch (event.key) {
              case ' ':
              case 'Enter':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled)
                } else {
                  void selectHighlightedValue()
                }
                break
              case 'ArrowDown':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled)
                } else {
                  moveHighlight('next')
                }
                break
              case 'ArrowUp':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'last')
                } else {
                  moveHighlight('previous')
                }
                break
              case 'Home':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'first')
                } else {
                  moveHighlight('first')
                }
                break
              case 'End':
                event.preventDefault()
                if (!open) {
                  void openPopup(event.currentTarget.disabled, 'last')
                } else {
                  moveHighlight('last')
                }
                break
              case 'Escape':
                if (!open) {
                  return
                }
                event.preventDefault()
                closePopup()
                break
              case 'Tab':
                if (!open) {
                  return
                }
                event.preventDefault()
                moveHighlight('first')
                break
            }
          }),
          on('focusout', (event) => {
            if (!open) {
              return
            }

            let nextTarget = event.relatedTarget
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
              return
            }

            closePopup()
          }),
        ]}
        type={type ?? 'button'}
      >
        <span mix={ui.listbox.value}>{getSelectedOptionNode()?.dataset.label ?? initialLabel}</span>
        <Glyph mix={ui.listbox.indicator} name="chevronDown" />
        <div
          id={popupId}
          mix={[
            popover({
              inset: true,
              placement: 'top-start',
              relativeTo: selectedValue ? '[aria-selected="true"]' : '[role="option"]',
            }),
            ui.listbox.popup,
            ref((node) => {
              popupNode = node
            }),
            on('pointerdown', (event) => {
              if (event.button !== 0) {
                return
              }

              menuPointerDownStarted = true
              event.stopPropagation()
            }),
            on('click', (event) => {
              event.preventDefault()
              event.stopPropagation()
            }),
          ]}
        >
          <div
            id={listId}
            role="listbox"
            mix={[
              ui.listbox.list,
              on('pointermove', (event) => {
                if (selectionActive) {
                  return
                }

                let option = getTargetOptionNode(event.target)
                if (!(option instanceof HTMLElement)) {
                  setHighlightedValue(null)
                  return
                }

                setHighlightedValue(option.dataset.value ?? null)
              }),
              on('pointerleave', () => {
                if (selectionActive) {
                  return
                }

                setHighlightedValue(null)
              }),
              on('pointerup', (event) => {
                if (selectionActive) {
                  return
                }

                if (event.button !== 0) {
                  return
                }

                let shouldSelect =
                  menuPointerDownStarted ||
                  (buttonPointerDownTime !== null &&
                    Date.now() - buttonPointerDownTime >= MENU_POINTER_UP_DELAY)
                menuPointerDownStarted = false
                buttonPointerDownTime = null

                if (!shouldSelect) {
                  return
                }

                let option = getTargetOptionNode(event.target)
                if (!(option instanceof HTMLElement)) {
                  return
                }

                event.preventDefault()
                event.stopPropagation()
                void selectValue(option)
              }),
            ]}
          >
            {children}
          </div>
        </div>
      </button>
    )
  }
}

export function ListboxOption(handle: Handle) {
  return (props: ListboxOptionProps) => {
    let { children, disabled, mix, textValue, value, ...domProps } = props
    let listbox = handle.context.get(Listbox)
    let resolvedTextValue =
      textValue ??
      (typeof children === 'string' || typeof children === 'number' ? String(children) : value)
    let resolvedDisabled = listbox.disabled || disabled === true

    let selected = listbox.selectedValue === value
    let highlighted = listbox.highlightedValue === value

    return (
      <div
        {...domProps}
        aria-disabled={resolvedDisabled ? true : undefined}
        aria-selected={selected ? true : undefined}
        data-highlighted={highlighted ? 'true' : undefined}
        data-label={resolvedTextValue}
        data-value={value}
        id={handle.id}
        mix={[ui.listbox.item, mix]}
        role="option"
        tabIndex={-1}
      >
        <Glyph mix={ui.listbox.itemIndicator} name="check" />
        <span mix={ui.listbox.itemLabel}>{children ?? value}</span>
      </div>
    )
  }
}

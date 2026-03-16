// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  ref,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'

import { anchor } from './anchor.ts'
import { hidePopover, isPopoverOpen, showPopover } from './popover.tsx'

export let listboxChangeEventType = 'rmx:listbox-change' as const
export let listboxOpenChangeEventType = 'rmx:listbox-open-change' as const

declare global {
  interface HTMLElementEventMap {
    [listboxChangeEventType]: ListboxChangeEvent
    [listboxOpenChangeEventType]: ListboxOpenChangeEvent
  }
}

export class ListboxChangeEvent extends Event {
  itemValue: string | null
  value: string | null

  constructor(value: string | null, itemValue: string | null) {
    super(listboxChangeEventType, {
      bubbles: true,
    })
    this.value = value
    this.itemValue = itemValue
  }
}

export class ListboxOpenChangeEvent extends Event {
  open: boolean

  constructor(open: boolean) {
    super(listboxOpenChangeEventType, {
      bubbles: true,
    })
    this.open = open
  }
}

export type ListboxProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  defaultLabel?: RemixNode
  defaultOpen?: boolean
  defaultValue?: string | null
  disabled?: boolean
  loopFocus?: boolean
  name?: string
  open?: boolean
  value?: string | null
}

export type ListboxSetup = {
  label?: RemixNode
}

type ListboxComponent = typeof ListboxImpl & {
  readonly change: typeof listboxChangeEventType
  readonly openChange: typeof listboxOpenChangeEventType
}

type ListboxItemRecord = {
  disabled: boolean
  id: string
  node: HTMLElement
  textValue: string
  value: string
}

type RemixElementLike = {
  $rmx: true
  props: Record<string, unknown>
}

let selectionFlashAttr = 'data-rmx-listbox-flash'
let highlightedAttr = 'data-rmx-listbox-highlighted'
let selectionFlashDelay = 75
let popupFadeDuration = 180
let selectionCommitDelay = 50

let partAttr = 'data-rmx-listbox-part'
let valueAttr = 'data-rmx-listbox-value'
let textValueAttr = 'data-rmx-listbox-text-value'
let disabledAttr = 'data-rmx-listbox-disabled'
let currentAttr = 'data-rmx-listbox-current'

function getPart(root: HTMLElement | null, part: string) {
  let node = root?.querySelector(`[${partAttr}="${part}"]`)
  return node instanceof HTMLElement ? node : null
}

function isRemixElement(node: RemixNode): node is RemixElementLike {
  return !!node && typeof node === 'object' && !Array.isArray(node) && '$rmx' in node
}

function flattenMixValue(mix: unknown, out: Array<{ args?: unknown[] }> = []): Array<{ args?: unknown[] }> {
  if (Array.isArray(mix)) {
    for (let item of mix) {
      flattenMixValue(item, out)
    }
  } else if (mix && typeof mix === 'object') {
    out.push(mix as { args?: unknown[] })
  }

  return out
}

function getMixedAttr(node: RemixElementLike, name: string) {
  for (let descriptor of flattenMixValue(node.props.mix)) {
    let defaults = descriptor.args?.[0]

    if (defaults && typeof defaults === 'object' && !Array.isArray(defaults) && name in defaults) {
      return (defaults as Record<string, unknown>)[name]
    }
  }

  return undefined
}

function replaceValueChildren(node: RemixNode, label: RemixNode): RemixNode {
  if (Array.isArray(node)) {
    return node.map(child => replaceValueChildren(child, label))
  }

  if (!isRemixElement(node)) {
    return node
  }

  let nextChildren = replaceValueChildren(node.props.children, label)

  if (getMixedAttr(node, partAttr) === 'value') {
    return {
      ...node,
      props: {
        ...node.props,
        children: label,
      },
    }
  }

  if (nextChildren === node.props.children) {
    return node
  }

  return {
    ...node,
    props: {
      ...node.props,
      children: nextChildren,
    },
  }
}

function getParts(root: HTMLElement | null) {
  let trigger = getPart(root, 'trigger')
  let popup = getPart(root, 'popup')
  let list = getPart(root, 'list')
  let valueNodes = root ? [...root.querySelectorAll(`[${partAttr}="value"]`)] : []
  let items = root ? [...root.querySelectorAll(`[${partAttr}="item"]`)] : []

  return {
    trigger: trigger instanceof HTMLButtonElement ? trigger : null,
    popup: popup instanceof HTMLElement ? popup : null,
    list: list instanceof HTMLElement ? list : null,
    valueNodes: valueNodes.filter((node): node is HTMLElement => node instanceof HTMLElement),
    items: items.filter((node): node is HTMLElement => node instanceof HTMLElement),
  }
}

function ListboxImpl(handle: Handle, setup: ListboxSetup = {}) {
  let currentProps: ListboxProps | null = null
  let highlightedValue: string | null = null
  let rootNode: HTMLElement | null = null
  let popupNode: HTMLElement | null = null
  let cleanupAnchor = () => {}
  let popupListenersAbort: AbortController | null = null
  let uncontrolledValue: string | null = null
  let uncontrolledOpen = false
  let hasInitializedValue = false
  let hasInitializedOpen = false
  let pointerDownTime: number | null = null
  let startedItemPointerDown = false
  let selectionTeardown = () => {}
  let selectionActive = false

  function getValue() {
    if (!currentProps) {
      return null
    }

    if (currentProps.value !== undefined) {
      return currentProps.value
    }

    if (!hasInitializedValue) {
      uncontrolledValue = currentProps.defaultValue ?? null
      hasInitializedValue = true
    }

    return uncontrolledValue
  }

  function getOpen() {
    if (!currentProps) {
      return false
    }

    if (currentProps.open !== undefined) {
      return currentProps.open
    }

    if (!hasInitializedOpen) {
      uncontrolledOpen = currentProps.defaultOpen ?? false
      hasInitializedOpen = true
    }

    return uncontrolledOpen
  }

  function getItemRecords() {
    let { items } = getParts(rootNode)

    return items.map((node, index) => {
      let value = node.getAttribute(valueAttr) ?? ''
      let id = node.id || `${handle.id}-option-${index}`
      let disabled = node.getAttribute(disabledAttr) === 'true'
      let textValue = node.getAttribute(textValueAttr) ?? node.textContent?.trim() ?? value

      return {
        disabled,
        id,
        node,
        textValue,
        value,
      } satisfies ListboxItemRecord
    })
  }

  function getEnabledItems() {
    return getItemRecords().filter((item) => !item.disabled)
  }

  function getCurrentItem() {
    let value = getValue()
    if (!value) {
      return null
    }

    return getItemRecords().find((item) => item.value === value) ?? null
  }

  function getHighlightedItem() {
    if (!highlightedValue) {
      return null
    }

    return getItemRecords().find((item) => item.value === highlightedValue) ?? null
  }

  function setHighlightedValue(value: string | null) {
    highlightedValue = value
    syncDom()
  }

  function dispatchChange(value: string | null, itemValue: string | null) {
    rootNode?.dispatchEvent(new ListboxChangeEvent(value, itemValue))
  }

  function dispatchOpenChange(open: boolean) {
    rootNode?.dispatchEvent(new ListboxOpenChangeEvent(open))
  }

  function resetPopupStyles() {
    let { popup } = getParts(rootNode)
    if (!popup) {
      return
    }

    popup.style.opacity = ''
    popup.style.pointerEvents = ''
    popup.style.transition = ''
  }

  function finishSelection(value: string) {
    let { popup } = getParts(rootNode)

    if (!popup) {
      if (currentProps?.value === undefined) {
        uncontrolledValue = value
      }
      dispatchChange(value, value)
      hidePopup()
      void handle.update()
      return
    }

    popup.style.pointerEvents = 'none'
    popup.style.transition = `opacity ${popupFadeDuration}ms ease`
    popup.style.opacity = '0'

    let settled = false
    let done = () => {
      if (settled) {
        return
      }
      settled = true
      popup.removeEventListener('transitionend', done)
      resetPopupStyles()
      hidePopup()
      selectionActive = false
      selectionTeardown = () => {}
      setTimeout(() => {
        if (currentProps?.value === undefined) {
          uncontrolledValue = value
        }
        dispatchChange(value, value)
        void handle.update()
      }, selectionCommitDelay)
    }

    popup.addEventListener('transitionend', done, { once: true })
    setTimeout(done, popupFadeDuration + 20)
  }

  function flashSelection(node: HTMLElement, callback: () => void) {
    node.removeAttribute(highlightedAttr)

    let timeout = setTimeout(() => {
      node.setAttribute(selectionFlashAttr, 'true')

      timeout = setTimeout(() => {
        node.removeAttribute(selectionFlashAttr)
        callback()
      }, selectionFlashDelay)
    }, selectionFlashDelay)

    selectionTeardown = () => {
      clearTimeout(timeout)
      node.removeAttribute(selectionFlashAttr)
      selectionActive = false
      selectionTeardown = () => {}
    }
  }

  function selectValue(value: string) {
    if (selectionActive) {
      return
    }

    let item = getItemRecords().find((candidate) => candidate.value === value)
    if (!item) {
      finishSelection(value)
      return
    }

    selectionActive = true
    flashSelection(item.node, () => {
      finishSelection(value)
    })
  }

  function openPopup({ highlightLast = false }: { highlightLast?: boolean } = {}) {
    let { popup } = getParts(rootNode)
    if (!popup) {
      return
    }

    selectionTeardown()
    resetPopupStyles()

    let selectedItem = getCurrentItem()
    let enabledItems = getEnabledItems()
    let nextHighlighted = highlightLast
      ? enabledItems.at(-1)?.value ?? null
      : selectedItem?.value ?? enabledItems[0]?.value ?? null

    highlightedValue = nextHighlighted
    if (currentProps?.open === undefined) {
      uncontrolledOpen = true
    }
    showPopover(popup)
  }

  function hidePopup() {
    let { popup } = getParts(rootNode)
    selectionTeardown()
    resetPopupStyles()
    if (currentProps?.open === undefined) {
      uncontrolledOpen = false
    }
    hidePopover(popup)
  }

  function isItemDisabled(item: HTMLElement) {
    return item.getAttribute(disabledAttr) === 'true' || !!currentProps?.disabled
  }

  function moveHighlight(direction: 'next' | 'previous' | 'first' | 'last') {
    let items = getEnabledItems()
    if (items.length === 0) {
      return
    }

    if (direction === 'first') {
      setHighlightedValue(items[0]?.value ?? null)
      return
    }

    if (direction === 'last') {
      setHighlightedValue(items.at(-1)?.value ?? null)
      return
    }

    let currentIndex = items.findIndex((item) => item.value === highlightedValue)
    if (currentIndex === -1) {
      setHighlightedValue(items[direction === 'next' ? 0 : items.length - 1]?.value ?? null)
      return
    }

    let delta = direction === 'next' ? 1 : -1
    let nextIndex = currentIndex + delta

    if (currentProps?.loopFocus ?? true) {
      if (nextIndex < 0) nextIndex = items.length - 1
      if (nextIndex >= items.length) nextIndex = 0
    } else if (nextIndex < 0 || nextIndex >= items.length) {
      return
    }

    setHighlightedValue(items[nextIndex]?.value ?? null)
  }

  function selectHighlightedValue() {
    let item = getHighlightedItem()
    if (!item || item.disabled) {
      return
    }

    selectValue(item.value)
  }

  function syncValueNodes() {
    let { valueNodes } = getParts(rootNode)
    let currentItem = getCurrentItem()

    for (let node of valueNodes) {
      if (currentItem) {
        node.textContent = currentItem.textValue
        continue
      }

      if (
        typeof currentProps?.defaultLabel === 'string' ||
        typeof currentProps?.defaultLabel === 'number' ||
        typeof currentProps?.defaultLabel === 'bigint'
      ) {
        node.textContent = String(currentProps.defaultLabel)
      }
    }
  }

  function syncPopupNode() {
    let { popup, trigger } = getParts(rootNode)

    if (!popup || popupNode === popup) {
      return
    }

    popupListenersAbort?.abort()
    popupListenersAbort = new AbortController()
    popupNode = popup

    let signal = popupListenersAbort.signal

    let handleBeforeToggle = (event: Event) => {
      let toggleEvent = event as Event & { newState?: 'open' | 'closed' }
      if (toggleEvent.newState !== 'open' || !trigger) {
        return
      }

      let relativeTo = getValue() ? `[${currentAttr}="true"]` : `[${partAttr}="item"]`
      popup.style.minWidth = `${trigger.offsetWidth}px`
      cleanupAnchor()
      cleanupAnchor = anchor(popup, trigger, {
        relativeTo,
        placement: 'left',
        inset: true,
      })
    }

    let handleToggle = (event: Event) => {
      let toggleEvent = event as Event & { newState?: 'open' | 'closed' }
      let isNowOpen = toggleEvent.newState === 'open'

      if (currentProps?.open === undefined) {
        uncontrolledOpen = isNowOpen
      }

      if (!isNowOpen) {
        cleanupAnchor()
        cleanupAnchor = () => {}
        highlightedValue = null
        let activeElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        let activeInsideTrigger = activeElement ? (trigger?.contains(activeElement) ?? false) : false
        let activeInsidePopup = activeElement ? (popup?.contains(activeElement) ?? false) : false

        if (!activeElement || activeInsideTrigger || activeInsidePopup) {
          trigger?.focus()
        }
      } else {
        let { list } = getParts(rootNode)
        list?.focus()
      }

      dispatchOpenChange(isNowOpen)
      syncDom()
    }

    popup.addEventListener('beforetoggle', handleBeforeToggle)
    popup.addEventListener('toggle', handleToggle)

    signal.addEventListener('abort', () => {
      popup.removeEventListener('beforetoggle', handleBeforeToggle)
      popup.removeEventListener('toggle', handleToggle)
    })
  }

  function syncDom() {
    if (!rootNode) {
      return
    }

    let { trigger, popup, list, items } = getParts(rootNode)
    let isOpen = getOpen()
    let currentValue = getValue()
    let highlightedItem = getHighlightedItem()

    if (trigger) {
      trigger.setAttribute('aria-haspopup', 'listbox')
      trigger.setAttribute('aria-expanded', String(isOpen))
      trigger.disabled = !!currentProps?.disabled
    }

    if (popup) {
      if (!popup.id) {
        popup.id = `${handle.id}-popup`
      }

      if (trigger) {
        trigger.setAttribute('aria-controls', popup.id)
      }

      if (isOpen) {
        showPopover(popup)
      } else {
        hidePopover(popup)
      }
    }

    if (list) {
      list.setAttribute('role', 'listbox')
      list.tabIndex = -1
      if (currentProps?.disabled) {
        list.setAttribute('aria-disabled', 'true')
      } else {
        list.removeAttribute('aria-disabled')
      }

      if (highlightedItem) {
        list.setAttribute('aria-activedescendant', highlightedItem.id)
      } else {
        list.removeAttribute('aria-activedescendant')
      }
    }

    for (let [index, item] of items.entries()) {
      if (!item.id) {
        item.id = `${handle.id}-option-${index}`
      }

      let value = item.getAttribute(valueAttr) ?? ''
      let disabled = item.getAttribute(disabledAttr) === 'true'

      item.setAttribute('role', 'option')
      item.tabIndex = -1

      if (value === currentValue) {
        item.setAttribute('aria-selected', 'true')
        item.setAttribute(currentAttr, 'true')
      } else {
        item.removeAttribute('aria-selected')
        item.removeAttribute(currentAttr)
      }

      if (highlightedItem?.id === item.id) {
        item.setAttribute(highlightedAttr, 'true')
      } else {
        item.removeAttribute(highlightedAttr)
      }

      if (disabled || currentProps?.disabled) {
        item.setAttribute('aria-disabled', 'true')
      } else {
        item.removeAttribute('aria-disabled')
      }
    }

    syncValueNodes()
    syncPopupNode()
  }

  function attachRootListeners(node: HTMLElement, signal: AbortSignal) {
    let onFocusOut = (event: Event) => {
      if (selectionActive) {
        return
      }

      let relatedTarget =
        event instanceof FocusEvent && event.relatedTarget instanceof HTMLElement
          ? event.relatedTarget
          : null
      let { trigger, popup } = getParts(rootNode)
      let nextInsideTrigger = relatedTarget ? (trigger?.contains(relatedTarget) ?? false) : false
      let nextInsidePopup = relatedTarget ? (popup?.contains(relatedTarget) ?? false) : false

      if (!isPopoverOpen(popup) || nextInsideTrigger || nextInsidePopup) {
        return
      }

      if (relatedTarget) {
        hidePopup()
        return
      }

      queueMicrotask(() => {
        let activeElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        let activeInsideTrigger = activeElement ? (trigger?.contains(activeElement) ?? false) : false
        let activeInsidePopup = activeElement ? (popup?.contains(activeElement) ?? false) : false

        if (!activeInsideTrigger && !activeInsidePopup) {
          hidePopup()
        }
      })
    }

    let onPointerDown = (event: Event) => {
      if (selectionActive) {
        return
      }

      let pointerEvent = event as PointerEvent
      let target = event.target instanceof HTMLElement ? event.target : null
      if (!target) {
        return
      }

      if (pointerEvent.button === 0) {
        pointerDownTime = Date.now()
      }

      let trigger = target.closest(`[${partAttr}="trigger"]`)
      if (trigger && !currentProps?.disabled && pointerEvent.button === 0) {
        pointerEvent.preventDefault()
        startedItemPointerDown = false
        if (!isPopoverOpen(getParts(rootNode).popup)) {
          openPopup()
        }
        return
      }

      let item = target.closest(`[${partAttr}="item"]`)
      if (item instanceof HTMLElement && pointerEvent.button === 0) {
        pointerEvent.preventDefault()
        startedItemPointerDown = true
      }
    }

    let onPointerMove = (event: Event) => {
      if (selectionActive) {
        return
      }

      let target = event.target instanceof HTMLElement ? event.target : null
      let item = target?.closest(`[${partAttr}="item"]`)

      if (!(item instanceof HTMLElement)) {
        return
      }

      if (isItemDisabled(item)) {
        setHighlightedValue(null)
        return
      }

      setHighlightedValue(item.getAttribute(valueAttr))
    }

    let onPointerUp = (event: Event) => {
      if (selectionActive) {
        return
      }

      let target = event.target instanceof HTMLElement ? event.target : null
      let item = target?.closest(`[${partAttr}="item"]`)
      let pointerEvent = event as PointerEvent

      if (!(item instanceof HTMLElement) || pointerEvent.button !== 0) {
        pointerDownTime = null
        startedItemPointerDown = false
        return
      }

      let pointerDownAge = pointerDownTime === null ? null : Date.now() - pointerDownTime
      let shouldSelect =
        startedItemPointerDown || (pointerDownAge !== null && pointerDownAge >= 200)

      pointerDownTime = null
      startedItemPointerDown = false

      if (!shouldSelect) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (isItemDisabled(item)) {
        return
      }

      selectValue(item.getAttribute(valueAttr) ?? '')
    }

    let onPointerLeave = (event: Event) => {
      let target = event.target instanceof HTMLElement ? event.target : null
      let list = target?.closest(`[${partAttr}="list"]`)

      if (list instanceof HTMLElement) {
        setHighlightedValue(null)
      }
    }

    let onKeyDown = (event: Event) => {
      let keyboardEvent = event as KeyboardEvent
      let target = event.target instanceof HTMLElement ? event.target : null
      if (!target || currentProps?.disabled) {
        return
      }

      if (selectionActive) {
        keyboardEvent.preventDefault()
        return
      }

      let inTrigger = target.closest(`[${partAttr}="trigger"]`)
      let inList = target.closest(`[${partAttr}="list"]`)

      if (inTrigger) {
        if (keyboardEvent.key === ' ' || keyboardEvent.key === 'Enter') {
          keyboardEvent.preventDefault()
          if (!isPopoverOpen(getParts(rootNode).popup)) {
            openPopup()
          }
        } else if (keyboardEvent.key === 'ArrowDown') {
          keyboardEvent.preventDefault()
          openPopup()
        } else if (keyboardEvent.key === 'ArrowUp') {
          keyboardEvent.preventDefault()
          openPopup({ highlightLast: true })
        }

        return
      }

      if (!inList) {
        return
      }

      if (keyboardEvent.key === 'ArrowDown') {
        keyboardEvent.preventDefault()
        moveHighlight('next')
      } else if (keyboardEvent.key === 'ArrowUp') {
        keyboardEvent.preventDefault()
        moveHighlight('previous')
      } else if (keyboardEvent.key === 'Home') {
        keyboardEvent.preventDefault()
        moveHighlight('first')
      } else if (keyboardEvent.key === 'End') {
        keyboardEvent.preventDefault()
        moveHighlight('last')
      } else if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault()
        selectHighlightedValue()
      } else if (keyboardEvent.key === 'Tab') {
        keyboardEvent.preventDefault()
        moveHighlight('first')
      } else if (keyboardEvent.key === 'Escape') {
        keyboardEvent.preventDefault()
        hidePopup()
      }
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove)
    node.addEventListener('pointerup', onPointerUp)
    node.addEventListener('pointerleave', onPointerLeave)
    node.addEventListener('focusout', onFocusOut)
    node.addEventListener('keydown', onKeyDown)

    signal.addEventListener('abort', () => {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', onPointerUp)
      node.removeEventListener('pointerleave', onPointerLeave)
      node.removeEventListener('focusout', onFocusOut)
      node.removeEventListener('keydown', onKeyDown)
      popupListenersAbort?.abort()
      cleanupAnchor()
      cleanupAnchor = () => {}
    })
  }

  return (props: ListboxProps) => {
    currentProps = props
    let currentValue = getValue()
    let currentItem = rootNode ? getCurrentItem() : null
    let renderedLabel =
      currentValue !== null
        ? currentItem?.textValue ?? setup.label ?? props.defaultLabel ?? null
        : props.defaultLabel ?? null
    let renderedChildren = replaceValueChildren(props.children, renderedLabel)
    handle.queueTask(() => {
      syncDom()
    })

    let mix = props.mix
      ? [
          props.mix,
          ref((node, signal) => {
            rootNode = node as HTMLElement
            attachRootListeners(rootNode, signal)
            syncDom()
          }),
        ]
      : ref((node, signal) => {
          rootNode = node as HTMLElement
          attachRootListeners(rootNode, signal)
          syncDom()
        })

    return (
      <div {...props} mix={mix}>
        {renderedChildren}
        {props.name ? (
          <input disabled={props.disabled} name={props.name} type="hidden" value={getValue() ?? ''} />
        ) : null}
      </div>
    )
  }
}

export let Listbox = Object.assign(ListboxImpl, {
  change: listboxChangeEventType,
  openChange: listboxOpenChangeEventType,
}) as ListboxComponent

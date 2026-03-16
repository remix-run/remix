// @jsxRuntime classic
// @jsx createElement
import { createElement, ref, type Handle, type Props, type RemixNode } from '@remix-run/component'

import { anchor, type AnchorOptions, type AnchorPlacement } from './anchor.ts'

export let popoverOpenChangeEventType = 'rmx:popover-open-change' as const

declare global {
  interface HTMLElementEventMap {
    [popoverOpenChangeEventType]: PopoverOpenChangeEvent
  }
}

export class PopoverOpenChangeEvent extends Event {
  open: boolean

  constructor(open: boolean) {
    super(popoverOpenChangeEventType, {
      bubbles: true,
    })
    this.open = open
  }
}

export type PopoverProps = Omit<Props<'div'>, 'children'> &
  AnchorOptions & {
    children?: RemixNode
    defaultOpen?: boolean
    open?: boolean
    owner?: string
  }

type PopoverComponent = typeof PopoverImpl & {
  readonly openChange: typeof popoverOpenChangeEventType
}

type ToggleEventLike = Event & {
  oldState?: 'open' | 'closed'
  newState?: 'open' | 'closed'
}

let fallbackOpenAttr = 'data-rmx-popover-open'
export let popoverFadeDuration = 180
let pendingHideTimers = new WeakMap<HTMLElement, number>()

function resetPopoverStyles(node: HTMLElement) {
  node.style.opacity = ''
  node.style.pointerEvents = ''
  node.style.transition = ''
}

function cancelPendingHide(node: HTMLElement) {
  let timer = pendingHideTimers.get(node)
  if (timer !== undefined) {
    clearTimeout(timer)
    pendingHideTimers.delete(node)
  }

  resetPopoverStyles(node)
}

function dispatchToggleEvent(
  node: HTMLElement,
  type: 'beforetoggle' | 'toggle',
  oldState: 'open' | 'closed',
  newState: 'open' | 'closed',
) {
  let event = new Event(type, { bubbles: false }) as ToggleEventLike
  event.oldState = oldState
  event.newState = newState
  node.dispatchEvent(event)
}

export function isPopoverOpen(node: HTMLElement | null) {
  if (!node) {
    return false
  }

  try {
    return node.matches(':popover-open')
  } catch {
    return node.getAttribute(fallbackOpenAttr) === 'true'
  }
}

export function showPopover(node: HTMLElement | null) {
  if (!node) {
    return
  }

  cancelPendingHide(node)

  if (isPopoverOpen(node)) {
    return
  }

  if (typeof node.showPopover === 'function') {
    node.showPopover()
    return
  }

  dispatchToggleEvent(node, 'beforetoggle', 'closed', 'open')
  node.setAttribute(fallbackOpenAttr, 'true')
  dispatchToggleEvent(node, 'toggle', 'closed', 'open')
}

export function hidePopover(node: HTMLElement | null, options?: { immediate?: boolean }) {
  if (!node || !isPopoverOpen(node)) {
    return
  }

  if (options?.immediate) {
    cancelPendingHide(node)
  } else if (pendingHideTimers.has(node)) {
    return
  } else {
    node.style.pointerEvents = 'none'
    node.style.transition = `opacity ${popoverFadeDuration}ms ease`
    node.style.opacity = '0'

    let timer = window.setTimeout(() => {
      pendingHideTimers.delete(node)
      resetPopoverStyles(node)
      hidePopover(node, { immediate: true })
    }, popoverFadeDuration)

    pendingHideTimers.set(node, timer)
    return
  }

  if (typeof node.hidePopover === 'function') {
    node.hidePopover()
    return
  }

  dispatchToggleEvent(node, 'beforetoggle', 'open', 'closed')
  node.removeAttribute(fallbackOpenAttr)
  dispatchToggleEvent(node, 'toggle', 'open', 'closed')
}

function PopoverImpl(handle: Handle) {
  let currentProps: PopoverProps | null = null
  let popoverNode: HTMLDivElement | null = null
  let cleanupAnchor = () => {}
  let lastKnownOpen = false

  function dispatchOpenChange(open: boolean) {
    if (!popoverNode || lastKnownOpen === open) {
      return
    }

    lastKnownOpen = open
    popoverNode.dispatchEvent(new PopoverOpenChangeEvent(open))
  }

  function resolveOwnerElement() {
    if (!popoverNode) {
      return null
    }

    let owner = currentProps?.owner
    if (owner) {
      let owned = document.getElementById(owner)
      return owned instanceof HTMLElement ? owned : null
    }

    let popoverId = popoverNode.id
    if (!popoverId) {
      return null
    }

    let ownerByTarget = document.querySelector(`[popovertarget="${popoverId}"]`)
    return ownerByTarget instanceof HTMLElement ? ownerByTarget : null
  }

  function syncAnchorPosition() {
    if (!popoverNode) {
      return
    }

    let owner = resolveOwnerElement()
    if (!owner) {
      return
    }

    cleanupAnchor()
    cleanupAnchor = anchor(popoverNode, owner, {
      placement: currentProps?.placement,
      inset: currentProps?.inset,
      relativeTo: currentProps?.relativeTo,
      offset: currentProps?.offset,
    })
  }

  function isOpen() {
    return isPopoverOpen(popoverNode)
  }

  function showPopoverNode() {
    showPopover(popoverNode)
  }

  function hidePopoverNode() {
    hidePopover(popoverNode)
  }

  function syncOpenState() {
    if (!popoverNode || currentProps?.open === undefined) {
      return
    }

    if (currentProps.open) {
      showPopoverNode()
    } else {
      hidePopoverNode()
    }
  }

  function attachNativeListeners(node: HTMLDivElement, signal: AbortSignal) {
    let handleDocumentFocusIn = (event: Event) => {
      if (!isOpen()) {
        return
      }

      let target = event.target
      if (!(target instanceof Node)) {
        return
      }

      let owner = resolveOwnerElement()
      let focusInsidePopover = node.contains(target)
      let focusInsideOwner = owner?.contains(target) ?? false

      if (!focusInsidePopover && !focusInsideOwner) {
        hidePopoverNode()
      }
    }

    let handleBeforeToggle = (event: Event) => {
      let toggleEvent = event as ToggleEventLike
      if (toggleEvent.newState === 'open') {
        syncAnchorPosition()
      }
    }

    let handleToggle = (event: Event) => {
      let toggleEvent = event as ToggleEventLike
      if (toggleEvent.newState === 'open') {
        syncAnchorPosition()
      } else {
        cleanupAnchor()
      }

      dispatchOpenChange(toggleEvent.newState === 'open')
    }

    node.addEventListener('beforetoggle', handleBeforeToggle)
    node.addEventListener('toggle', handleToggle)
    document.addEventListener('focusin', handleDocumentFocusIn)

    signal.addEventListener('abort', () => {
      node.removeEventListener('beforetoggle', handleBeforeToggle)
      node.removeEventListener('toggle', handleToggle)
      document.removeEventListener('focusin', handleDocumentFocusIn)
      cleanupAnchor()
      cleanupAnchor = () => {}
    })
  }

  return (props: PopoverProps) => {
    currentProps = props
    let mix = props.mix
      ? [
          props.mix,
          ref((node, signal) => {
            popoverNode = node as HTMLDivElement
            attachNativeListeners(popoverNode, signal)

            if (props.defaultOpen && props.open === undefined) {
              queueMicrotask(showPopoverNode)
            } else {
              queueMicrotask(syncOpenState)
            }
          }),
        ]
      : ref((node, signal) => {
          popoverNode = node as HTMLDivElement
          attachNativeListeners(popoverNode, signal)

          if (props.defaultOpen && props.open === undefined) {
            queueMicrotask(showPopoverNode)
          } else {
            queueMicrotask(syncOpenState)
          }
        })

    if (popoverNode) {
      queueMicrotask(syncOpenState)
      queueMicrotask(() => {
        if (isOpen()) {
          syncAnchorPosition()
        }
      })
    }

    return (
      <div {...props} mix={mix} popover="auto">
        {props.children}
      </div>
    )
  }
}

export let Popover = Object.assign(PopoverImpl, {
  openChange: popoverOpenChangeEventType,
}) as PopoverComponent

export type { AnchorPlacement }

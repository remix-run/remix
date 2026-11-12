import {
  attrs,
  createMixin,
  css,
  on,
  ref,
  type Dispatched,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type RemixNode,
} from '@remix-run/component'
import { anchor, type AnchorOptions } from './anchor.ts'
import { registerDismissableLayer } from './lib/dismissable-layer.ts'
import { finishAnimations } from './lib/finish-animations.ts'
import { createHoverAim } from './lib/hover-aim.ts'

const TOOLTIP_OPEN_CHANGE_EVENT = 'rmx:tooltip-open-change' as const

const DEFAULT_DELAY = 600
const DEFAULT_CLOSE_DELAY = 0
const DEFAULT_GROUP_TIMEOUT = 400
const DEFAULT_ARROW_PADDING = 5

export type TooltipOpenChangeReason =
  | 'trigger-hover'
  | 'trigger-focus'
  | 'trigger-press'
  | 'escape-key'
  | 'outside-press'
  | 'disabled'
  | 'group'

type TooltipOpenChangeHandler<target extends HTMLElement> = (
  event: Dispatched<TooltipOpenChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

export class TooltipOpenChangeEvent extends Event {
  readonly open: boolean
  readonly reason: TooltipOpenChangeReason

  constructor(open: boolean, reason: TooltipOpenChangeReason) {
    super(TOOLTIP_OPEN_CHANGE_EVENT, { bubbles: true })
    this.open = open
    this.reason = reason
  }
}

declare global {
  interface HTMLElementEventMap {
    [TOOLTIP_OPEN_CHANGE_EVENT]: TooltipOpenChangeEvent
  }
}

export interface TooltipGroupContextProps {
  children?: RemixNode
  closeDelay?: number
  delay?: number
  timeout?: number
}

export interface TooltipGroupMember {
  close(reason: TooltipOpenChangeReason): void
}

export interface TooltipGroupContextValue {
  readonly closeDelay: number | undefined
  readonly delay: number | undefined
  readonly warm: boolean
  closed(member: TooltipGroupMember): void
  opened(member: TooltipGroupMember): void
}

function TooltipGroupProvider(
  handle: Handle<TooltipGroupContextProps, TooltipGroupContextValue>,
): () => RemixNode {
  let current: TooltipGroupMember | null = null
  let cooling = false
  let coolingTimer: ReturnType<typeof setTimeout> | undefined
  handle.signal.addEventListener('abort', () => clearTimeout(coolingTimer))

  handle.context.set({
    get closeDelay() {
      return handle.props.closeDelay
    },
    get delay() {
      return handle.props.delay
    },
    get warm() {
      return current !== null || cooling
    },
    opened(member) {
      let previous = current
      current = member
      if (previous && previous !== member) {
        previous.close('group')
      }
    },
    closed(member) {
      if (current === member) {
        current = null
        cooling = true
        clearTimeout(coolingTimer)
        coolingTimer = setTimeout(
          () => (cooling = false),
          handle.props.timeout ?? DEFAULT_GROUP_TIMEOUT,
        )
      }
    },
  })

  return () => handle.props.children
}

export interface TooltipContextProps {
  children?: RemixNode
  closeDelay?: number
  defaultOpen?: boolean
  delay?: number
  disabled?: boolean
  onOpenChange?: (open: boolean, reason: TooltipOpenChangeReason) => void
  open?: boolean
}

export interface TooltipArrowRef {
  node: HTMLElement
  padding: number
}

export interface TooltipContextValue {
  readonly disabled: boolean
  readonly instant: boolean
  readonly open: boolean
  readonly popup: HTMLElement | null
  readonly trigger: HTMLElement | null
  readonly arrow: TooltipArrowRef | null
  dismiss(reason: TooltipOpenChangeReason): void
  focusEnd(related: EventTarget | null): void
  focusStart(): void
  hide(reason: TooltipOpenChangeReason): void
  hoverEnd(event: PointerEvent): void
  hoverStart(): void
  popupHoverEnd(event: PointerEvent): void
  registerArrow(arrow: TooltipArrowRef | null): void
  registerPopup(node: HTMLElement | null): void
  registerTrigger(node: HTMLElement | null): void
  show(reason: TooltipOpenChangeReason): void
}

function TooltipProvider(
  handle: Handle<TooltipContextProps, TooltipContextValue>,
): () => RemixNode {
  let group = handle.context.get(TooltipGroupProvider)
  let hoverAim = createHoverAim()
  let uncontrolledOpen = false
  let hasInitialized = false
  let instant = false
  // Set when the user dismisses the tooltip while still on the trigger (press or Escape). Hover and
  // focus do not reopen it until the pointer leaves or focus moves away.
  let suppressed = false
  let hovering = false
  // Whether the owner last saw the tooltip open, so disabling reports a close only when one happens.
  let reportedOpen = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopAimTracking = () => {}
  let triggerNode: HTMLElement | null = null
  let popupNode: HTMLElement | null = null
  let arrowRef: TooltipArrowRef | null = null
  let member: TooltipGroupMember = { close: (reason) => setOpen(false, reason, true) }
  let inGroup = false

  handle.signal.addEventListener('abort', () => {
    clearTimeout(timer)
    stopAimTracking()
    if (inGroup) group?.closed(member)
    inGroup = false
  })

  function requestedOpen() {
    if (!hasInitialized) {
      uncontrolledOpen = handle.props.defaultOpen === true
      hasInitialized = true
    }
    return handle.props.open ?? uncontrolledOpen
  }

  function isOpen() {
    return requestedOpen() && handle.props.disabled !== true
  }

  function cancelPending() {
    clearTimeout(timer)
    stopAimTracking()
  }

  // `instantChange` marks opens and closes that skip delays because of a warm group, so CSS can
  // skip transitions with `[data-instant]`.
  function setOpen(open: boolean, reason: TooltipOpenChangeReason, instantChange = false) {
    cancelPending()
    if (open && handle.props.disabled) return
    if (isOpen() === open) return
    commit(open, reason, instantChange)
  }

  function commit(open: boolean, reason: TooltipOpenChangeReason, instantChange = false) {
    instant = instantChange
    if (handle.props.open === undefined) {
      uncontrolledOpen = open
    }
    reportedOpen = open
    void handle.update()
    syncGroup()

    handle.props.onOpenChange?.(open, reason)
    triggerNode?.dispatchEvent(new TooltipOpenChangeEvent(open, reason))
  }

  // Group membership follows the rendered state, not open requests, so a controlled owner that
  // declines a request or changes `open` itself never leaves the group stuck warm.
  function syncGroup() {
    // Renders queue this, so it can run after an unmount that would otherwise leave the group warm.
    if (handle.signal.aborted) return
    let open = isOpen()
    if (!group || open === inGroup) return
    inGroup = open
    if (open) group.opened(member)
    else group.closed(member)
  }

  function schedule(open: boolean, reason: TooltipOpenChangeReason, delay: number) {
    cancelPending()
    if (delay <= 0) {
      setOpen(open, reason)
      return
    }
    timer = setTimeout(() => setOpen(open, reason), delay)
  }

  function getCloseDelay() {
    return handle.props.closeDelay ?? group?.closeDelay ?? DEFAULT_CLOSE_DELAY
  }

  handle.context.set({
    get arrow() {
      return arrowRef
    },
    get disabled() {
      return handle.props.disabled === true
    },
    get instant() {
      return instant
    },
    get open() {
      return isOpen()
    },
    get popup() {
      return popupNode
    },
    get trigger() {
      return triggerNode
    },
    show(reason) {
      setOpen(true, reason)
    },
    hide(reason) {
      setOpen(false, reason)
    },
    dismiss(reason) {
      // Only suppress while the user is still on the trigger; otherwise nothing would clear it.
      if (hovering || (triggerNode && triggerNode.contains(document.activeElement))) {
        suppressed = true
      }
      setOpen(false, reason)
    },
    focusStart() {
      if (!suppressed) setOpen(true, 'trigger-focus')
    },
    focusEnd(related) {
      // Focus may move into the popup (it is focusable with tabIndex -1), which keeps it open.
      if (related instanceof Node && popupNode?.contains(related)) return
      if (related instanceof Node && triggerNode?.contains(related)) return
      suppressed = false
      setOpen(false, 'trigger-focus')
    },
    hoverStart() {
      hovering = true
      if (suppressed || handle.props.disabled) return
      if (isOpen()) {
        cancelPending()
        return
      }
      if (group?.warm) {
        setOpen(true, 'trigger-hover', true)
        return
      }
      schedule(true, 'trigger-hover', handle.props.delay ?? group?.delay ?? DEFAULT_DELAY)
    },
    hoverEnd(event) {
      hovering = false
      suppressed = false
      if (!isOpen()) {
        cancelPending()
        return
      }

      // Keep the tooltip open while the pointer travels toward it so its content stays hoverable.
      // The aim session can expire after the pointer has already returned, so expiry only closes
      // the tooltip while this tracking is still current.
      let controller = new AbortController()
      let closeAfterAim = () => {
        if (!controller.signal.aborted) schedule(false, 'trigger-hover', getCloseDelay())
      }
      if (
        triggerNode &&
        popupNode &&
        hoverAim.start(triggerNode, popupNode, event, closeAfterAim)
      ) {
        let popup = popupNode
        let trigger = triggerNode
        stopAimTracking = () => controller.abort()
        document.addEventListener(
          'pointermove',
          (moveEvent) => {
            if (!hoverAim.accepts(moveEvent)) return
            controller.abort()
            let target = moveEvent.target as Node | null
            if (!target || (!popup.contains(target) && !trigger.contains(target))) {
              schedule(false, 'trigger-hover', getCloseDelay())
            }
          },
          { capture: true, signal: controller.signal },
        )
        return
      }

      schedule(false, 'trigger-hover', getCloseDelay())
    },
    popupHoverEnd(event) {
      let related = event.relatedTarget
      if (related instanceof Node && triggerNode?.contains(related)) return
      suppressed = false
      schedule(false, 'trigger-hover', getCloseDelay())
    },
    registerArrow(arrow) {
      arrowRef = arrow
    },
    registerPopup(node) {
      popupNode = node
    },
    registerTrigger(node) {
      triggerNode = node
    },
  })

  // Disabling an open tooltip hides it on this render and reports the close once rendering is done.
  // The report happens once per disable, even if a controlled owner keeps `open` true.
  return () => {
    if (handle.props.disabled) {
      cancelPending()
      if (reportedOpen && requestedOpen()) {
        queueMicrotask(() => {
          if (handle.props.disabled && requestedOpen()) commit(false, 'disabled')
        })
      }
    }
    reportedOpen = isOpen()
    if (group) queueMicrotask(syncGroup)
    return handle.props.children
  }
}

const triggerMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = handle.context.get(TooltipProvider)
  let returningToWindow = false

  return () => {
    let open = context.open

    return [
      attrs({ 'data-state': open ? 'open' : 'closed' }),
      ref((node: HTMLElement, signal) => {
        context.registerTrigger(node)
        // Returning to the window refocuses the trigger, which should not pop the tooltip back up.
        node.ownerDocument.defaultView?.addEventListener(
          'blur',
          () => {
            if (node.ownerDocument.activeElement === node && !context.open) returningToWindow = true
          },
          { signal },
        )
        signal.addEventListener('abort', () => {
          if (context.trigger === node) context.registerTrigger(null)
        })
      }),
      on('pointerenter', (event) => {
        if (event.pointerType !== 'touch') context.hoverStart()
      }),
      on('pointerleave', (event) => {
        if (event.pointerType !== 'touch') context.hoverEnd(event)
      }),
      on('focus', (event) => {
        if (returningToWindow) {
          returningToWindow = false
          return
        }
        // Pointer focus is covered by hover; only keyboard focus should reveal the tooltip.
        if (event.currentTarget.matches(':focus-visible')) context.focusStart()
      }),
      on('blur', (event) => {
        context.focusEnd(event.relatedTarget)
      }),
      on('pointerdown', (event) => {
        // Touch never hovers, so a tap must not leave hover suppressed for a later mouse.
        if (event.pointerType === 'touch') context.hide('trigger-press')
        else context.dismiss('trigger-press')
      }),
    ]
  }
})

export type TooltipPopupOptions = AnchorOptions

// Like Base UI, the arrow only receives its cross-axis offset. Its main-axis placement on the popup
// edge and its orientation belong to the consumer's CSS, keyed off `data-side`, so the shape can
// overlap the popup and avoid a subpixel seam.
function positionArrow(popup: HTMLElement, arrow: TooltipArrowRef, trigger: HTMLElement) {
  let node = arrow.node
  let side = (popup.getAttribute('data-anchor-placement') ?? 'top').split('-')[0]
  let vertical = side === 'top' || side === 'bottom'
  let popupRect = popup.getBoundingClientRect()
  let triggerRect = trigger.getBoundingClientRect()

  // Map viewport coordinates back into the popup's layout box so scale transitions on the popup
  // do not skew the arrow.
  let center: number
  let popupSize: number
  let arrowSize: number
  if (vertical) {
    let scale = popup.offsetWidth ? popupRect.width / popup.offsetWidth : 1
    center = (triggerRect.left + triggerRect.width / 2 - popupRect.left) / scale - popup.clientLeft
    popupSize = popup.clientWidth
    arrowSize = node.offsetWidth
  } else {
    let scale = popup.offsetHeight ? popupRect.height / popup.offsetHeight : 1
    center = (triggerRect.top + triggerRect.height / 2 - popupRect.top) / scale - popup.clientTop
    popupSize = popup.clientHeight
    arrowSize = node.offsetHeight
  }

  let ideal = center - arrowSize / 2
  let max = Math.max(arrow.padding, popupSize - arrowSize - arrow.padding)
  let offset = Math.min(Math.max(ideal, arrow.padding), max)

  node.style.setProperty(vertical ? 'left' : 'top', `${offset}px`)
  node.style.removeProperty(vertical ? 'top' : 'left')
  node.setAttribute('data-side', side)
  node.toggleAttribute('data-uncentered', Math.abs(offset - ideal) > 0.5)
}

const popupMixin: MixinFactory<HTMLElement, [options?: TooltipPopupOptions], ElementProps> =
  createMixin<HTMLElement, [options?: TooltipPopupOptions], ElementProps>((handle) => {
    let context = handle.context.get(TooltipProvider)
    let wasOpen = false
    // Each open or close bumps this so an exit animation that finishes late can't hide a reopened
    // popup.
    let transition = 0
    let cleanupOpen = () => {}

    function show(popup: HTMLElement, trigger: HTMLElement, anchorOptions: AnchorOptions) {
      popup.setAttribute('data-open', '')
      let cleanupAnchor = anchor(popup, trigger, {
        ...anchorOptions,
        placement: anchorOptions.placement ?? 'top',
      })
      // Anchoring and content changes move the popup, so the arrow follows its geometry.
      let syncArrow = () => {
        if (context.arrow && popup.hasAttribute('data-open')) {
          positionArrow(popup, context.arrow, trigger)
        }
      }
      let mutationObserver = new MutationObserver(syncArrow)
      mutationObserver.observe(popup, { attributeFilter: ['style', 'data-anchor-placement'] })
      let resizeObserver = new ResizeObserver(syncArrow)
      resizeObserver.observe(popup)
      syncArrow()

      // The tooltip joins the shared overlay stack so it paints above its trigger's dialog or
      // popover, stays inside that dialog's focus boundary when portaled, and takes the first
      // Escape. Outside clicks pass through to the owner; the tooltip closes on pointerdown itself.
      let layer = registerDismissableLayer(popup, {
        getParent: () => trigger,
        dismissOnEscape: () => context.open,
        onDismiss: () => context.dismiss('escape-key'),
        onParentClose() {
          teardown()
          if (context.open) {
            context.hide(
              trigger.contains(trigger.ownerDocument.activeElement)
                ? 'trigger-focus'
                : 'trigger-hover',
            )
          }
        },
        passThroughClicks: true,
      })

      let controller = new AbortController()
      popup.ownerDocument.addEventListener(
        'pointerdown',
        (event) => {
          let target = event.target
          if (target instanceof Node && (popup.contains(target) || trigger.contains(target))) {
            return
          }
          context.hide('outside-press')
        },
        { capture: true, signal: controller.signal },
      )

      function teardown() {
        transition++
        popup.removeAttribute('data-open')
        cleanupOpen()
      }

      return () => {
        cleanupOpen = () => {}
        cleanupAnchor()
        mutationObserver.disconnect()
        resizeObserver.disconnect()
        controller.abort()
        layer.dispose()
      }
    }

    return (options = {}, props = options as ElementProps) => {
      let open = context.open
      let anchorOptions: AnchorOptions = options === props ? {} : options
      let changed = open !== wasOpen
      wasOpen = open

      if (changed) {
        handle.queueTask((node, signal) => {
          let current = ++transition
          if (open) {
            // Reopening during an exit animation keeps the popup that is still showing.
            if (node.hasAttribute('data-open') || !context.trigger) return
            cleanupOpen = show(node, context.trigger, anchorOptions)
            return
          }
          let finishClose = () => {
            if (signal.aborted || current !== transition) return
            node.removeAttribute('data-open')
            cleanupOpen()
          }
          let finished = finishAnimations([node])
          if (finished) void finished.then(finishClose)
          else finishClose()
        })
      }

      return [
        attrs({
          'data-instant': context.instant ? '' : undefined,
          'data-state': open ? 'open' : 'closed',
          tabIndex: -1,
        }),
        css({
          position: 'fixed',
          width: 'max-content',
          zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
          '&:not([data-open])': { display: 'none' },
        }),
        ref((node: HTMLElement, signal) => {
          context.registerPopup(node)
          signal.addEventListener('abort', () => {
            transition++
            node.removeAttribute('data-open')
            cleanupOpen()
            if (context.popup === node) context.registerPopup(null)
          })
        }),
        on('pointerenter', (event) => {
          if (event.pointerType !== 'touch') context.hoverStart()
        }),
        on('pointerleave', (event) => {
          if (event.pointerType !== 'touch') context.popupHoverEnd(event)
        }),
        on('focusout', (event) => {
          let related = event.relatedTarget
          if (related instanceof Node && event.currentTarget.contains(related)) return
          context.focusEnd(related)
        }),
      ]
    }
  })

export interface TooltipArrowOptions {
  /** Minimum distance between the arrow and the popup's edges, in pixels (defaults to `5`). */
  padding?: number
}

const arrowMixin: MixinFactory<HTMLElement, [options?: TooltipArrowOptions], ElementProps> =
  createMixin<HTMLElement, [options?: TooltipArrowOptions], ElementProps>((handle) => {
    let context = handle.context.get(TooltipProvider)
    let arrowRef: TooltipArrowRef | null = null

    return (options = {}, props = options as ElementProps) => {
      let padding =
        options === props ? DEFAULT_ARROW_PADDING : (options.padding ?? DEFAULT_ARROW_PADDING)
      if (arrowRef) arrowRef.padding = padding

      return [
        attrs({ 'aria-hidden': 'true' }),
        css({ position: 'absolute', pointerEvents: 'none' }),
        ref((node: HTMLElement, signal) => {
          arrowRef = { node, padding }
          context.registerArrow(arrowRef)
          signal.addEventListener('abort', () => {
            if (context.arrow?.node === node) context.registerArrow(null)
            arrowRef = null
          })
        }),
      ]
    }
  })

export const GroupContext = TooltipGroupProvider
export const Context = TooltipProvider
export const trigger = triggerMixin
export const popup = popupMixin
export const arrow = arrowMixin

export function onTooltipOpenChange<target extends HTMLElement>(
  handler: TooltipOpenChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TOOLTIP_OPEN_CHANGE_EVENT>> {
  return on(TOOLTIP_OPEN_CHANGE_EVENT, handler, captureBoolean)
}

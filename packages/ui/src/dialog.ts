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
  type MixinHandle,
  type RemixNode,
} from '@remix-run/component'
import { activateFocusScope } from './dialog/focus.ts'
import { registerDismissableLayer } from './lib/dismissable-layer.ts'
import { finishAnimations } from './lib/finish-animations.ts'
import { lockScroll } from './lib/scroll-lock.ts'

// The dialog moves focus itself, so a mouse press on its trigger or close button must not move
// focus to the button afterwards, which it would when the button activates on press (`press()`).
function keepFocus(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button === 0) event.preventDefault()
}

const DIALOG_CHANGE_EVENT = 'rmx:dialog-change' as const

/** The interaction that requested a dialog state change. */
export type DialogChangeReason =
  | 'trigger'
  | 'close'
  | 'escape-key'
  | 'outside-click'
  | 'focus-out'
  | 'programmatic'

/** Modal behavior for a dialog. `trap-focus` allows outside pointer interaction and scrolling. */
export type DialogModal = boolean | 'trap-focus'

/** A focus target, a default-behavior flag, or a callback evaluated when focus moves. */
export type DialogFocusTarget =
  | HTMLElement
  | boolean
  | null
  | (() => HTMLElement | boolean | null | undefined)

/** A cancelable open-state request, dispatched from the dialog surface. */
export class DialogChangeEvent extends Event {
  /** The requested open state. */
  readonly open: boolean
  /** The interaction that requested the change. */
  readonly reason: DialogChangeReason
  /** The original browser event, when the request came from an interaction. */
  readonly sourceEvent: Event | undefined

  constructor(open: boolean, reason: DialogChangeReason, sourceEvent?: Event) {
    super(DIALOG_CHANGE_EVENT, { bubbles: true, cancelable: true })
    this.open = open
    this.reason = reason
    this.sourceEvent = sourceEvent
  }
}

declare global {
  interface HTMLElementEventMap {
    [DIALOG_CHANGE_EVENT]: DialogChangeEvent
  }
}

/** Imperative access to one dialog instance, including triggers outside its context. */
export type DialogRef = {
  /** Whether the dialog is open. */
  readonly open: boolean
  /** Opens the dialog and optionally records its opener for focus restoration. */
  show(trigger?: HTMLElement): void
  /** Requests that the dialog close. */
  close(): void
}

/** State and interaction options for `dialog.Context`. */
export type DialogContextProps = {
  /** Dialog parts and app-owned content. */
  children?: RemixNode
  /** Controlled open state. */
  open?: boolean
  /** Initial uncontrolled open state. Defaults to false. */
  defaultOpen?: boolean
  /** Whether to block outside interaction, trap only focus, or allow both. Defaults to true. */
  modal?: DialogModal
  /** Whether Escape requests a close. Defaults to true. */
  closeOnEscape?: boolean
  /** Whether outside clicks and non-modal focus departure request a close. Defaults to true. */
  closeOnOutsideClick?: boolean
  /** Receives open-state requests. Call `event.preventDefault()` to cancel one. */
  onOpenChange?: (open: boolean, event: DialogChangeEvent) => void
  /** Called after the surface and backdrop finish their finite animations and transitions. */
  onOpenChangeComplete?: (open: boolean) => void
  /** Receives a stable imperative ref once after the first render. */
  ref?: (dialog: DialogRef) => void
}

/** Focus options for a dialog surface. */
export type DialogSurfaceOptions = {
  /** Initial focus target. Defaults to the registered target, first tabbable element, or surface. */
  initialFocus?: DialogFocusTarget
  /** Closing focus target. Defaults to the registered target, opener, or previously focused element. */
  finalFocus?: DialogFocusTarget
}

type DialogContextValue = {
  readonly open: boolean
  readonly modal: DialogModal
  readonly nested: boolean
  readonly parentSurface: HTMLElement | null
  readonly closeOnEscape: boolean
  readonly closeOnOutsideClick: boolean
  readonly surfaceId: string
  readonly titleId: string
  readonly descriptionId: string
  surface: HTMLElement | null
  backdrop: HTMLElement | null
  trigger: HTMLElement | null
  triggers: Set<HTMLElement>
  openingEvent: Event | undefined
  closingReason: DialogChangeReason | undefined
  showFocusTarget: HTMLElement | null
  hideFocusTarget: HTMLElement | null
  isTrigger(target: Node): boolean
  request(open: boolean, reason: DialogChangeReason, event?: Event, trigger?: HTMLElement): boolean
  complete(open: boolean): void
  syncBackdrop(): void
}

function DialogProvider(handle: Handle<DialogContextProps, DialogContextValue>): () => RemixNode {
  let parent = handle.context.get(DialogProvider)
  let initialized = false
  let uncontrolledOpen = false
  let hasOpened = false

  function getOpen() {
    if (!initialized) {
      uncontrolledOpen = handle.props.defaultOpen ?? false
      initialized = true
    }
    return (handle.props.open ?? uncontrolledOpen) && (parent?.open ?? true)
  }

  let context: DialogContextValue = {
    get open() {
      return getOpen()
    },
    get modal() {
      return handle.props.modal ?? true
    },
    get parentSurface() {
      return parent?.surface ?? null
    },
    get nested() {
      return !!parent
    },
    get closeOnEscape() {
      return handle.props.closeOnEscape !== false
    },
    get closeOnOutsideClick() {
      return handle.props.closeOnOutsideClick !== false
    },
    surfaceId: `${handle.id}-dialog`,
    titleId: `${handle.id}-title`,
    descriptionId: `${handle.id}-description`,
    surface: null,
    backdrop: null,
    trigger: null,
    triggers: new Set(),
    openingEvent: undefined,
    closingReason: undefined,
    showFocusTarget: null,
    hideFocusTarget: null,
    isTrigger(target) {
      return (
        context.trigger?.contains(target) === true ||
        [...context.triggers].some((trigger) => trigger.contains(target))
      )
    },
    request(open, reason, sourceEvent, trigger) {
      if (open === getOpen() || handle.signal.aborted) return false
      let event = new DialogChangeEvent(open, reason, sourceEvent)
      context.surface?.dispatchEvent(event)
      handle.props.onOpenChange?.(open, event)
      if (event.defaultPrevented) return false
      context.closingReason = open ? undefined : reason
      if (open) {
        context.trigger = trigger ?? null
        context.openingEvent = sourceEvent
      }
      if (handle.props.open === undefined) {
        uncontrolledOpen = open
        void handle.update()
      }
      return true
    },
    syncBackdrop() {},
    complete(open) {
      handle.props.onOpenChangeComplete?.(open)
    },
  }
  handle.context.set(context)
  handle.queueTask(() => {
    handle.props.ref?.({
      get open() {
        return context.open
      },
      show(trigger) {
        context.request(true, 'programmatic', undefined, trigger)
      },
      close() {
        context.request(false, 'programmatic')
      },
    })
  })
  return () => {
    if (hasOpened && parent && !parent.open) uncontrolledOpen = false
    hasOpened ||= getOpen()
    return handle.props.children
  }
}

function getDialogContext(handle: MixinHandle) {
  let context = handle.context.get(DialogProvider)
  if (!context) throw new Error('Dialog mixins require a dialog.Context ancestor')
  return context
}

const triggerMixin: MixinFactory<HTMLButtonElement, [], ElementProps> = createMixin<
  HTMLButtonElement,
  [],
  ElementProps
>((handle) => {
  let context = getDialogContext(handle)
  return (props) => [
    attrs({
      type: props.type ?? 'button',
      'aria-haspopup': 'dialog',
      'aria-controls': context.surfaceId,
      'aria-expanded': context.open ? 'true' : 'false',
      'data-state': context.open ? 'open' : 'closed',
    }),
    ref((node: HTMLButtonElement, signal) => {
      context.triggers.add(node)
      signal.addEventListener('abort', () => context.triggers.delete(node))
    }),
    on('pointerdown', (event) => keepFocus(event)),
    on('click', (event) => {
      if (
        event.defaultPrevented ||
        event.currentTarget.disabled ||
        event.currentTarget.getAttribute('aria-disabled') === 'true'
      )
        return
      context.request(!context.open, 'trigger', event, event.currentTarget)
    }),
  ]
})

function resolveFocus(target: DialogFocusTarget | undefined): HTMLElement | false | null {
  let resolved = typeof target === 'function' ? target() : target
  return resolved === false ? false : resolved instanceof HTMLElement ? resolved : null
}

const surfaceMixin: MixinFactory<HTMLElement, [options?: DialogSurfaceOptions], ElementProps> =
  createMixin<HTMLElement, [options?: DialogSurfaceOptions], ElementProps>((handle) => {
    let context = getDialogContext(handle)
    let previousOpen = false
    let transition = 0
    let surfaceNode: HTMLElement | null = null
    let layer: ReturnType<typeof registerDismissableLayer> | undefined
    let focusScope: ReturnType<typeof activateFocusScope> | undefined
    let activeModal: DialogModal | undefined
    let unlockScroll = () => {}
    let latestOptions: DialogSurfaceOptions = {}
    let previouslyFocused: HTMLElement | null = null

    context.syncBackdrop = () => {
      if (surfaceNode?.hasAttribute('data-open')) context.backdrop?.setAttribute('data-open', '')
      layer?.update()
    }

    function release() {
      layer?.dispose()
      layer = undefined
      focusScope?.dispose({
        restoreFocus:
          context.closingReason !== 'focus-out' &&
          !(context.modal === false && context.closingReason === 'outside-click'),
      })
      focusScope = undefined
      unlockScroll()
      unlockScroll = () => {}
      activeModal = undefined
      previouslyFocused = null
    }

    function hide(node: HTMLElement) {
      node.removeAttribute('data-open')
      context.backdrop?.removeAttribute('data-open')
      release()
    }

    function configureFocus(node: HTMLElement, initial: boolean) {
      unlockScroll()
      unlockScroll = context.modal === true ? lockScroll(node.ownerDocument) : () => {}
      activeModal = context.modal
      if (focusScope) {
        focusScope.update({ modal: context.modal })
        return
      }
      let openingEvent = context.openingEvent
      let touch = openingEvent instanceof PointerEvent && openingEvent.pointerType === 'touch'
      focusScope = activateFocusScope(node, {
        modal: context.modal,
        initialFocus: initial
          ? (resolveFocus(latestOptions.initialFocus) ??
            context.showFocusTarget ??
            (touch ? node : null))
          : false,
        returnFocus: () =>
          resolveFocus(latestOptions.finalFocus) ??
          context.hideFocusTarget ??
          context.trigger ??
          previouslyFocused,
        getBackdrop: () => context.backdrop,
        onFocusOutside(event) {
          if (event.target instanceof Node && context.isTrigger(event.target)) return
          if (context.closeOnOutsideClick) context.request(false, 'focus-out', event)
        },
      })
    }

    handle.addEventListener('insert', ({ node }) => {
      if (context.surface && context.surface !== node)
        throw new Error('dialog.Context supports one dialog.surface()')
      context.surface = node
      surfaceNode = node
    })
    handle.addEventListener('remove', () => {
      transition++
      let node = surfaceNode
      surfaceNode = null
      if (!node) return
      hide(node)
      if (context.surface === node) {
        context.surface = null
        context.syncBackdrop = () => {}
      }
    })

    return (options = {}, props = options as ElementProps) => {
      latestOptions = options
      let open = context.open
      let changed = open !== previousOpen
      previousOpen = open
      handle.queueTask(async (node, signal) => {
        if (!props['aria-labelledby'] && !props['aria-label']) {
          if (node.querySelector(`[id="${context.titleId}"]`))
            node.setAttribute('aria-labelledby', context.titleId)
          else node.removeAttribute('aria-labelledby')
        }
        if (!props['aria-describedby']) {
          if (node.querySelector(`[id="${context.descriptionId}"]`))
            node.setAttribute('aria-describedby', context.descriptionId)
          else node.removeAttribute('aria-describedby')
        }
        if (open && !focusScope) {
          // Capture the opener before revealing content or applying initial focus.
          let active = node.ownerDocument.activeElement
          while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
          previouslyFocused = active instanceof HTMLElement ? active : null
        }
        if (open && (changed || focusScope) && context.backdrop) {
          context.backdrop.setAttribute('data-open', '')
          layer?.update()
        }
        if (!changed) {
          if (open && focusScope && activeModal !== context.modal) configureFocus(node, false)
          return
        }
        let currentTransition = ++transition
        if (open) {
          node.setAttribute('data-open', '')
          if (!layer) {
            layer = registerDismissableLayer(node, {
              getParent: () => context.trigger ?? context.parentSurface,
              getBackdrop: () => context.backdrop,
              dismissOnEscape: () => context.open && context.closeOnEscape,
              dismissOnOutsideClick: () => context.open && context.closeOnOutsideClick,
              stopOutsideClickPropagation: () => context.modal === true,
              isInside: (target) => context.isTrigger(target),
              onDismiss(request) {
                context.request(false, request.reason, request.event)
              },
              onParentClose() {
                transition++
                hide(node)
                context.request(false, 'programmatic')
              },
            })
          }
          if (!focusScope) configureFocus(node, true)
        }
        await finishAnimations(context.backdrop ? [node, context.backdrop] : [node])
        if (signal.aborted || transition !== currentTransition) return
        if (!open) {
          hide(node)
        }
        context.complete(open)
      })
      return [
        attrs({
          id: context.surfaceId,
          role: props.role ?? 'dialog',
          tabIndex: props.tabIndex ?? -1,
          'aria-modal': context.modal === false ? undefined : 'true',
          'aria-labelledby':
            props['aria-labelledby'] ?? (props['aria-label'] ? undefined : context.titleId),
          'aria-describedby': props['aria-describedby'] ?? context.descriptionId,
          'data-state': open ? 'open' : 'closed',
          'data-nested': context.nested ? '' : undefined,
        }),
        css({
          position: 'fixed',
          zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
          '&:not([data-open])': { display: 'none' },
        }),
      ]
    }
  })

const backdropMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getDialogContext(handle)
  return () => [
    attrs({
      'aria-hidden': 'true',
      'data-state': context.open ? 'open' : 'closed',
    }),
    css({
      position: 'fixed',
      inset: 0,
      zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
      '&:not([data-open])': { display: 'none' },
    }),
    ref((node: HTMLElement, signal) => {
      context.backdrop = node
      context.syncBackdrop()
      signal.addEventListener('abort', () => {
        node.removeAttribute('data-open')
        if (context.backdrop === node) {
          context.backdrop = null
          context.syncBackdrop()
        }
      })
    }),
  ]
})

const closeMixin: MixinFactory<HTMLButtonElement, [], ElementProps> = createMixin<
  HTMLButtonElement,
  [],
  ElementProps
>((handle) => {
  let context = getDialogContext(handle)
  return (props) => [
    attrs({ type: props.type ?? 'button' }),
    on('pointerdown', (event) => keepFocus(event)),
    on('click', (event) => {
      if (
        event.defaultPrevented ||
        event.currentTarget.disabled ||
        event.currentTarget.getAttribute('aria-disabled') === 'true'
      )
        return
      context.request(false, 'close', event)
    }),
  ]
})

const titleMixin = createMixin<HTMLElement, []>((handle) => {
  let context = getDialogContext(handle)
  return () => attrs({ id: context.titleId })
})
const descriptionMixin = createMixin<HTMLElement, []>((handle) => {
  let context = getDialogContext(handle)
  return () => attrs({ id: context.descriptionId })
})
const focusOnShowMixin = createMixin<HTMLElement, []>(
  (handle) => {
    let context = getDialogContext(handle)
    return () =>
      ref((node: HTMLElement, signal) => {
        context.showFocusTarget = node
        signal.addEventListener('abort', () => {
          if (context.showFocusTarget === node) context.showFocusTarget = null
        })
      })
  },
  { ssr: false },
)
const focusOnHideMixin = createMixin<HTMLElement, []>(
  (handle) => {
    let context = getDialogContext(handle)
    return () =>
      ref((node: HTMLElement, signal) => {
        context.hideFocusTarget = node
        signal.addEventListener('abort', () => {
          if (context.hideFocusTarget === node) context.hideFocusTarget = null
        })
      })
  },
  { ssr: false },
)

/** Provides state and registration for one dialog. */
export const Context = DialogProvider
/** Adapts a native button to open or toggle its dialog. */
export const trigger = triggerMixin
/** Adapts an app-owned element to the dialog surface. */
export const surface = surfaceMixin
/** Registers an optional, app-styled backdrop below the surface. */
export const backdrop = backdropMixin
/** Adapts a native button to request closing its dialog. */
export const close = closeMixin
/** Associates a heading with the dialog's accessible name. */
export const title = titleMixin
/** Associates text with the dialog's accessible description. */
export const description = descriptionMixin
/** Registers the initial focus target inside the dialog. */
export const focusOnShow = focusOnShowMixin
/** Registers a focus return target, overriding the opener. */
export const focusOnHide = focusOnHideMixin

/**
 * Handles bubbling, cancelable dialog open-state requests.
 * @param handler The event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns An event mixin for the host element.
 */
export function onDialogChange<target extends HTMLElement>(
  handler: (
    event: Dispatched<DialogChangeEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DIALOG_CHANGE_EVENT>> {
  return on(DIALOG_CHANGE_EVENT, handler, captureBoolean)
}

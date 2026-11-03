import {
  attrs,
  createMixin,
  css,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type RemixNode,
} from '@remix-run/component'
import { anchor as positionAnchor, type AnchorOptions, type AnchorTarget } from './anchor.ts'
import { registerDismissableLayer } from './lib/dismissable-layer.ts'
import { finishAnimations } from './lib/finish-animations.ts'
import { lockScroll } from './lib/scroll-lock.ts'

export type PopoverContext = {
  hideFocusTarget: HTMLElement | null
  showFocusTarget: HTMLElement | null
  surface: HTMLElement | null
  anchor: AnchorRef | null
}

export type PopoverProps = {
  children?: RemixNode
}

type AnchorRef = {
  /** Element that owns a popup positioned at viewport coordinates. */
  source?: HTMLElement
  target: AnchorTarget
  options: AnchorOptions
}

function PopoverProvider(handle: Handle<PopoverProps, PopoverContext>): () => RemixNode {
  handle.context.set({
    hideFocusTarget: null,
    showFocusTarget: null,
    surface: null,
    anchor: null,
  })

  return () => handle.props.children
}

export type PopoverSurfaceOptions = {
  open: boolean
  onHide: (request?: PopoverHideRequest) => void
  closeOnAnchorClick?: boolean
  restoreFocusOnHide?: boolean
  stopOutsideClickPropagation?: boolean
}

export type PopoverHideRequest = {
  reason: 'escape-key' | 'outside-click'
  target?: Node | null
}

const anchorMixin: MixinFactory<HTMLElement, [options: AnchorOptions], ElementProps> = createMixin<
  HTMLElement,
  [options: AnchorOptions]
>(
  (handle) => {
    let context = handle.context.get(PopoverProvider)
    return (options) => {
      handle.queueTask((node) => {
        context.anchor = { target: node, options }
      })
    }
  },
  { ssr: false },
)

function anchorContains(anchor: AnchorRef | null, target: Node) {
  return anchor?.target instanceof HTMLElement && anchor.target.contains(target)
}

const surfaceMixin: MixinFactory<HTMLElement, [options: PopoverSurfaceOptions], ElementProps> =
  createMixin<HTMLElement, [options: PopoverSurfaceOptions]>((handle) => {
    let openProp = false
    let transition = 0
    let cleanupAnchor = () => {}
    let unlockScroll = () => {}
    let disposeLayer = () => {}
    let currentOptions: PopoverSurfaceOptions
    let context = handle.context.get(PopoverProvider)

    function cleanup() {
      disposeLayer()
      cleanupAnchor()
      unlockScroll()
    }

    handle.queueTask((node, signal) => {
      context.surface = node

      signal.addEventListener('abort', () => {
        transition++
        node.removeAttribute('data-open')
        cleanup()
        if (context.surface === node) {
          context.surface = null
        }
      })
    })

    return (options) => {
      currentOptions = options
      let wasOpen = openProp
      openProp = options.open

      handle.queueTask((node, signal) => {
        if (openProp === wasOpen) return
        let currentTransition = ++transition
        if (openProp && !wasOpen) {
          let anchor = context.anchor
          if (!anchor) {
            throw new Error('popover.surface() requires a registered anchor before opening')
          }
          if (node.hasAttribute('data-open')) return
          node.setAttribute('data-open', '')
          cleanupAnchor = positionAnchor(node, anchor.target, anchor.options)
          unlockScroll = lockScroll(node.ownerDocument)
          disposeLayer = registerDismissableLayer(node, {
            getParent: () =>
              context.anchor?.source ??
              (context.anchor?.target instanceof HTMLElement ? context.anchor.target : null),
            onParentClose() {
              transition++
              node.removeAttribute('data-open')
              cleanup()
              // A parent can close before a child portal has committed its new options.
              queueMicrotask(() => {
                if (!signal.aborted && currentOptions.open) currentOptions.onHide()
              })
            },
            dismissOnEscape: () => currentOptions.open,
            dismissOnOutsideClick: () => currentOptions.open,
            onDismiss(request) {
              currentOptions.onHide(
                request.reason === 'escape-key'
                  ? { reason: 'escape-key' }
                  : { reason: 'outside-click', target: request.target },
              )
            },
            isInside: (target) =>
              currentOptions.closeOnAnchorClick === false && anchorContains(context.anchor, target),
            stopOutsideClickPropagation: () => currentOptions.stopOutsideClickPropagation ?? true,
          }).dispose
          // Descendant focus mixins register after their surface's queued work.
          queueMicrotask(() => {
            if (!signal.aborted && node.hasAttribute('data-open')) context.showFocusTarget?.focus()
          })
        } else if (!openProp && wasOpen) {
          function finishClose() {
            if (signal.aborted || currentTransition !== transition) return
            node.removeAttribute('data-open')
            cleanup()
            if (currentOptions.restoreFocusOnHide !== false) context.hideFocusTarget?.focus()
          }
          let finished = finishAnimations([node])
          if (finished) void finished.then(finishClose)
          else finishClose()
        }
      })

      return [
        attrs({ 'data-popover': '', 'data-state': options.open ? 'open' : 'closed' }),
        css({
          position: 'fixed',
          width: 'max-content',
          zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
          '&:not([data-open])': { display: 'none' },
        }),
      ]
    }
  })

const focusOnShowMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<HTMLElement, []>(
  (handle) => {
    handle.addEventListener('insert', (event) => {
      let context = handle.context.get(PopoverProvider)
      context.showFocusTarget = event.node
    })
  },
  { ssr: false },
)

const focusOnHideMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<HTMLElement, []>(
  (handle) => {
    handle.addEventListener('insert', (event) => {
      let context = handle.context.get(PopoverProvider)
      context.hideFocusTarget = event.node
    })
  },
  { ssr: false },
)

export const Context = PopoverProvider
export const anchor = anchorMixin
export const surface = surfaceMixin
export const focusOnHide = focusOnHideMixin
export const focusOnShow = focusOnShowMixin

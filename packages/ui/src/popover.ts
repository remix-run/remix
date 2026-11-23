import { FocusPortal } from './lib/focus-portal.tsx'
import {
  attrs,
  createElement,
  createMixin,
  css,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type RemixNode,
} from '@remix-run/component'
import { anchor as positionAnchor, type AnchorOptions, type AnchorTarget } from './anchor.ts'
import { activeElement, SurfaceBoundary } from './lib/focus.tsx'
import { contains } from './lib/contains.ts'
import {
  getDismissableLayerBranch,
  registerDismissableLayer,
  notifyModalExemptRegionsOfScopeClose,
  isInModalExemptRegion,
} from './lib/dismissable-layer.ts'
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

/** Content and focus boundaries for one popup surface. */
export interface PopoverSurfaceContextProps {
  /** One element with `popover.surface()` and its content. */
  children?: RemixNode
}

/**
 * Provides the required boundary for one `popover.surface()` within the same `popover.Context`.
 * Its focus guards coordinate portaled Tab navigation and containment in a focus-trapping dialog.
 * Place it at the popup's DOM destination, inside `popover.Portal` when portaled.
 * @param handle Popup content and its popover context.
 * @returns The popup content with declarative focus boundaries.
 */
export function SurfaceContext(
  handle: Handle<PopoverSurfaceContextProps, { owner: PopoverContext }>,
): () => RemixNode {
  let owner = handle.context.get(PopoverProvider)
  if (!owner) throw new Error('popover.SurfaceContext requires a popover.Context ancestor')
  handle.context.set({ owner })
  return () => createElement(SurfaceBoundary, { owner }, handle.props.children)
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
    let boundary = handle.context.get(SurfaceBoundary)
    let scoped = handle.context.get(SurfaceContext)
    if (!context || scoped?.owner !== context || boundary?.owner !== context)
      throw new Error('popover.surface() requires a matching popover.SurfaceContext ancestor')

    function cleanup(node: HTMLElement) {
      // Preserve the return path before removing this popup from its owner's layer branch.
      notifyModalExemptRegionsOfScopeClose(
        node,
        getDismissableLayerBranch(node),
        context.hideFocusTarget ??
          context.anchor?.source ??
          (context.anchor?.target instanceof HTMLElement ? context.anchor.target : null),
      )
      disposeLayer()
      cleanupAnchor()
      unlockScroll()
    }

    handle.queueTask((node, signal) => {
      context.surface = node
      boundary.registerSurface(node, signal)

      signal.addEventListener('abort', () => {
        transition++
        node.removeAttribute('data-open')
        cleanup(node)
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
              cleanup(node)
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
            cleanup(node)
            if (
              currentOptions.restoreFocusOnHide !== false &&
              boundary.portal?.restoreFocus !== false &&
              !isInModalExemptRegion(node.ownerDocument, activeElement(node.ownerDocument))
            )
              context.hideFocusTarget?.focus()
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

/** Options for rendering the popover surface outside its authored DOM ancestors. */
export interface PopoverPortalProps {
  /** Surface content rendered at the destination. */
  children?: RemixNode
  /** Destination in the same document. Defaults to its body. Changing it remounts the content. */
  container?: HTMLElement | null
}

/**
 * Portals one popover surface while coordinating its focus navigation.
 * Keep its matching surface context inside this component. Omit it for inline rendering.
 * The origin and container must be in the document light DOM.
 * Non-modal Tab order follows this component's declaration position. Place it beside
 * the trigger when popup content should follow the trigger in sequential navigation.
 * @param handle Surface content, destination, and the owning popover context.
 * @returns The transported content with its origin focus boundaries.
 */
export function Portal(handle: Handle<PopoverPortalProps>): () => RemixNode {
  let owner = handle.context.get(PopoverProvider)
  if (!owner) throw new Error('popover.Portal requires a popover.Context ancestor')
  return () =>
    createElement(
      FocusPortal,
      {
        componentName: 'popover.Portal',
        owner,
        open: () => owner.surface?.getAttribute('data-state') === 'open',
        reference: () =>
          owner.anchor?.source ??
          (owner.anchor?.target instanceof HTMLElement ? owner.anchor.target : null),
        mode: 'navigate',
        container: handle.props.container,
      },
      handle.props.children,
    )
}

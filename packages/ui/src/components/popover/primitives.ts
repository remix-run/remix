import {
  attrs,
  createMixin,
  on,
  type ElementProps,
  type Handle,
  type MixinFactory,
  type RemixNode,
} from '@remix-run/ui'
import {
  anchor as positionAnchor,
  type AnchorOptions,
  type AnchorTarget,
} from '../anchor/primitives.ts'
import { onOutsideClick } from '../../interactions/outside-click/outside-click-mixin.ts'
import { lockScroll } from '../../utils/scroll-lock.ts'

export interface PopoverContext {
  hideFocusTarget: HTMLElement | null
  showFocusTarget: HTMLElement | null
  surface: HTMLElement | null
  anchor: AnchorRef | null
}

export interface PopoverProps {
  children?: RemixNode
}

interface AnchorRef {
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

export interface PopoverSurfaceOptions {
  open: boolean
  onHide: (request?: PopoverHideRequest) => void
  closeOnAnchorClick?: boolean
  restoreFocusOnHide?: boolean
  stopOutsideClickPropagation?: boolean
}

export interface PopoverHideRequest {
  reason: 'escape-key' | 'outside-click'
  target?: Node | null
}

const anchorMixin: MixinFactory<HTMLElement, [options: AnchorOptions], ElementProps> = createMixin<
  HTMLElement,
  [options: AnchorOptions]
>((handle) => {
  let context = handle.context.get(PopoverProvider)
  return (options) => {
    handle.queueTask((node) => {
      context.anchor = { target: node, options }
    })
  }
})

function anchorContains(anchor: AnchorRef | null, target: Node) {
  return anchor?.target instanceof HTMLElement && anchor.target.contains(target)
}

const surfaceMixin: MixinFactory<HTMLElement, [options: PopoverSurfaceOptions], ElementProps> =
  createMixin<HTMLElement, [options: PopoverSurfaceOptions]>((handle) => {
    let openProp = false
    let cleanupAnchor = () => {}
    let unlockScroll = () => {}
    let context = handle.context.get(PopoverProvider)

    handle.queueTask((node, signal) => {
      context.surface = node

      signal.addEventListener('abort', () => {
        if (context.surface === node) {
          context.surface = null
        }
      })
    })

    return (options) => {
      let wasOpen = openProp
      openProp = options.open

      handle.queueTask(async (node) => {
        if (openProp && !wasOpen) {
          node.showPopover()
        } else if (!openProp && wasOpen) {
          node.hidePopover()
        }
      })

      return [
        attrs({ popover: 'manual' }),

        on('beforetoggle', (event) => {
          if (event.newState === 'open') {
            let anchor = context.anchor
            if (!anchor) {
              throw new Error('popover.surface() requires a registered anchor before opening')
            }

            cleanupAnchor = positionAnchor(event.currentTarget, anchor.target, anchor.options)
            unlockScroll = lockScroll()
          } else if (event.newState === 'closed') {
            cleanupAnchor()
            unlockScroll()
          }
        }),

        on('toggle', async (event) => {
          if (event.newState === 'open') {
            context.showFocusTarget?.focus()
          } else if (event.newState === 'closed' && options.restoreFocusOnHide !== false) {
            context.hideFocusTarget?.focus()
          }
        }),

        on('keydown', (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            options.onHide({ reason: 'escape-key' })
          }
        }),

        onOutsideClick(
          openProp,
          (target) => {
            options.onHide({ reason: 'outside-click', target })
          },
          (target) =>
            options.closeOnAnchorClick === false && anchorContains(context.anchor, target),
          options.stopOutsideClickPropagation ?? true,
        ),
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
)

const focusOnHideMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<HTMLElement, []>(
  (handle) => {
    handle.addEventListener('insert', (event) => {
      let context = handle.context.get(PopoverProvider)
      context.hideFocusTarget = event.node
    })
  },
)

export const Context = PopoverProvider
export const anchor = anchorMixin
export const surface = surfaceMixin
export const focusOnHide = focusOnHideMixin
export const focusOnShow = focusOnShowMixin

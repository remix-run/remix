import {
  attrs,
  createMixin,
  css,
  on,
  type CSSMixinDescriptor,
  type Handle,
  type RemixNode,
} from '@remix-run/component'
import { anchor as positionAnchor, type AnchorOptions } from '../anchor/anchor.ts'
import { onOutsideClick } from '../outside-click/outside-click-mixin.ts'
import { theme } from '../theme/theme.ts'
import { lockScroll } from '../utils/scroll-lock.ts'

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
  node: HTMLElement
  options: AnchorOptions
}

const popupViewportClampMaxHeight = '50dvh'

const popoverSurfaceTransitionCss: CSSMixinDescriptor = css({
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
})

const popoverContentCss: CSSMixinDescriptor = css({
  flex: '1 1 auto',
  minHeight: 0,
  padding: theme.space.xs,
  overflow: 'auto',
  overscrollBehavior: 'contain',
})

const popoverSurfaceCss: CSSMixinDescriptor = css({
  position: 'fixed',
  inset: 'auto',
  margin: 0,
  padding: theme.space.none,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: '12rem',
  maxWidth: `min(24rem, calc(100vw - (${theme.space.lg} * 2)))`,
  maxHeight: popupViewportClampMaxHeight,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  overflow: 'hidden',
  boxShadow: `${theme.shadow.xs}, ${theme.shadow.md}`,
  '&::backdrop': {
    background: 'transparent',
  },
})

export const contentStyle = popoverContentCss
export const surfaceStyle = [popoverSurfaceCss, popoverSurfaceTransitionCss] as const

function PopoverProvider(handle: Handle<PopoverProps, PopoverContext>) {
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

const anchorMixin = createMixin<HTMLElement, [options: AnchorOptions]>((handle) => {
  let context = handle.context.get(PopoverProvider)
  return (options) => {
    handle.queueTask((node) => {
      context.anchor = { node, options }
    })
  }
})

const surfaceMixin = createMixin<HTMLElement, [options: PopoverSurfaceOptions]>((handle) => {
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
          cleanupAnchor = positionAnchor(
            event.currentTarget,
            context.anchor!.node,
            context.anchor!.options,
          )
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
        (target) => options.closeOnAnchorClick === false && !!context.anchor?.node.contains(target),
        options.stopOutsideClickPropagation ?? true,
      ),
    ]
  }
})

const focusOnShowMixin = createMixin<HTMLElement, []>((handle) => {
  handle.addEventListener('insert', (event) => {
    let context = handle.context.get(PopoverProvider)
    context.showFocusTarget = event.node
  })
})

const focusOnHideMixin = createMixin<HTMLElement, []>((handle) => {
  handle.addEventListener('insert', (event) => {
    let context = handle.context.get(PopoverProvider)
    context.hideFocusTarget = event.node
  })
})

export const Context = PopoverProvider
export const anchor = anchorMixin
export const surface = surfaceMixin
export const focusOnHide = focusOnHideMixin
export const focusOnShow = focusOnShowMixin

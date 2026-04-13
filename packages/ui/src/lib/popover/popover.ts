import { attrs, createMixin, on, type Handle, type RemixNode } from '@remix-run/component'
import { anchor, type AnchorOptions } from '../anchor/anchor.ts'
import { onOutsideClick } from '../outside-click/outside-click-mixin.ts'
import { lockScroll } from '../utils/scroll-lock.ts'

export interface PopoverContext {
  hideFocusTarget: HTMLElement | null
  showFocusTarget: HTMLElement | null
  anchor: AnchorRef | null
}

export interface PopoverProps {
  children?: RemixNode
}

interface AnchorRef {
  node: HTMLElement
  options: AnchorOptions
}

export function PopoverProvider(handle: Handle<PopoverContext>) {
  handle.context.set({
    hideFocusTarget: null,
    showFocusTarget: null,
    anchor: null,
  })

  return (props: PopoverProps) => props.children
}

export interface PopoverSurfaceOptions {
  open: boolean
  onHide: () => void
}

let anchorMixin = createMixin<HTMLElement, [options: AnchorOptions]>((handle) => {
  let context = handle.context.get(PopoverProvider)
  return (options) => {
    handle.queueTask((node) => {
      context.anchor = { node, options }
    })
  }
})

let surfaceMixin = createMixin<HTMLElement, [options: PopoverSurfaceOptions]>((handle) => {
  let openProp = false
  let cleanupAnchor = () => {}
  let unlockScroll = () => {}
  let context = handle.context.get(PopoverProvider)

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
          cleanupAnchor = anchor(event.currentTarget, context.anchor!.node, context.anchor!.options)
          unlockScroll = lockScroll()
        } else if (event.newState === 'closed') {
          cleanupAnchor()
          unlockScroll()
        }
      }),

      on('toggle', async (event) => {
        if (event.newState === 'open') {
          context.showFocusTarget?.focus()
        } else if (event.newState === 'closed') {
          context.hideFocusTarget?.focus()
        }
      }),

      on('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          options.onHide()
        }
      }),

      onOutsideClick(openProp, () => {
        options.onHide()
      }),
    ]
  }
})

let focusOnShowMixin = createMixin<HTMLElement, []>((handle) => {
  handle.addEventListener('insert', (event) => {
    let context = handle.context.get(PopoverProvider)
    context.showFocusTarget = event.node
  })
})

let focusOnHideMixin = createMixin<HTMLElement, []>((handle) => {
  handle.addEventListener('insert', (event) => {
    let context = handle.context.get(PopoverProvider)
    context.hideFocusTarget = event.node
  })
})

type PopoverApi = {
  readonly context: typeof PopoverProvider
  readonly focusOnHide: typeof focusOnHideMixin
  readonly focusOnShow: typeof focusOnShowMixin
  readonly surface: typeof surfaceMixin
  readonly anchor: typeof anchorMixin
}

export let popover: PopoverApi = {
  context: PopoverProvider,
  focusOnHide: focusOnHideMixin,
  focusOnShow: focusOnShowMixin,
  surface: surfaceMixin,
  anchor: anchorMixin,
}

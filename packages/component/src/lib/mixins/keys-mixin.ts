import { renderMixinElement } from '../mixin.ts'
import { on } from './on-mixin.ts'
import { createMixin } from '../mixin.ts'

export const escapeEventType = 'keydown:Escape' as const
export const enterEventType = 'keydown:Enter' as const
export const spaceEventType = 'keydown: ' as const
export const backspaceEventType = 'keydown:Backspace' as const
export const deleteEventType = 'keydown:Delete' as const
export const arrowLeftEventType = 'keydown:ArrowLeft' as const
export const arrowRightEventType = 'keydown:ArrowRight' as const
export const arrowUpEventType = 'keydown:ArrowUp' as const
export const arrowDownEventType = 'keydown:ArrowDown' as const
export const homeEventType = 'keydown:Home' as const
export const endEventType = 'keydown:End' as const
export const pageUpEventType = 'keydown:PageUp' as const
export const pageDownEventType = 'keydown:PageDown' as const

declare global {
  interface HTMLElementEventMap {
    [escapeEventType]: KeyboardEvent
    [enterEventType]: KeyboardEvent
    [spaceEventType]: KeyboardEvent
    [backspaceEventType]: KeyboardEvent
    [deleteEventType]: KeyboardEvent
    [arrowLeftEventType]: KeyboardEvent
    [arrowRightEventType]: KeyboardEvent
    [arrowUpEventType]: KeyboardEvent
    [arrowDownEventType]: KeyboardEvent
    [homeEventType]: KeyboardEvent
    [endEventType]: KeyboardEvent
    [pageUpEventType]: KeyboardEvent
    [pageDownEventType]: KeyboardEvent
  }
}

const keyToEventType: Record<string, string> = {
  Escape: escapeEventType,
  Enter: enterEventType,
  ' ': spaceEventType,
  Backspace: backspaceEventType,
  Delete: deleteEventType,
  ArrowLeft: arrowLeftEventType,
  ArrowRight: arrowRightEventType,
  ArrowUp: arrowUpEventType,
  ArrowDown: arrowDownEventType,
  Home: homeEventType,
  End: endEventType,
  PageUp: pageUpEventType,
  PageDown: pageDownEventType,
}

const baseKeysEvents = createMixin<HTMLElement>(
  (handle) => (props) =>
    renderMixinElement(handle.element, {
      ...(props ?? {}),
      mix: [
        on('keydown', (event) => {
          let type = keyToEventType[event.key]
          if (!type) return
          event.preventDefault()
          event.currentTarget.dispatchEvent(
            new KeyboardEvent(type, {
              key: event.key,
            }),
          )
        }),
      ],
    }),
)

type KeysEventsMixin = typeof baseKeysEvents & {
  readonly escape: typeof escapeEventType
  readonly enter: typeof enterEventType
  readonly space: typeof spaceEventType
  readonly backspace: typeof backspaceEventType
  readonly del: typeof deleteEventType
  readonly arrowLeft: typeof arrowLeftEventType
  readonly arrowRight: typeof arrowRightEventType
  readonly arrowUp: typeof arrowUpEventType
  readonly arrowDown: typeof arrowDownEventType
  readonly home: typeof homeEventType
  readonly end: typeof endEventType
  readonly pageUp: typeof pageUpEventType
  readonly pageDown: typeof pageDownEventType
}

/**
 * Normalizes common keyboard keys into custom key-specific DOM events.
 */
export const keysEvents: KeysEventsMixin = Object.assign(baseKeysEvents, {
  escape: escapeEventType,
  enter: enterEventType,
  space: spaceEventType,
  backspace: backspaceEventType,
  del: deleteEventType,
  arrowLeft: arrowLeftEventType,
  arrowRight: arrowRightEventType,
  arrowUp: arrowUpEventType,
  arrowDown: arrowDownEventType,
  home: homeEventType,
  end: endEventType,
  pageUp: pageUpEventType,
  pageDown: pageDownEventType,
})

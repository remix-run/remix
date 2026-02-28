// @jsxRuntime classic
// @jsx jsx
import { on } from './on-mixin.tsx'
import { createMixin } from '../mixin.ts'
import { jsx } from '../jsx.ts'

export let escapeEventType = 'keydown:Escape' as const
export let enterEventType = 'keydown:Enter' as const
export let spaceEventType = 'keydown: ' as const
export let backspaceEventType = 'keydown:Backspace' as const
export let deleteEventType = 'keydown:Delete' as const
export let arrowLeftEventType = 'keydown:ArrowLeft' as const
export let arrowRightEventType = 'keydown:ArrowRight' as const
export let arrowUpEventType = 'keydown:ArrowUp' as const
export let arrowDownEventType = 'keydown:ArrowDown' as const
export let homeEventType = 'keydown:Home' as const
export let endEventType = 'keydown:End' as const
export let pageUpEventType = 'keydown:PageUp' as const
export let pageDownEventType = 'keydown:PageDown' as const

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

let keyToEventType: Record<string, string> = {
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

let baseKeysEvents = createMixin<HTMLElement>((handle) => (props) => (
  <handle.element
    {...props}
    mix={[
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
    ]}
  />
))

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

export let keysEvents: KeysEventsMixin = Object.assign(baseKeysEvents, {
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

Improved type inference for `on` mixin

When defining a wrapper for `on`, use `target` generic on your handler type:

```ts
import { type Dispatched } from '@remix-run/ui'

const ACCORDION_CHANGE_EVENT = 'rmx:accordion-change' as const

type AccordionChangeEvent = Event & {
  accordionType: 'single' | 'multiple'
  itemValue: string
  value: string | null | string[]
}

declare global {
  interface HTMLElementEventMap {
    [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
  }
}

type AccordionChangeHandler<target extends HTMLElement> = (
  event: Dispatched<AccordionChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

export function onAccordionChange<target extends HTMLElement>(
  handler: AccordionChangeHandler<target>,
  captureBoolean?: boolean,
) {
  return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean)
}

let button = (
  <button
    mix={[
      onAccordionChange((event, signal) => {
        event
        // ^? Dispatched<AccordionChangeEvent, HTMLButtonElement>
        event.currentTarget
        //    ^? HTMLButtonElement
      }),
    ]}
  />
)
```

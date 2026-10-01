# accordion

`accordion` provides headless disclosure-set primitives for grouped settings, FAQ sections, and dense panels where each item owns a trigger and content region. App code owns the markup and visual styles.

## Usage

```tsx
import * as accordion from '@remix-run/ui/accordion'
import { contentStyle, headingStyle, itemStyle, rootStyle, triggerStyle } from './accordion.styles'

export function SettingsAccordion() {
  return (
    <accordion.Context defaultValue="shipping">
      <div mix={[rootStyle, accordion.root()]}>
        <accordion.ItemContext value="shipping">
          <div mix={[itemStyle, accordion.item()]}>
            <h3 mix={headingStyle}>
              <button mix={[triggerStyle, accordion.trigger()]} type="button">
                Shipping
              </button>
            </h3>
            <div mix={[contentStyle, accordion.content()]}>
              Delivery windows and carrier defaults.
            </div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="billing">
          <div mix={[itemStyle, accordion.item()]}>
            <h3 mix={headingStyle}>
              <button mix={[triggerStyle, accordion.trigger()]} type="button">
                Billing
              </button>
            </h3>
            <div mix={[contentStyle, accordion.content()]}>Review billing details.</div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  )
}
```

Use `type="multiple"` when more than one panel may stay open. `defaultValue` and `value` are arrays in multiple mode. Control the open value with `value` and `onValueChange`, or let the context own it with `defaultValue`.

Set `collapsible={false}` in single mode when the open item must stay open. The locked-open trigger receives `aria-disabled`.

Listen for bubbling changes on the root or an ancestor:

```tsx
<div
  mix={accordion.onAccordionChange((event) => {
    console.log(event.accordionType, event.itemValue, event.value)
  })}
>
  {/* accordion */}
</div>
```

## `@remix-run/ui/accordion`

- `Context`: provider for controlled or uncontrolled accordion state. Supports `value`, `defaultValue`, `onValueChange`, `disabled`, `collapsible`, and `type="multiple"`.
- `ItemContext`: provider for one item `value`. Pass `disabled` to prevent that item from opening or receiving keyboard focus.
- `root()`: wires the root element and bubbling change events.
- `item()`: wires one item wrapper.
- `trigger()`: wires the item trigger, keyboard navigation, and trigger ARIA attributes.
- `content()`: wires the item panel id, hidden state, inert state, and open or closed state attributes.
- `onAccordionChange(...)`: event mixin for the bubbling `AccordionChangeEvent`.
- `AccordionChangeEvent`: bubbling event with `value`, `itemValue`, and `accordionType`.
- `AccordionType`, `AccordionValue`, `AccordionSingleValue`, `AccordionMultipleValue`, and `AccordionHeadingLevel`: public state and configuration types.
- `AccordionBaseContextProps`, `AccordionSingleContextProps`, `AccordionMultipleContextProps`, `AccordionContextProps`, `AccordionRootOptions`, `AccordionItemOptions`, `AccordionTriggerOptions`, and `AccordionContentOptions`: context prop and mixin option types.

## Behavior Notes

- Single mode stores one open value or `null`. Multiple mode stores an array of open values.
- Single accordions are collapsible by default. Set `collapsible={false}` to keep the open item locked open.
- Root `disabled` disables every item. Item `disabled` only disables that item.
- Arrow keys move between enabled triggers. `Home` and `End` move to the first and last enabled triggers.
- Disabled items are skipped by keyboard navigation.
- Trigger and panel ids are generated and linked with `aria-controls`, `aria-labelledby`, and `aria-expanded`. Closed panels receive `aria-hidden` and `inert`.
- Each item and trigger receives `data-state="open"` or `data-state="closed"` for app-owned styling.
- `AccordionChangeEvent` bubbles from the root and includes `value`, `itemValue`, and `accordionType`.

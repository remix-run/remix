# accordion

`Accordion` renders a disclosure set with one or more expandable items. Use it for grouped settings, FAQ sections, and dense panels where each item owns a trigger and content region.

## Component Usage

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'remix/components/accordion'

export function SettingsAccordion() {
  return (
    <Accordion defaultValue="account">
      <AccordionItem value="account">
        <AccordionTrigger>Account</AccordionTrigger>
        <AccordionContent>Manage account preferences.</AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing</AccordionTrigger>
        <AccordionContent>Review billing details.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

Use `type="multiple"` when more than one panel may stay open. `defaultValue` and `value` are arrays in multiple mode.

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'remix/components/accordion'

export function StatusAccordion() {
  return (
    <Accordion defaultValue={['api', 'alerts']} type="multiple">
      <AccordionItem value="api">
        <AccordionTrigger>API status checks</AccordionTrigger>
        <AccordionContent>Review uptime checks and response time alerts.</AccordionContent>
      </AccordionItem>

      <AccordionItem disabled value="access">
        <AccordionTrigger>Access control sync</AccordionTrigger>
        <AccordionContent>This disabled item cannot be opened or focused.</AccordionContent>
      </AccordionItem>

      <AccordionItem value="alerts">
        <AccordionTrigger>Alert routing</AccordionTrigger>
        <AccordionContent>Confirm escalation rules and notification channels.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

Control the open value when state should live in the owning component. Single mode uses `string | null`; multiple mode uses `string[]`.

```tsx
import type { Handle } from 'remix/ui'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'remix/components/accordion'

export function ControlledAccordion(handle: Handle) {
  let value: string | null = 'account'

  return () => (
    <Accordion
      value={value}
      onValueChange={(nextValue) => {
        value = nextValue
        void handle.update()
      }}
    >
      <AccordionItem value="account">
        <AccordionTrigger>Account</AccordionTrigger>
        <AccordionContent>Manage account preferences.</AccordionContent>
      </AccordionItem>

      <AccordionItem value="billing">
        <AccordionTrigger>Billing</AccordionTrigger>
        <AccordionContent>Review billing details.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

Listen for bubbling `AccordionChangeEvent` events with `onAccordionChange` from `remix/components/accordion/primitives`.

```tsx
import { onAccordionChange } from 'remix/components/accordion/primitives'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'remix/components/accordion'

export function TrackedAccordion() {
  return (
    <div
      mix={[
        onAccordionChange((event) => {
          console.log(event.accordionType, event.itemValue, event.value)
        }),
      ]}
    >
      <Accordion>
        <AccordionItem value="account">
          <AccordionTrigger>Account</AccordionTrigger>
          <AccordionContent>Manage account preferences.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
```

Set `collapsible={false}` in single mode when the open item must stay open. The locked-open trigger receives `aria-disabled`.

```tsx
<Accordion collapsible={false} defaultValue="account">
  <AccordionItem value="account">
    <AccordionTrigger>Account</AccordionTrigger>
    <AccordionContent>Manage account preferences.</AccordionContent>
  </AccordionItem>
</Accordion>
```

Use `headingLevel` to choose the heading element rendered around each trigger. The default level is `3`.

```tsx
<Accordion defaultValue="shipping" headingLevel={2}>
  <AccordionItem value="shipping">
    <AccordionTrigger>Shipping</AccordionTrigger>
    <AccordionContent>Review shipping preferences.</AccordionContent>
  </AccordionItem>
</Accordion>
```

Pass `indicator={null}` to remove the default chevron, or pass a custom node to replace it.

```tsx
<AccordionTrigger indicator={null}>No indicator</AccordionTrigger>
<AccordionTrigger indicator={<span aria-hidden>+</span>}>Custom indicator</AccordionTrigger>
```

## Primitive Usage

Use the lower-level primitives when app code owns the accordion markup and styles:

```tsx
import * as accordion from 'remix/components/accordion/primitives'
import { contentStyle, headingStyle, itemStyle, rootStyle, triggerStyle } from './accordion.styles'

export function PrimitiveAccordion() {
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
      </div>
    </accordion.Context>
  )
}
```

## `remix/components/accordion`

- `Accordion`: root component. Defaults to single-item mode and supports controlled `value`, uncontrolled `defaultValue`, `onValueChange`, `disabled`, `headingLevel`, `collapsible`, and `type="multiple"`.
- `AccordionItem`: registers one accordion item by `value`. Pass `disabled` to prevent that item from opening or receiving keyboard focus.
- `AccordionTrigger`: heading-wrapped button for an item. It wires `aria-expanded`, `aria-controls`, keyboard navigation, and the default chevron indicator.
- `AccordionContent`: panel for an item. It wires the panel id, `aria-labelledby`, `aria-hidden`, inert state, and open/closed state attributes.
- `rootStyle`, `itemStyle`, `headingStyle`, `triggerStyle`, `indicatorStyle`, `panelStyle`, and `bodyStyle`: flat style mixins used by the component markup.
- `AccordionProps`, `AccordionSingleProps`, `AccordionMultipleProps`, `AccordionItemProps`, `AccordionTriggerProps`, and `AccordionContentProps`: public TypeScript props for the composed APIs.

## `remix/components/accordion/primitives`

- `Context`: lower-level provider for custom accordion composition.
- `ItemContext`: lower-level provider for one item value.
- `root()`: wires the root element and bubbling change events.
- `item()`: wires one item wrapper.
- `trigger()`: wires the item trigger, keyboard navigation, and trigger ARIA attributes.
- `content()`: wires the item panel id, hidden state, inert state, and open/closed state attributes.
- `onAccordionChange(...)`: event mixin for the bubbling `AccordionChangeEvent`.
- `AccordionChangeEvent`: bubbling event with `value`, `itemValue`, and `accordionType`.
- `AccordionType`, `AccordionValue`, `AccordionSingleValue`, `AccordionMultipleValue`, and `AccordionHeadingLevel`: public TypeScript state and configuration types.
- `AccordionBaseContextProps`, `AccordionSingleContextProps`, `AccordionMultipleContextProps`, `AccordionContextProps`, `AccordionRootOptions`, `AccordionItemOptions`, `AccordionTriggerOptions`, and `AccordionContentOptions`: primitive prop and option types for custom composition.

## Behavior Notes

- Single mode stores one open value or `null`; multiple mode stores an array of open values.
- Single accordions are collapsible by default. Set `collapsible={false}` to keep the open item locked open.
- Root `disabled` disables every item. Item `disabled` only disables that item.
- Arrow keys move between enabled triggers. `Home` and `End` move to the first and last enabled triggers.
- Disabled items are skipped by keyboard navigation.
- Trigger and panel ids are generated and linked with `aria-controls`, `aria-labelledby`, and `aria-expanded`; closed panels receive `aria-hidden` and `inert`.
- `AccordionTrigger` renders inside an `h1`-`h6` element based on `headingLevel`.
- Each item and trigger receives `data-state="open"` or `data-state="closed"` for styling.
- `AccordionChangeEvent` bubbles from the root and includes `value`, `itemValue`, and `accordionType`.

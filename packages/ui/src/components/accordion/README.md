# accordion

`Accordion` renders a disclosure set with one or more expandable items. Use it for grouped settings, FAQ sections, and dense panels where each item owns a trigger and content region.

## Usage

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'remix/ui/accordion'

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

## `accordion.*`

- `Accordion`: root component. Defaults to single-item mode and supports controlled `value`, uncontrolled `defaultValue`, `onValueChange`, `disabled`, `headingLevel`, `collapsible`, and `type="multiple"`.
- `AccordionItem`: registers one accordion item by `value`. Pass `disabled` to prevent that item from opening or receiving keyboard focus.
- `AccordionTrigger`: button for an item. It wires `aria-expanded`, `aria-controls`, keyboard navigation, and the default chevron indicator.
- `AccordionContent`: panel for an item. It wires the panel id, `aria-labelledby`, inert state, and open/closed state attributes.
- `onAccordionChange(...)`: event mixin for the bubbling `AccordionChangeEvent`.
- `AccordionChangeEvent`: bubbling event class with `value`, `itemValue`, and `accordionType`.
- `rootStyle`, `itemStyle`, `triggerStyle`, `indicatorStyle`, `panelStyle`, and `bodyStyle`: flat style mixins used by the component wrappers.

## Behavior Notes

- Single mode stores one open value or `null`; multiple mode stores an array of open values.
- Single accordions are collapsible by default. Set `collapsible={false}` to keep the open item locked open.
- Arrow keys move between enabled triggers. `Home` and `End` move to the first and last enabled triggers.
- Trigger and panel ids are generated and linked with `aria-controls`, `aria-labelledby`, and `aria-expanded`.
- `AccordionChangeEvent` bubbles from the root and includes `value`, `itemValue`, and `accordionType`.

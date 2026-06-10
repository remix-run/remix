# accordion

`accordion` is a headless primitive for disclosure sets with one or more expandable items. Use it when you want Remix to own accordion state, ARIA, keyboard navigation, and change events while your app owns markup and styles.

## Usage

```tsx
import { css } from 'remix/ui'
import * as accordion from 'remix/ui/accordion'

let root = css({ display: 'grid', gap: '4px' })
let trigger = css({ width: '100%', padding: '8px 0', textAlign: 'left' })
let panel = css({ paddingBlock: '8px' })

export function SettingsAccordion() {
  return () => (
    <accordion.Context defaultValue="account">
      <div mix={[root, accordion.root()]}>
        <accordion.ItemContext value="account">
          <div mix={accordion.item()}>
            <h3>
              <button mix={[trigger, accordion.trigger()]}>Account</button>
            </h3>
            <div mix={[panel, accordion.content()]}>Manage account preferences.</div>
          </div>
        </accordion.ItemContext>

        <accordion.ItemContext value="billing">
          <div mix={accordion.item()}>
            <h3>
              <button mix={[trigger, accordion.trigger()]}>Billing</button>
            </h3>
            <div mix={[panel, accordion.content()]}>Review billing details.</div>
          </div>
        </accordion.ItemContext>
      </div>
    </accordion.Context>
  )
}
```

Styled, fully formed accordion components live in `remix/components/accordion`:

```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'remix/components/accordion'
```

## `accordion.*`

- `Context`: coordinator for one accordion instance.
- `ItemContext`: coordinator for one accordion item.
- `root()`: mixin for the root element. It marks the root disabled/type state and provides the event dispatch target.
- `item()`: mixin for an item host. It marks disabled and open/closed state.
- `trigger(options)`: mixin for the item trigger. It wires `aria-expanded`, `aria-controls`, disabled state, click toggling, and keyboard navigation.
- `content()`: mixin for the item panel. It wires `aria-labelledby`, hidden state, inert state, and open/closed state.
- `onAccordionChange(...)`: event mixin for the bubbling `AccordionChangeEvent`.
- `AccordionChangeEvent`: bubbling event with `value`, `itemValue`, and `accordionType`.

## Behavior Notes

- Single mode stores one open value or `null`; multiple mode stores an array of open values.
- Single accordions are collapsible by default. Set `collapsible={false}` to keep the open item locked open.
- Root `disabled` disables every item. Item `disabled` only disables that item.
- Arrow keys move between enabled triggers. `Home` and `End` move to the first and last enabled triggers.
- Disabled items are skipped by keyboard navigation.
- Trigger and panel ids are generated and linked with `aria-controls`, `aria-labelledby`, and `aria-expanded`; closed panels receive `aria-hidden` and `inert`.
- Each item and trigger receives `data-state="open"` or `data-state="closed"` for styling.

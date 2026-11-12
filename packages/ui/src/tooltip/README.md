# tooltip

`tooltip` provides headless behavior for short, non-interactive descriptions of a control. Tooltips open after a hover delay or immediately on keyboard focus, and close on blur, press, pointer leave, or Escape. Use them for icon buttons and truncated labels; use `popover` for anything interactive.

## Usage

```tsx
import { css } from 'remix/component'
import { Portal } from '@remix-run/ui/portal'
import * as tooltip from '@remix-run/ui/tooltip'

export function BoldButton() {
  return () => (
    <tooltip.Context>
      <button type="button" aria-label="Bold" mix={tooltip.trigger()}>
        <BoldIcon />
      </button>
      <Portal>
        <div
          mix={[
            tooltip.popup({ placement: 'top', offset: 8 }),
            css({
              padding: '4px 8px',
              borderRadius: '6px',
              background: '#111',
              color: '#fff',
            }),
          ]}
        >
          Bold <kbd>⌘B</kbd>
          <span
            mix={[
              tooltip.arrow(),
              css({
                width: '12px',
                height: '6px',
                background: '#111',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                '&[data-side="top"]': { top: 'calc(100% - 1px)' },
                '&[data-side="bottom"]': { bottom: 'calc(100% - 1px)', rotate: '180deg' },
              }),
            ]}
          />
        </div>
      </Portal>
    </tooltip.Context>
  )
}
```

Wrap a toolbar in `tooltip.GroupContext` so moving between triggers opens the next tooltip immediately:

```tsx
<tooltip.GroupContext delay={500}>
  <BoldButton />
  <ItalicButton />
</tooltip.GroupContext>
```

## `@remix-run/ui/tooltip`

- `Context`: scopes one tooltip. Accepts `open`, `defaultOpen`, `onOpenChange(open, reason)`, `delay` (default `600`), `closeDelay` (default `0`) and `disabled`.
- `GroupContext`: shares `delay` and `closeDelay` with nested tooltips. After one opens, others open without delay until `timeout` (default `400`) milliseconds after the last one closes. Only one tooltip in a group is open at a time.
- `trigger()`: connects hover, keyboard focus, blur and press to the tooltip.
- `popup(options?)`: renders a fixed-position surface with `tabindex="-1"` and positions it with `anchor()`. Accepts all `AnchorOptions`; `placement` defaults to `'top'`. Sets `data-state`, and `data-open` while shown, including during finite exit animations. Render it in `Portal` where ancestors clip; it joins the shared overlay stack so it paints above, and stays inside the focus boundary of, the dialog or popover that contains its trigger.
- `arrow(options?)`: sets the cross-axis offset (`left` for top and bottom placements, `top` for left and right) that points its host at the trigger's center, kept `padding` (default `5`) pixels from the popup's edges. Sets `data-side` to the popup's side, and `data-uncentered` when the arrow cannot reach the trigger's center. Place it on the popup edge and orient it with CSS, overlapping the popup slightly to avoid a seam.
- `onTooltipOpenChange(handler)`: listens for the bubbling `TooltipOpenChangeEvent` dispatched from the trigger, with `open` and `reason`.
- `TooltipOpenChangeReason`: `'trigger-hover' | 'trigger-focus' | 'trigger-press' | 'escape-key' | 'outside-press' | 'disabled' | 'group'`.
- `TooltipContextProps`, `TooltipContextValue`, `TooltipGroupContextProps`, `TooltipGroupContextValue`, `TooltipGroupMember`, `TooltipArrowOptions`, `TooltipArrowRef` and `TooltipPopupOptions`: provider, context and mixin configuration types.

## Behavior Notes

- Touch hover is ignored, and pointer focus does not open the tooltip. Only `:focus-visible` focus does.
- Moving the pointer from the trigger toward the popup keeps it open, so its content stays hoverable.
- Escape closes the tooltip from anywhere in the document without moving focus, except while an input method is composing text. The tooltip consumes that Escape, so a dialog or popover underneath stays open until the next one. Pressing outside the trigger and popup also closes it.
- After pressing the trigger or Escape, the tooltip stays closed until the pointer leaves the trigger or focus moves away. Returning to the window does not reopen it on a focused trigger.
- Focus moving from the trigger into the popup keeps it open.
- Setting `disabled` on an open tooltip closes it and reports the `'disabled'` reason.
- `[data-state="open" | "closed"]` is set on the trigger and popup. `[data-instant]` is set on the popup when a warm group opened or closed it without delay, so CSS can skip transitions.
- `data-anchor-placement` on the popup reports the final placement after flipping.
- Tooltips are visual-only: the popup has no `role` and the trigger is not linked to it, because touch and screen reader users cannot reliably reach it. Give the trigger an accessible name with the same information, such as an `aria-label` matching the tooltip text.

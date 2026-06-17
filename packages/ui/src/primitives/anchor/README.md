# anchor

`anchor` positions a floating element against an anchor element or viewport coordinates and keeps it constrained to the viewport. Use it for custom floating surfaces that need placement, flipping, offsets, and optional relative alignment.

## Usage

```tsx
import { anchor } from 'remix/ui/anchor'

let trigger = document.querySelector<HTMLButtonElement>('[data-trigger]')
let panel = document.querySelector<HTMLElement>('[data-panel]')

if (trigger && panel) {
  let cleanup = anchor(panel, trigger, {
    placement: 'bottom-end',
    offset: 8,
  })

  // Later, when the surface closes or unmounts:
  cleanup()
}
```

Use the returned cleanup function with the lifecycle that owns the floating element. For native popovers, position on open and clean up on close.

```tsx
import { anchor } from 'remix/ui/anchor'

let cleanupAnchor = () => {}

button.addEventListener('click', () => {
  popover.showPopover()
})

popover.addEventListener('beforetoggle', (event) => {
  let toggleEvent = event as ToggleEvent

  if (toggleEvent.newState === 'open') {
    cleanupAnchor()
    cleanupAnchor = anchor(popover, button, {
      placement: 'bottom-start',
      offset: 4,
    })
    return
  }

  cleanupAnchor()
  cleanupAnchor = () => {}
})
```

Anchor to coordinates when the surface should open at a pointer location.

```tsx
let cleanup = anchor(popover, { x: event.clientX, y: event.clientY }, { placement: 'bottom-start' })
```

## `anchor.*`

- `anchor(floatingElement, anchorTarget, options)`: positions `floatingElement` against an element or coordinate target, starts animation-frame polling for geometry changes, and returns a cleanup function.
- `AnchorOptions`: placement, inset, relative alignment, and offset options.
- `AnchorPoint`: viewport coordinate target with `x`, `y`, and optional `width`/`height`.
- `AnchorPlacement`: exported placement names for the main sides and top/bottom start/end alignment.
- `AnchorTarget`: an `HTMLElement` or `AnchorPoint`.

## Placements

Default placement is `bottom`. Use start/end variants to align an edge instead of centering the floating element on the anchor.

```tsx
anchor(panel, trigger, { placement: 'bottom' })
anchor(panel, trigger, { placement: 'bottom-start' })
anchor(panel, trigger, { placement: 'bottom-end' })
anchor(panel, trigger, { placement: 'top' })
anchor(panel, trigger, { placement: 'left' })
anchor(panel, trigger, { placement: 'right' })
```

The positioning logic can also handle left/right start/end placements through `AnchorOptions['placement']`.

```tsx
anchor(panel, trigger, { placement: 'right-start' })
anchor(panel, trigger, { placement: 'left-end' })
```

When the requested placement would overflow the viewport, `anchor` flips to the opposite side and writes the final placement to `data-anchor-placement`.

```tsx
let cleanup = anchor(panel, trigger, {
  placement: 'bottom-start',
})

panel.dataset.anchorPlacement
```

## Offsets

Use `offset` for distance along the placement axis. Use `offsetX` and `offsetY` for independent adjustment after placement is resolved.

```tsx
anchor(panel, trigger, {
  placement: 'bottom-start',
  offset: 8,
  offsetX: 4,
  offsetY: -2,
})
```

Offsets may be numbers or functions that receive the floating element.

```tsx
anchor(panel, trigger, {
  placement: 'bottom-start',
  offset: (floating) => floating.offsetHeight / 10,
  offsetX: (floating) => floating.offsetWidth / 20,
})
```

## Inset Positioning

Pass `inset: true` to align the floating element inside the anchor edge instead of outside it. This is useful for surfaces that should visually cover or line up with the trigger.

```tsx
anchor(panel, trigger, {
  placement: 'bottom-start',
  inset: true,
})
```

## Relative Alignment

Use `relativeTo` when a child inside the floating element should align to the anchor instead of the floating element's outer box. The value is a selector scoped to the floating element.

```tsx
anchor(listbox, trigger, {
  placement: 'bottom-start',
  relativeTo: '[role="option"][aria-selected="true"]',
})
```

Combine `relativeTo` with `inset` for selected-option popovers where the selected option should sit over the trigger.

```tsx
anchor(listbox, trigger, {
  placement: 'left',
  inset: true,
  relativeTo: '[aria-selected="true"]',
})
```

## Behavior Notes

- Default placement is below the anchor.
- Supported placements include top, bottom, left, right, top/bottom start/end variants, and left/right start/end placements through `AnchorOptions['placement']`.
- The floating element flips when the requested placement would overflow the viewport and records the final placement in `data-anchor-placement`.
- Oversized floating elements are constrained with max dimensions and remain inside the viewport padding.
- Oversized inset surfaces with `relativeTo` preserve alignment by scrolling the nearest scrollable descendant when possible.
- `offset`, `offsetX`, and `offsetY` may be numbers or functions that receive the floating element.
- `relativeTo` lets a surface align to an inner element, which is useful for selected options inside popovers.
- `anchor` polls on animation frames for anchor target or floating geometry changes and repositions when either changes.
- The returned cleanup function cancels animation-frame polling.

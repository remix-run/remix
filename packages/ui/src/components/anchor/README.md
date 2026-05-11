# Anchor

`anchor` positions a floating element against an anchor element and keeps it constrained to the viewport. Use it for custom floating surfaces that need placement, flipping, offsets, and optional relative alignment.

## Usage

```tsx
import { anchor } from 'remix/ui/anchor'

let cleanup = anchor(trigger, panel, {
  placement: 'bottom-end',
  offset: 8,
})

// Later, when the surface is removed:
cleanup()
```

## `anchor.*`

- `anchor(anchorElement, floatingElement, options)`: positions `floatingElement` against `anchorElement`, starts animation-frame polling for geometry changes, and returns a cleanup function.
- `AnchorOptions`: placement, inset, relative alignment, and offset options.
- `AnchorPlacement`: public placement names for the main sides and start/end alignment.

## Behavior Notes

- Default placement is below the anchor.
- Supported placements include top, bottom, left, right, start/end variants, and internal extended left/right start/end placements.
- The floating element flips when the requested placement would overflow the viewport and records the final placement in `data-anchor-placement`.
- Oversized floating elements are constrained with max dimensions and remain inside the viewport padding.
- `offset`, `offsetX`, and `offsetY` may be numbers or functions that receive the floating element.
- `relativeTo` lets a surface align to an inner element, which is useful for selected options inside popovers.
- The returned cleanup function cancels the animation-frame polling.

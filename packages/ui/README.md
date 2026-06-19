# ui

Runtime UI primitives for Remix apps, including the component runtime, server rendering, frame hydration, reusable mixins, and headless first-party behavior primitives.

## Features

- Component runtime APIs for rendering, hydration, frame navigation, and JSX
- Server rendering APIs for streaming Remix UI trees and frames
- `mix` composition with event, ref, CSS, and animation helpers
- Headless behavior primitives for controls such as menus, listboxes, popovers, selects, and comboboxes
- Lower-level utilities for keyboard events, typeahead search, refs, attributes, and CSS transition timing

## Installation

```sh
npm i remix
```

## Usage

Compose behavior primitives with your own markup and styles:

```tsx
import { css } from 'remix/ui'
import * as popover from 'remix/components/popover'

let triggerCss = css({
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '6px 10px',
})

let surfaceCss = css({
  background: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '8px',
})

function ViewOptions() {
  let open = false

  return () => (
    <popover.Context>
      <button
        mix={[triggerCss, popover.anchor({ placement: 'bottom-end' }), popover.focusOnHide()]}
        onClick={() => {
          open = true
        }}
        type="button"
      >
        View options
      </button>
      <div
        mix={[
          surfaceCss,
          popover.surface({
            open,
            onHide() {
              open = false
            },
          }),
        ]}
      >
        Panel content
      </div>
    </popover.Context>
  )
}
```

Button styling is available as a composable mixin:

```tsx
import button from 'remix/components/button'

function Actions() {
  return () => <button mix={button({ tone: 'primary' })}>Create project</button>
}
```

## Cascade Layers

Remix UI emits generated `css(...)` rules under the `rmx` cascade layer. Unlayered CSS outranks layered CSS, so use explicit layer order when mixing Remix UI with global styles.

Put layers that should lose to Remix UI before `rmx`:

```css
@layer base, rmx;

@layer base {
  button,
  input,
  textarea,
  select {
    font: inherit;
    margin: 0;
    padding: 0;
  }
}
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)

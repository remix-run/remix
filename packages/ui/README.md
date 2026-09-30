# ui

Headless, accessible UI primitives for Remix components. You provide the elements and visual design.
The primitives provide interaction behavior, accessibility attributes, and only the structural
styles required for correct operation.

## Installation

`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package.

```sh
npm i remix @remix-run/ui
```

## Usage

Compose behavior primitives with your own markup and styles:

```tsx
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import * as popover from '@remix-run/ui/popover'

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

function ViewOptions(handle: Handle) {
  let open = false

  return () => (
    <popover.Context>
      <button
        mix={[
          triggerCss,
          popover.anchor({ placement: 'bottom-end' }),
          popover.focusOnHide(),
          on('click', () => {
            open = true
            handle.update()
          }),
        ]}
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
              handle.update()
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

## Primitives

- `@remix-run/ui/accordion`
- `@remix-run/ui/anchor`
- `@remix-run/ui/combobox`
- `@remix-run/ui/listbox`
- `@remix-run/ui/menu`
- `@remix-run/ui/popover`
- `@remix-run/ui/select`
- `@remix-run/ui/tabs`
- `@remix-run/ui/toggle`

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE).

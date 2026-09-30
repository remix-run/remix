# ui

Headless, accessible UI primitives for Remix components.

## Installation

`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package.

```sh
npm i remix @remix-run/ui
```

## Usage

Compose behavioral primitives with your own markup and styles:

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

- [`@remix-run/ui/accordion`](https://github.com/remix-run/remix/blob/main/packages/ui/src/accordion/README.md)
- [`@remix-run/ui/anchor`](https://github.com/remix-run/remix/blob/main/packages/ui/src/anchor/README.md)
- [`@remix-run/ui/combobox`](https://github.com/remix-run/remix/blob/main/packages/ui/src/combobox/README.md)
- [`@remix-run/ui/listbox`](https://github.com/remix-run/remix/blob/main/packages/ui/src/listbox/README.md)
- [`@remix-run/ui/menu`](https://github.com/remix-run/remix/blob/main/packages/ui/src/menu/README.md)
- [`@remix-run/ui/popover`](https://github.com/remix-run/remix/blob/main/packages/ui/src/popover/README.md)
- [`@remix-run/ui/select`](https://github.com/remix-run/remix/blob/main/packages/ui/src/select/README.md)
- [`@remix-run/ui/tabs`](https://github.com/remix-run/remix/blob/main/packages/ui/src/tabs/README.md)
- [`@remix-run/ui/toggle`](https://github.com/remix-run/remix/blob/main/packages/ui/src/toggle/README.md)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE).

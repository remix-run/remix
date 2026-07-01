# menu

`menu` is a headless primitive for button-triggered menus, context menus, checked items, selection events, and nested submenus. Use it when you want Remix to own interaction behavior while your app owns markup and styles.

## Usage

```tsx
import type { Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu'

export function ViewMenu(handle: Handle) {
  let wordWrap = false

  return () => (
    <menu.Context label="View">
      <button type="button" mix={menu.trigger()}>
        View
      </button>
      <div mix={menu.popover()}>
        <div
          mix={[
            menu.list(),
            menu.onMenuSelect((event) => {
              if (event.item.name === 'wordWrap') {
                wordWrap = event.item.checked ?? false
                void handle.update()
              }
            }),
          ]}
        >
          <div
            mix={menu.item({
              checked: wordWrap,
              label: 'Word wrap',
              name: 'wordWrap',
              type: 'checkbox',
            })}
          >
            Word wrap
          </div>
          <div mix={menu.item({ disabled: true, label: 'Minimap', name: 'minimap' })}>Minimap</div>
        </div>
      </div>
    </menu.Context>
  )
}
```

Use `menu.contextTrigger()` with `menu.Context` when a menu should open at the right-click location of an element.

```tsx
import * as menu from 'remix/ui/menu'

function FileContextMenu() {
  return () => (
    <menu.Context label="File actions">
      <div mix={menu.contextTrigger()} tabIndex={0}>
        File.txt
      </div>
      <div mix={menu.popover()}>
        <div mix={menu.list()}>
          <div mix={menu.item({ label: 'Rename', name: 'rename' })}>Rename</div>
          <div mix={menu.item({ label: 'Delete', name: 'delete' })}>Delete</div>
        </div>
      </div>
    </menu.Context>
  )
}
```

Styled, fully formed menu components live in `remix/components/menu`:

```tsx
import { Menu, MenuItem, Submenu } from 'remix/components/menu'
```

## `menu.*`

- `menu.Context`: provider for root menus and nested submenus.
- `menu.trigger()`: mixin for a button-triggered root menu.
- `menu.contextTrigger()`: mixin for right-click and keyboard context menu triggers.
- `menu.popover()`: mixin for the floating menu surface.
- `menu.list()`: mixin for menu list roles, focus, keyboard navigation, typeahead, and selection.
- `menu.item(options)`: mixin for regular, checkbox, and radio items.
- `menu.submenuTrigger(options)`: mixin for nested submenu triggers.
- `onMenuSelect(...)`: event mixin for the bubbling `MenuSelectEvent`.
- `MenuSelectEvent`: bubbling event class whose `item` describes the selected item.
- `MenuSelectItem`: selected item shape with `checked`, `id`, `label`, `name`, `type`, and `value`.

## Behavior Notes

- Click opens the root menu and focuses the list; clicking the trigger again closes it and restores focus.
- `menu.contextTrigger()` opens the root menu from a `contextmenu` event and supports keyboard opening with the Context Menu key or Shift+F10.
- Keyboard navigation skips disabled items and does not wrap past the first or last enabled item.
- Printable keys use typeahead. Typeahead matches `searchValue` when provided and otherwise uses the item label.
- Submenus open with `ArrowRight`, close with `ArrowLeft`, and use hover aim so they stay open while moving toward the child surface.
- Selection dispatches one bubbled `MenuSelectEvent`, closes the full menu tree, and restores focus to the root trigger.

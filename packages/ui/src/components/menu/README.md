# Menu

`Menu` renders a button-triggered menu with keyboard navigation, checked items, selection events, and nested submenus. Use it for action menus and command groups.

## Usage

```tsx
import { Menu, MenuItem, Submenu, onMenuSelect } from 'remix/ui/menu'

export function ViewMenu() {
  return (
    <Menu
      label="View"
      mix={onMenuSelect((event) => {
        console.log(event.item.name, event.item.value)
      })}
    >
      <MenuItem checked={false} name="wordWrap" type="checkbox">
        Word wrap
      </MenuItem>
      <MenuItem disabled name="minimap">
        Minimap
      </MenuItem>
      <Submenu label="Zoom">
        <MenuItem name="zoomIn" value="zoom-in">
          Zoom in
        </MenuItem>
      </Submenu>
    </Menu>
  )
}
```

## `menu.*`

- `Menu`: composed trigger, popover, and list component for the common menu case.
- `MenuItem`: menu item wrapper. Supports regular, checkbox, and radio item roles through `type`, `checked`, `name`, `value`, `label`, `disabled`, and `searchValue`.
- `Submenu`: nested menu wrapper with its own trigger and child menu surface.
- `MenuList`: lower-level list wrapper for custom composition.
- `onMenuSelect(...)`: event mixin for the bubbling `MenuSelectEvent`.
- `menu.Context`, `menu.trigger()`, `menu.popover()`, `menu.list()`, `menu.item(...)`, and `menu.submenuTrigger(...)`: lower-level composition primitives.
- `buttonStyle`, `popoverStyle`, `listStyle`, `itemStyle`, `itemSlotStyle`, `itemLabelStyle`, `itemGlyphStyle`, and `triggerGlyphStyle`: flat style mixins used by the wrappers.

## Behavior Notes

- Click opens the root menu and focuses the list; clicking the trigger again closes it and restores focus.
- `ArrowDown` and `ArrowUp` open from the trigger and focus enabled items.
- Keyboard navigation skips disabled items and does not wrap past the first or last enabled item.
- Submenus open with `ArrowRight`, close with `ArrowLeft`, and are anchored relative to their menu item.
- Pointer movement uses hover aim so submenus stay open while moving toward their child surface.
- Selection dispatches one bubbled `MenuSelectEvent`, flashes the selected item briefly, and closes the full menu tree.

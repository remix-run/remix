# menu

`Menu` renders a button-triggered menu with keyboard navigation, checked items, selection events, and nested submenus. Use it for action menus and command groups.

## Usage

```tsx
import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { Menu, MenuItem, Submenu } from 'remix/components/menu'
import { onMenuSelect } from 'remix/ui/menu'

export function ViewMenu(handle: Handle) {
  let wordWrap = false
  let density = 'comfortable'

  return () => (
    <Menu
      label="View"
      mix={onMenuSelect((event) => {
        if (event.item.name === 'wordWrap') {
          wordWrap = event.item.checked ?? false
        } else if (event.item.name === 'density' && event.item.value) {
          density = event.item.value
        }

        void handle.update()
      })}
    >
      <MenuItem checked={wordWrap} name="wordWrap" type="checkbox">
        Word wrap
      </MenuItem>
      <MenuItem disabled name="minimap">
        Minimap
      </MenuItem>
      <hr mix={separatorStyle} />
      <MenuItem checked={density === 'compact'} name="density" type="radio" value="compact">
        Compact
      </MenuItem>
      <MenuItem checked={density === 'comfortable'} name="density" type="radio" value="comfortable">
        Comfortable
      </MenuItem>
      <Submenu label="Zoom">
        <MenuItem name="zoomIn" value="zoom-in">
          Zoom in
        </MenuItem>
        <MenuItem name="zoomOut" value="zoom-out">
          Zoom out
        </MenuItem>
      </Submenu>
    </Menu>
  )
}

let separatorStyle = css({
  border: 0,
  borderBlockStart: '1px solid #e5e7eb',
  marginBlock: '4px',
})
```

Use `label` or `searchValue` when the rendered item content is not the text that should be used for event labels or typeahead.

```tsx
<MenuItem label="Open command palette" name="commandPalette" searchValue="palette">
  Command palette
</MenuItem>
```

Use `menuLabel` when the menu surface needs a different accessible label from the visible trigger.

```tsx
<Menu label="..." menuLabel="Project actions">
  <MenuItem name="rename">Rename project</MenuItem>
</Menu>
```

Use `menu.contextTrigger()` with `menu.Context` and `MenuList` when a menu should open at the right-click location of an element.

```tsx
import { MenuItem, MenuList } from 'remix/components/menu'
import * as menu from 'remix/ui/menu'

export function FileContextMenu(handle: Handle) {
  return () => (
    <menu.Context label="File actions">
      <div mix={menu.contextTrigger()} tabIndex={0}>
        File.txt
      </div>
      <MenuList>
        <MenuItem name="rename">Rename</MenuItem>
        <MenuItem name="delete">Delete</MenuItem>
      </MenuList>
    </menu.Context>
  )
}
```

Attach `onMenuSelect(...)` from `remix/ui/menu` to `MenuList` or a shared ancestor when using lower-level context menu composition.

## `menu.*`

- `Menu`: composed trigger, popover, and list component for the common menu case.
- `MenuItem`: menu item component. Supports regular, checkbox, and radio item roles through `type`, `checked`, `name`, `value`, `label`, `disabled`, and `searchValue`.
- `Submenu`: nested menu component with its own trigger and child menu surface.
- `MenuList`: lower-level list component for custom composition.
- `onMenuSelect(...)`: event mixin from `remix/ui/menu` for the bubbling `MenuSelectEvent`.
- `MenuSelectEvent`: bubbling event class from `remix/ui/menu` whose `item` describes the selected item.
- `MenuSelectItem`: selected item shape from `remix/ui/menu` with `checked`, `id`, `label`, `name`, `type`, and `value`.
- `menu.Context`, `menu.trigger()`, `menu.contextTrigger()`, `menu.popover()`, `menu.list()`, `menu.item(...)`, and `menu.submenuTrigger(...)`: lower-level composition primitives from `remix/ui/menu`.
- `buttonStyle`, `popoverStyle`, `listStyle`, `itemStyle`, `itemSlotStyle`, `itemLabelStyle`, `itemIndicatorStyle`, and `triggerIndicatorStyle`: flat style mixins used by the component markup.
- `MenuProps`, `MenuItemProps`, `MenuListProps`, `MenuProviderProps`, `MenuTriggerOptions`, `MenuContextTriggerOptions`, `MenuItemOptions`, and `SubmenuProps`: public TypeScript props and option types.

## Behavior Notes

- Click opens the root menu and focuses the list; clicking the trigger again closes it and restores focus.
- `menu.contextTrigger()` opens the root menu from a `contextmenu` event at the pointer coordinates and supports keyboard opening with the Context Menu key or Shift+F10.
- `ArrowDown` opens from the trigger at the first enabled item. `ArrowUp` opens at the last enabled item. Enter and Space open the menu with focus on the list.
- Keyboard navigation skips disabled items and does not wrap past the first or last enabled item.
- `Home` and `End` move to the first and last enabled item. Enter and Space activate the highlighted item.
- Printable keys use typeahead. Typeahead matches `searchValue` when provided and otherwise uses the item label.
- Submenus open with `ArrowRight`, close with `ArrowLeft`, and are anchored to the submenu trigger with `right-start` placement.
- Pointer movement highlights enabled items. Submenus open after a short focus/pointer delay and use hover aim so they stay open while moving toward the child surface.
- Selecting a regular item flashes that item. Selecting a checkbox or radio item flashes the committed checked state.
- Selection dispatches one bubbled `MenuSelectEvent`, closes the full menu tree, and restores focus to the root trigger.
- The composed `Menu` re-dispatches selection from its trigger so handlers on the `Menu` button and shared ancestors see the event once.
- `menuLabel`, `Submenu.menuLabel`, and `Submenu.listProps` let composed menus label and customize menu surfaces separately from trigger content.

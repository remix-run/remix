# menu

`Menu` renders a button-triggered menu with keyboard navigation, checked items, selection events, and nested submenus. Use it for action menus and command groups.

## Component Usage

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

## Primitive Usage

Use only the lower-level primitives when app code owns the trigger, surface, and item markup:

```tsx
import * as menu from 'remix/ui/menu'
import { itemStyle, listStyle, popoverStyle, triggerStyle } from './menu.styles'

export function PrimitiveMenu() {
  return (
    <menu.Context label="Project actions">
      <button mix={[triggerStyle, menu.trigger()]} type="button">
        Actions
      </button>
      <div mix={[popoverStyle, menu.popover()]}>
        <div mix={[listStyle, menu.list()]}>
          <div mix={[itemStyle, menu.item({ name: 'rename' })]}>Rename</div>
          <div mix={[itemStyle, menu.item({ disabled: true, name: 'archive' })]}>Archive</div>
        </div>
      </div>
    </menu.Context>
  )
}
```

## `remix/components/menu`

- `Menu`: composed trigger, popover, and list component for the common menu case.
- `MenuItem`: menu item component. Supports regular, checkbox, and radio item roles through `type`, `checked`, `name`, `value`, `label`, `disabled`, and `searchValue`.
- `Submenu`: nested menu component with its own trigger and child menu surface.
- `MenuList`: lower-level styled list component for custom composition inside `menu.Context`.
- `buttonStyle`, `popoverStyle`, `listStyle`, `itemStyle`, `itemSlotStyle`, `itemLabelStyle`, `itemIndicatorStyle`, and `triggerIndicatorStyle`: flat style mixins used by the component markup.
- `MenuProps`, `MenuItemProps`, `MenuListProps`, and `SubmenuProps`: public TypeScript props for the composed APIs.

## `remix/ui/menu`

- `Context`: lower-level provider for custom menu composition.
- `trigger()`: wires a button-style trigger to open the root menu.
- `contextTrigger()`: opens the root menu from a `contextmenu` event at pointer coordinates, or from keyboard context-menu shortcuts.
- `popover()`: wires the menu popover surface.
- `list()`: wires the menu list root, focus handling, keyboard navigation, and typeahead.
- `item(...)`: registers one menu item. Supports regular, checkbox, and radio roles through `type`, `checked`, `name`, `value`, `label`, `disabled`, and `searchValue`.
- `submenuTrigger(...)`: registers a menu item that opens a child menu.
- `onMenuSelect(...)`: event mixin for the bubbling `MenuSelectEvent`.
- `MenuSelectEvent`: bubbling event whose `item` describes the selected item.
- `MenuSelectItem`, `MenuProviderProps`, `MenuTriggerOptions`, `MenuContextTriggerOptions`, `MenuItemOptions`, and `SubmenuTriggerOptions`: public TypeScript event, prop, and option types for the primitives.

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

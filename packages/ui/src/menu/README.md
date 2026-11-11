# menu

`menu` provides headless behavior for button-triggered and context menus with keyboard navigation, checked items, selection events, and nested submenus. App code owns the trigger, surface, item markup, and visual styles.

## Usage

```tsx
import * as menu from '@remix-run/ui/menu'
import { itemStyle, listStyle, popoverStyle, triggerStyle } from './menu.styles'

export function ProjectMenu() {
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

Items can use checkbox and radio roles. Use `label` or `searchValue` when the rendered content is not the text that should be used for event labels or typeahead.

```tsx
<div
  mix={[
    itemStyle,
    menu.item({
      checked: true,
      label: 'Word wrap',
      name: 'wordWrap',
      searchValue: 'wrap',
      type: 'checkbox',
    }),
  ]}
>
  Word wrap
</div>
```

Use `contextTrigger()` when a menu should open at the right-click location of an element:

```tsx
<menu.Context label="File actions">
  <div mix={menu.contextTrigger()} tabIndex={0}>
    File.txt
  </div>
  <div mix={[popoverStyle, menu.popover()]}>
    <div mix={[listStyle, menu.list()]}>
      <div mix={[itemStyle, menu.item({ name: 'rename' })]}>Rename</div>
      <div mix={[itemStyle, menu.item({ name: 'delete' })]}>Delete</div>
    </div>
  </div>
</menu.Context>
```

Attach `onMenuSelect(...)` to the menu root or a shared ancestor:

```tsx
<div
  mix={menu.onMenuSelect((event) => {
    console.log(event.item.name, event.item.value, event.item.checked)
  })}
>
  {/* menu */}
</div>
```

## `@remix-run/ui/menu`

- `Context`: provider for custom menu composition.
- `trigger()`: wires a button-style trigger to open the root menu.
- `contextTrigger()`: opens the root menu from a `contextmenu` event at pointer coordinates, or from keyboard context-menu shortcuts.
- `popover()`: wires the menu popover surface.
- `list()`: wires the menu list root, focus handling, keyboard navigation, and typeahead.
- `item(...)`: registers one menu item. Supports regular, checkbox, and radio roles through `type`, `checked`, `name`, `value`, `label`, `disabled`, and `searchValue`.
- `submenuTrigger(...)`: registers a menu item that opens a child menu.
- `onMenuSelect(...)`: event mixin for the bubbling `MenuSelectEvent`.
- `MenuSelectEvent`: bubbling event whose `item` describes the selected item.
- `MenuSelectItem`, `MenuProviderProps`, `MenuTriggerOptions`, `MenuContextTriggerOptions`, `MenuItemOptions`, and `SubmenuTriggerOptions`: public event, prop, and option types.

## Behavior Notes

- A primary mouse button press on the trigger opens the root menu on `pointerdown`, like native menus, and focuses the list. Pressing the trigger again closes it and restores focus. Touch, pen, Enter, and Space open on `click`. The menu opens directly, without a click, and the click that trails the press is ignored.
- Items, checkbox and radio items, and submenu triggers activate on `click`, on release, and on press when they also use [`press()`](https://github.com/remix-run/remix/blob/main/packages/ui/src/press/README.md).
- A press that opened the menu and is released over an item after moving at least 10px activates that item, so press, drag, and release chooses in one gesture. Releasing within 10px of the press, or over the trigger, leaves the menu open. In an open menu, a mouse press that starts on one item and is released over another activates the item under the release, and a release outside the menu activates nothing.
- `contextTrigger()` opens the root menu from a `contextmenu` event at the pointer coordinates and supports keyboard opening with the Context Menu key or Shift+F10.
- `ArrowDown` opens from the trigger at the first enabled item. `ArrowUp` opens at the last enabled item. Enter and Space open the menu with focus on the list.
- Keyboard navigation skips disabled items and does not wrap past the first or last enabled item.
- `Home` and `End` move to the first and last enabled item. Enter and Space activate the highlighted item.
- Printable keys use typeahead. Typeahead matches `searchValue` when provided and otherwise uses the item label.
- Submenus open with `ArrowRight`, close with `ArrowLeft`, and are anchored to the submenu trigger with `right-start` placement.
- Items structurally set `cursor: default` and `user-select: none` (with `-webkit-user-select`), including disabled items, in the `rmx` layer so app styles can override them.
- Pointer movement highlights enabled items. Highlighting also follows a held mouse button, so press, drag, and release over an item works. Submenus open after a short focus or pointer delay and use hover aim so they stay open while moving toward the child surface.
- Selecting a regular item flashes that item. Selecting a checkbox or radio item flashes the committed checked state.
- Selection dispatches one bubbled `MenuSelectEvent`, closes the full menu tree, and restores focus to the root trigger.

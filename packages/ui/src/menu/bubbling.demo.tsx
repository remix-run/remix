import { Menu, MenuItem } from '@remix-run/ui/menu'
import { onMenuSelect } from '@remix-run/ui/menu/primitives'

/**
 * @name Menu Event Bubbling
 * @description Item-level handlers fire before the root handler, letting individual items intercept events while others bubble up.
 * @layout center
 */
export default function Example() {
  return () => (
    <Menu
      label="Project"
      menuLabel="Project actions"
      mix={onMenuSelect((event) => {
        console.log('Menu root handler:', event.item)
      })}
    >
      <MenuItem name="open" value="open-project">
        Open project
      </MenuItem>
      <MenuItem
        name="rename"
        value="rename-project"
        mix={onMenuSelect((event) => {
          console.log('Menu item handler:', event.item)
        })}
      >
        Rename project
      </MenuItem>
      <MenuItem name="duplicate" value="duplicate-project">
        Duplicate project
      </MenuItem>
    </Menu>
  )
}

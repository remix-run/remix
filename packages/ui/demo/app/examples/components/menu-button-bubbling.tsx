import { on } from 'remix/component'
import { Menu, MenuItem, onMenuSelect } from '@remix-run/ui/menu'
export default function example() {
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

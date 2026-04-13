import { on } from 'remix/component'
import { Menu, MenuButton, MenuItem, MenuList } from 'remix/ui'

export default function example() {
  return () => (
    <Menu
      label="Project actions"
      mix={on(Menu.select, (event) => {
        console.log('Menu root handler:', event.item)
      })}
    >
      <MenuButton>Project</MenuButton>
      <MenuList>
        <MenuItem name="open" value="open-project">
          Open project
        </MenuItem>
        <MenuItem
          name="rename"
          value="rename-project"
          mix={on(Menu.select, (event) => {
            console.log('Menu item handler:', event.item)
          })}
        >
          Rename project
        </MenuItem>
        <MenuItem name="duplicate" value="duplicate-project">
          Duplicate project
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

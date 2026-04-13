import { on, type Handle } from 'remix/component'
import { MenuList, MenuItem, Menu, MenuButton, SubmenuTrigger } from 'remix/ui'

export default function Example(handle: Handle) {
  return () => (
    <Menu
      label="File actions"
      mix={on(Menu.select, (event) => {
        console.log('select', event.item)
      })}
    >
      <MenuButton>File</MenuButton>
      <MenuList>
        <Menu label="Color actions">
          <SubmenuTrigger name="colors">Colors</SubmenuTrigger>
          <MenuList>
            <MenuItem name="red" value="red">
              Red
            </MenuItem>
            <MenuItem name="green" value="green">
              Green
            </MenuItem>
            <Menu label="More color actions">
              <SubmenuTrigger name="more-colors">More colors</SubmenuTrigger>
              <MenuList>
                <MenuItem name="blue" value="blue">
                  Blue
                </MenuItem>
                <MenuItem name="purple" value="purple">
                  Purple
                </MenuItem>
              </MenuList>
            </Menu>
          </MenuList>
        </Menu>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="delete" value="delete-file">
          Delete
        </MenuItem>
        <MenuItem name="archive" value="archive-file">
          Archive
        </MenuItem>
        <Menu label="Color actions 2">
          <SubmenuTrigger name="colors2">Colors 2</SubmenuTrigger>
          <MenuList>
            <MenuItem name="red2" value="red2">
              Red
            </MenuItem>
            <MenuItem name="green2" value="green2">
              Green
            </MenuItem>
          </MenuList>
        </Menu>
      </MenuList>
    </Menu>
  )
}

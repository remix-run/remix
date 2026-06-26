import { Menu, MenuItem } from "remix/components/menu";
import { onMenuSelect } from "remix/ui/menu";

export function MenuBubbling() {
  return () => (
    <Menu
      label="Project"
      menuLabel="Project actions"
      mix={onMenuSelect((event) => {
        console.log("Menu root handler:", event.item);
      })}
    >
      <MenuItem name="open" value="open-project">
        Open project
      </MenuItem>
      <MenuItem
        name="rename"
        value="rename-project"
        mix={onMenuSelect((event) => {
          console.log("Menu item handler:", event.item);
        })}
      >
        Rename project
      </MenuItem>
      <MenuItem name="duplicate" value="duplicate-project">
        Duplicate project
      </MenuItem>
    </Menu>
  );
}

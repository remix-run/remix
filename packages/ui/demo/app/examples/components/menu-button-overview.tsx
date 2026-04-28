import { type Handle } from 'remix/ui'
import { Menu, MenuItem, onMenuSelect, Submenu } from '@remix-run/ui/menu'
import { separatorStyle } from '@remix-run/ui/separator'

type Density = 'comfortable' | 'compact'

export default function Example(handle: Handle) {
  let wordWrap = true
  let minimap = false
  let showGutter = true
  let density: Density = 'comfortable'

  return () => (
    <Menu
      label="View"
      menuLabel="View options"
      mix={onMenuSelect((event) => {
        switch (event.item.name) {
          case 'wordWrap':
            wordWrap = !wordWrap
            break
          case 'minimap':
            minimap = !minimap
            break
          case 'showGutter':
            showGutter = !showGutter
            break
          case 'density':
            density = event.item.value as Density
            break
        }
        handle.update()
      })}
    >
      <MenuItem name="wordWrap" type="checkbox" checked={wordWrap}>
        Word wrap
      </MenuItem>
      <MenuItem name="minimap" type="checkbox" checked={minimap}>
        Minimap
      </MenuItem>
      <MenuItem name="showGutter" type="checkbox" checked={showGutter}>
        Show gutter
      </MenuItem>

      <hr mix={separatorStyle} />
      <Submenu label="Zoom">
        <MenuItem name="zoomIn" value="zoom-in">
          Zoom In
        </MenuItem>
        <MenuItem name="zoomOut" value="zoom-out">
          Zoom Out
        </MenuItem>
        <MenuItem name="resetZoom" value="reset-zoom">
          Reset Zoom
        </MenuItem>
      </Submenu>

      <Submenu label="Density">
        <MenuItem
          name="density"
          type="radio"
          value="comfortable"
          checked={density === 'comfortable'}
        >
          Comfortable
        </MenuItem>
        <MenuItem name="density" type="radio" value="compact" checked={density === 'compact'}>
          Compact
        </MenuItem>
      </Submenu>
    </Menu>
  )
}

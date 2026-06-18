import { type Handle } from '@remix-run/ui'
import { css } from '@remix-run/ui'
import { Menu, MenuItem, Submenu } from '@remix-run/ui/components/menu'
import { onMenuSelect } from '@remix-run/ui/menu'

/**
 * @name Menu Overview
 * @description A hierarchical menu with checkboxes, radio groups, submenus, and separators.
 * @layout center
 */
export default function Example(handle: Handle) {
  type Density = 'comfortable' | 'compact'
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

      <hr mix={separatorCss} />
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

const separatorCss = css({
  marginBlock: '4px',
  marginInline: '8px',
  border: 0,
  borderTop: '1px solid #e7e7e7',
})

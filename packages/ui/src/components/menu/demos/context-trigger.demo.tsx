import { css, type Handle } from '@remix-run/ui'
import * as menu from '@remix-run/ui/menu'
import { MenuItem, MenuList, onMenuSelect, Submenu } from '@remix-run/ui/menu'
import { separatorStyle } from '@remix-run/ui/separator'
import { theme } from '@remix-run/ui/theme'

type FileAction = 'copyPath' | 'duplicate' | 'move' | 'rename' | 'reveal' | 'trash'

const actionLabelByName: Record<FileAction, string> = {
  copyPath: 'Copied path',
  duplicate: 'Duplicated file',
  move: 'Moved file',
  rename: 'Renamed file',
  reveal: 'Revealed in Finder',
  trash: 'Moved to trash',
}

/**
 * @name Context Menu Trigger
 * @description A lower-level menu composition that opens from right-click coordinates while keeping standard menu selection and submenu behavior.
 */
export default function Example(handle: Handle) {
  let latestAction = 'Right-click the card.'

  return () => (
    <menu.Context label="File actions">
      <div mix={layoutCss}>
        <div tabIndex={0} mix={[fileCardCss, menu.contextTrigger()]}>
          <span mix={fileIconCss}>TS</span>
          <span mix={fileTextCss}>
            <strong mix={fileNameCss}>context-menu.tsx</strong>
            <span mix={fileMetaCss}>Right-click or press Shift+F10</span>
          </span>
        </div>

        <p aria-live="polite" mix={statusCss}>
          {latestAction}
        </p>
      </div>

      <MenuList
        mix={onMenuSelect((event) => {
          latestAction =
            actionLabelByName[event.item.name as FileAction] ?? `Selected ${event.item.label}`
          void handle.update()
        })}
      >
        <MenuItem name="rename">Rename</MenuItem>
        <MenuItem name="duplicate">Duplicate</MenuItem>
        <MenuItem name="copyPath">Copy path</MenuItem>
        <hr mix={separatorStyle} />
        <Submenu label="Move to">
          <MenuItem name="move" value="drafts">
            Drafts
          </MenuItem>
          <MenuItem name="move" value="archive">
            Archive
          </MenuItem>
        </Submenu>
        <MenuItem name="reveal">Reveal in Finder</MenuItem>
        <hr mix={separatorStyle} />
        <MenuItem name="trash">Move to trash</MenuItem>
      </MenuList>
    </menu.Context>
  )
}

const layoutCss = css({
  display: 'grid',
  justifyItems: 'start',
  gap: theme.space.md,
})

const fileCardCss = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: theme.space.md,
  width: 'min(100%, 21rem)',
  padding: theme.space.md,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl1,
  color: theme.colors.text.primary,
  boxShadow: theme.shadow.xs,
  cursor: 'context-menu',
  userSelect: 'none',
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

const fileIconCss = css({
  display: 'inline-grid',
  placeItems: 'center',
  width: theme.control.height.lg,
  height: theme.control.height.lg,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.bold,
})

const fileTextCss = css({
  display: 'grid',
  gap: theme.space.px,
  minWidth: 0,
})

const fileNameCss = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

const fileMetaCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
})

const statusCss = css({
  margin: 0,
  minHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

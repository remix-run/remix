// @ts-nocheck
import type { Handle } from 'remix/ui'
import { ui, theme, css } from 'remix/ui'
import { Menu, MenuItem, onMenuSelect } from '@remix-run/ui/menu'

type State = 'idle' | 'deleting' | 'copying' | 'error'

function Row(handle: Handle) {
  let state: State = 'idle'
  let showCopyConfirmation = false

  return (file: SomeFile) => (
    <div
      mix={[
        link(file.href),
        ui.flex.row,
        ui.rounded.md,
        css({
          background: theme.surface.lvl1,
          '&:hover': {
            background: theme.surface.lvl2,
          },
        }),
      ]}
    >
      <div mix={css({ fontWeight: theme.fontWeight.semibold })}>{file.name}</div>
      <div>{formattedSize(file.size)}</div>

      <Menu
        label="Actions"
        mix={onMenuSelect(async (event) => {
          switch (event.item.name) {
            case 'copy-url':
              let url = await navigator.clipboard.writeText(file.href)
              if (handle.signal.aborted) return

              showCopyConfirmation = true
              await handle.update()

              setTimeout(() => {
                if (handle.signal.aborted) return
                handle.update()
              }, 4000)

              break
            case 'delete':
              state = 'deleting'
              break
            default:
              break
          }
        })}
      >
        <MenuItem name="copy-url" value="Copy URL">
          Copy URL
        </MenuItem>
        <MenuItem name="delete" value="Delete">
          Delete
        </MenuItem>
      </Menu>
    </div>
  )
}

import { type Handle, on } from 'remix/component'
import { ui, Glyph } from 'remix/ui'
import { tooltip } from 'remix/ui/tooltip'

function CopyToClipboard(handle: Handle) {
  let state: 'idle' | 'copied' | 'error' = 'idle'

  return (props: { url: string }) => {
    let label = state === 'idle' ? 'Copy' : state === 'copied' ? 'Copied' : 'Error'

    return (
      <button
        aria-label={label}
        aria-live="polite"
        mix={[
          // style the button from your theme
          ui.button,

          // add a tooltip
          tooltip(label),

          // add the event handler to do the work
          on('click', async (event) => {
            try {
              await navigator.clipboard.writeText(props.url)
              if (handle.signal.aborted) return
            } catch (error) {
              state = 'error'
              handle.update()
              return
            }

            state = 'copied'
            handle.update()
            setTimeout(() => {
              // avoid work if component is gone
              if (handle.signal.aborted) return
              state = 'idle'
              handle.update()
            }, 2000)
          }),
        ]}
      >
        {state === 'copied' ? <Glyph name="check" /> : <Glyph name="clipboard" />}
      </button>
    )
  }
}

function Thing() {}

import { css, on, type Handle } from 'remix/component'
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import * as popover from '@remix-run/ui/popover'
import { Option, Select } from '@remix-run/ui/select'
import { theme } from '@remix-run/ui/theme'

export default function Example(handle: Handle) {
  let open = false

  function closePopover() {
    open = false
    void handle.update()
  }

  return () => (
    <popover.Context>
      <div mix={buttonRowCss}>
        <Button
          endIcon={<Glyph name="chevronDown" />}
          mix={[
            popover.anchor({ placement: 'bottom' }),
            popover.focusOnHide(),
            on('click', () => {
              open = !open
              void handle.update()
            }),
          ]}
          tone="secondary"
        >
          View options
        </Button>
      </div>

      <div
        mix={[
          popover.surfaceStyle,
          popover.surface({
            closeOnAnchorClick: false,
            open,
            onHide() {
              closePopover()
            },
          }),
        ]}
      >
        <div mix={[popover.contentStyle, panelCss]}>
          <div mix={fieldCss}>
            <label for={`${handle.id}-grouping`} mix={labelCss}>
              Grouping
            </label>
            <Select
              id={`${handle.id}-grouping`}
              defaultLabel="No grouping"
              defaultValue="none"
              mix={[fieldSelectCss, popover.focusOnShow()]}
            >
              <Option label="No grouping" value="none" />
              <Option label="Status" value="status" />
              <Option label="Priority" value="priority" />
            </Select>
          </div>

          <div mix={fieldCss}>
            <label for={`${handle.id}-ordering`} mix={labelCss}>
              Ordering
            </label>
            <Select
              id={`${handle.id}-ordering`}
              defaultLabel="Manual"
              defaultValue="manual"
              mix={fieldSelectCss}
            >
              <Option label="Manual" value="manual" />
              <Option label="Newest first" value="newest" />
              <Option label="Oldest first" value="oldest" />
            </Select>
          </div>

          <div mix={fieldCss}>
            <label for={`${handle.id}-closed-projects`} mix={labelCss}>
              Show closed projects
            </label>
            <Select
              id={`${handle.id}-closed-projects`}
              defaultLabel="All"
              defaultValue="all"
              mix={fieldSelectCss}
            >
              <Option label="All" value="all" />
              <Option label="Open only" value="open" />
              <Option label="Closed only" value="closed" />
            </Select>
          </div>

          <div mix={actionsCss}>
            <Button mix={on('click', closePopover)} tone="ghost">
              Done
            </Button>
          </div>
        </div>
      </div>
    </popover.Context>
  )
}

let buttonRowCss = css({
  display: 'flex',
  justifyContent: 'flex-start',
})

let panelCss = css({
  display: 'grid',
  gap: theme.space.md,
  width: '22rem',
  padding: theme.space.lg,
})

let fieldCss = css({
  display: 'grid',
  gap: theme.space.px,
})

let labelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let fieldSelectCss = css({
  width: '100%',
})

let actionsCss = css({
  display: 'flex',
  justifyContent: 'flex-end',
  paddingTop: theme.space.xs,
})

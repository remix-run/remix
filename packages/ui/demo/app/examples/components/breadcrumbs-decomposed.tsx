import { css } from 'remix/component'
import { Glyph, theme, ui } from 'remix/ui'

let listCss = css({
  gap: `${theme.space.xs} ${theme.space.sm}`,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

let itemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
})

let separatorCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

let linkCss = css({
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
  },
})

let currentCss = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.medium,
})

export default function example() {
  return () => (
    <nav aria-label="Breadcrumb">
      <ol mix={[ui.row, ui.row.wrap, ui.row.center, listCss]}>
        <li mix={itemCss}>
          <a href="/" mix={[ui.text.body, linkCss]}>
            Home
          </a>
        </li>
        <li aria-hidden="true" mix={separatorCss}>
          <Glyph name="chevronRight" />
        </li>
        <li mix={itemCss}>
          <a href="/components" mix={[ui.text.body, linkCss]}>
            Components
          </a>
        </li>
        <li aria-hidden="true" mix={separatorCss}>
          <Glyph name="chevronRight" />
        </li>
        <li mix={itemCss}>
          <span aria-current="page" mix={[ui.text.body, currentCss]}>
            Breadcrumbs
          </span>
        </li>
      </ol>
    </nav>
  )
}

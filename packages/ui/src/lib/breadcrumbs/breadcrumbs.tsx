// @jsxRuntime classic
// @jsx createElement
import { css, createElement } from '@remix-run/component'
import type { Props, RemixNode } from '@remix-run/component'

import { Glyph } from '../glyph/glyph.tsx'
import { theme } from '../theme/theme.ts'

export type BreadcrumbItem = {
  current?: boolean
  href?: string
  label: RemixNode
}

export type BreadcrumbsProps = Omit<Props<'nav'>, 'children'> & {
  items: BreadcrumbItem[]
  separator?: RemixNode
}

let rootCss = css({
  minWidth: 0,
})

let listCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: `${theme.space.xs} ${theme.space.sm}`,
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

let itemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
})

let separatorCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

let linkCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    color: theme.colors.text.primary,
  },
})

let currentCss = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'nowrap',
})

let textCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  whiteSpace: 'nowrap',
})

export function Breadcrumbs() {
  return ({ 'aria-label': ariaLabel, items, separator, mix, ...navProps }: BreadcrumbsProps) => {
    let currentIndex = items.findIndex((item) => item.current)
    if (currentIndex === -1) {
      currentIndex = Math.max(0, items.length - 1)
    }

    let separatorContent = separator ?? <Glyph name="chevronRight" />

    return (
      <nav aria-label={ariaLabel ?? 'Breadcrumb'} {...navProps} mix={[rootCss, ...(mix ?? [])]}>
        <ol mix={listCss}>
          {items.flatMap((item, index) => {
            let isCurrent = index === currentIndex
            let content = isCurrent ? (
              <span aria-current="page" mix={currentCss}>
                {item.label}
              </span>
            ) : item.href ? (
              <a href={item.href} mix={linkCss}>
                {item.label}
              </a>
            ) : (
              <span mix={textCss}>{item.label}</span>
            )

            let nodes: RemixNode[] = [
              <li key={`item-${index}`} mix={itemCss}>
                {content}
              </li>,
            ]

            if (index < items.length - 1) {
              nodes.push(
                <li key={`separator-${index}`} aria-hidden="true" mix={separatorCss}>
                  {separatorContent}
                </li>,
              )
            }

            return nodes
          })}
        </ol>
      </nav>
    )
  }
}

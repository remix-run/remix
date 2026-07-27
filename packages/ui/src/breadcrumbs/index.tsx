import { css, createElement } from '@remix-run/ui'
import type { Handle, Props, RemixNode } from '@remix-run/ui'

import { ChevronRightIcon } from '../shared/icons.tsx'
import { componentStyleValues as styles } from '../shared/style-values.ts'

export type BreadcrumbItem = {
  current?: boolean
  href?: string
  label: RemixNode
}

export type BreadcrumbsProps = Omit<Props<'nav'>, 'children'> & {
  items: BreadcrumbItem[]
  separator?: RemixNode
}

const rootCss = css({
  minWidth: 0,
})

const listCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: `${styles.space.xs} ${styles.space.sm}`,
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const itemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
})

const separatorCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: styles.fontSize.sm,
  height: styles.fontSize.sm,
  color: styles.colors.text.muted,
})

const linkCss = css({
  color: styles.colors.text.secondary,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.normal,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    color: styles.colors.text.primary,
  },
})

const currentCss = css({
  color: styles.colors.text.primary,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.normal,
  fontWeight: styles.fontWeight.medium,
  whiteSpace: 'nowrap',
})

const textCss = css({
  color: styles.colors.text.secondary,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.normal,
  whiteSpace: 'nowrap',
})

export function Breadcrumbs(handle: Handle<BreadcrumbsProps>): () => RemixNode {
  return () => {
    let { 'aria-label': ariaLabel, items, separator, mix, ...navProps } = handle.props
    let currentIndex = items.findIndex((item) => item.current)
    if (currentIndex === -1) {
      currentIndex = Math.max(0, items.length - 1)
    }

    let separatorContent = separator ?? <ChevronRightIcon />

    return (
      <nav aria-label={ariaLabel ?? 'Breadcrumb'} {...navProps} mix={[rootCss, mix]}>
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

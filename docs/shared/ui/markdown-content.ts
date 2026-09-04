import { css } from 'remix/ui'

export const docsMarkdownContentCss = css({
  color: 'var(--rmx-color-text-primary)',
  fontSize: 'var(--rmx-font-size-md)',
  '& p': {
    margin: '0 0 var(--rmx-space-lg)',
  },
  '& :is(h1, h2, h3, h4, h5, h6)': {
    position: 'relative',
    scrollMarginTop: 'calc(var(--site-header-height) + var(--rmx-space-xl))',
  },
  '& :is(h1, h2, h3, h4, h5, h6)::before': {
    position: 'absolute',
    insetInlineStart: 'calc((1ch + var(--rmx-space-sm)) * -1)',
    color: 'var(--rmx-color-text-muted)',
    content: "'#'",
    fontWeight: 'var(--rmx-font-weight-normal)',
    opacity: 0,
  },
  '& :is(h1, h2, h3, h4, h5, h6):is(:hover, :focus-within)::before': {
    opacity: 1,
  },
  '& :is(h1, h2, h3, h4, h5, h6) > :is(a, .docs-heading-link), & :is(h1, h2, h3, h4, h5, h6) > :is(a, .docs-heading-link):is(:hover, :visited, :focus-visible)':
    {
      color: 'inherit',
      textDecoration: 'none',
    },
  '& h2': {
    margin: '40px 0 var(--rmx-space-lg)',
    fontSize: 'var(--rmx-font-size-xl)',
    fontWeight: 'var(--rmx-font-weight-bold)',
    letterSpacing: 'var(--rmx-letter-spacing-tight)',
    lineHeight: 'var(--rmx-line-height-tight)',
  },
  '& h2:first-child': {
    marginTop: 0,
  },
  '& :is(h3, h4, h5, h6)': {
    margin: 'var(--rmx-space-xl) 0 var(--rmx-space-md)',
    lineHeight: 'var(--rmx-line-height-tight)',
  },
  '& h5': {
    fontSize: 'var(--rmx-font-size-sm)',
  },
  '& h6': {
    color: 'var(--rmx-color-text-secondary)',
    fontSize: 'var(--rmx-font-size-sm)',
    letterSpacing: 'var(--rmx-letter-spacing-meta)',
    textTransform: 'uppercase',
  },
  '& :is(ul, ol)': {
    margin: '0 0 var(--rmx-space-lg)',
    paddingLeft: 'var(--rmx-space-xl)',
  },
  '& li > :is(ul, ol)': {
    margin: 'var(--rmx-space-sm) 0 0',
  },
  '& li + li': {
    marginTop: 'var(--rmx-space-sm)',
  },
  "& input[type='checkbox']": {
    marginRight: 'var(--rmx-space-sm)',
    accentColor: 'var(--rmx-color-accent)',
  },
  '& blockquote': {
    margin: 'var(--rmx-space-xl) 0',
    paddingLeft: 'var(--rmx-space-lg)',
    borderLeft: 'var(--rmx-space-xs) solid var(--rmx-color-border-subtle)',
    color: 'var(--rmx-color-text-secondary)',
  },
  '& hr': {
    margin: 'var(--rmx-space-xl) 0',
    border: 0,
    borderTop: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
  },
  '& table': {
    width: '100%',
    margin: 'var(--rmx-space-xl) 0',
    borderCollapse: 'collapse',
    fontSize: 'var(--rmx-font-size-sm)',
  },
  '& :is(th, td)': {
    padding: 'var(--rmx-space-sm) var(--rmx-space-md)',
    border: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '& th': {
    background: 'var(--rmx-surface-lvl2)',
    fontWeight: 'var(--rmx-font-weight-bold)',
  },
  '& img': {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    margin: 'var(--rmx-space-xl) 0',
    borderRadius: 'var(--rmx-radius-lg)',
  },
})

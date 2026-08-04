import { css } from 'remix/ui'

import { Icon } from './icon.tsx'

export function DocsFooter() {
  return () => (
    <footer aria-label="Site footer" mix={docsFooterCss}>
      <div mix={footerLinksCss}>
        <a href="https://remix.run" aria-label="Remix" mix={footerBrandCss}>
          <img src="/remix-wordmark-light-mode.svg" alt="" mix={footerBrandImageCss} />
        </a>
        <nav aria-label="Find us on the web" mix={footerSocialCss}>
          <a href="https://github.com/remix-run" aria-label="GitHub">
            <Icon name="github" />
          </a>
          <a href="https://x.com/remix_run" aria-label="X">
            <Icon name="x" />
          </a>
          <a href="https://youtube.com/remix_run" aria-label="YouTube">
            <Icon name="youtube" />
          </a>
          <a href="https://remix.run/discord" aria-label="Discord">
            <Icon name="discord" />
          </a>
        </nav>
      </div>
      <div mix={footerLegalCss}>
        <p>docs and examples licensed under mit</p>
        <p>&copy;{new Date().getFullYear()} Shopify, Inc.</p>
      </div>
    </footer>
  )
}

const docsFooterCss = css({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: 'calc(100% - var(--docs-sidebar-offset))',
  gap: '48px',
  marginLeft: 'var(--docs-sidebar-offset)',
  padding: '48px 52px',
  color: 'var(--docs-footer-foreground)',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left',
  transition:
    'width var(--docs-nav-duration) var(--docs-nav-easing), margin-left var(--docs-nav-duration) var(--docs-nav-easing), padding-left var(--docs-nav-duration) var(--docs-nav-easing)',
  '& a': {
    color: 'inherit',
    textDecoration: 'none',
  },
  '& a:hover': {
    color: 'var(--rmx-color-text-primary)',
  },
  ':root[data-docs-nav-collapsed] &': {
    width: 'calc(100% - var(--docs-collapsed-offset))',
    marginLeft: 'var(--docs-collapsed-offset)',
    paddingLeft: 'var(--docs-collapsed-content-padding)',
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      gap: '16px',
      marginLeft: 0,
      padding: '48px 24px',
      textAlign: 'center',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const footerLinksCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '24px',
  color: 'var(--docs-footer-link-foreground)',
  flexWrap: 'wrap',
  '@media (width < 900px)': {
    justifyContent: 'center',
  },
})

const footerBrandCss = css({
  display: 'flex',
})

const footerBrandImageCss = css({
  display: 'block',
  width: 0,
  height: '12px',
  paddingLeft: '122px',
  background: 'currentColor',
  mask: "url('/remix-wordmark-light-mode.svg') left center / contain no-repeat",
})

const footerSocialCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '24px',
  '& a': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
  },
  '& svg': {
    display: 'block',
    width: '20px',
    height: '20px',
  },
})

const footerLegalCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
  textAlign: 'right',
  '& p': {
    margin: 0,
    fontFamily: 'var(--rmx-font-family-mono)',
    fontSize: '10px',
    lineHeight: '16px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  '@media (width < 900px)': {
    width: '100%',
    alignItems: 'center',
    textAlign: 'center',
  },
})

import { css } from 'remix/component'

import { Icon } from './icon.tsx'
import { media } from './media.ts'

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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: '16px',
  padding: '48px 24px',
  color: 'var(--docs-footer-foreground)',
  fontSize: 'var(--rmx-font-size-md)',
  lineHeight: '24px',
  textAlign: 'center',
  '& a': {
    color: 'inherit',
    textDecoration: 'none',
  },
  '& a:hover': {
    color: 'var(--rmx-color-text-primary)',
  },
  [media.md]: {
    flexDirection: 'row',
    width: 'calc(100% - var(--docs-content-offset))',
    gap: '48px',
    marginLeft: 'var(--docs-content-offset)',
    padding: '48px var(--docs-main-padding)',
    paddingLeft: 'var(--docs-content-padding-start)',
    textAlign: 'left',
  },
})

const footerLinksCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '24px',
  color: 'var(--docs-footer-link-foreground)',
  flexWrap: 'wrap',
  [media.md]: {
    justifyContent: 'flex-start',
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
  alignItems: 'center',
  width: '100%',
  gap: '2px',
  textAlign: 'center',
  '& p': {
    margin: 0,
    fontFamily: 'var(--rmx-font-family-mono)',
    fontSize: 'var(--rmx-font-size-xxxs)',
    lineHeight: '16px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  [media.md]: {
    alignItems: 'flex-end',
    width: 'auto',
    textAlign: 'right',
  },
})

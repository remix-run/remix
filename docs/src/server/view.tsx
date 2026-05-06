import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { Glyph } from '@remix-run/ui/glyph'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'
import type { DocsRegistry, PageDefinition } from './registry.ts'
import { isPageActive } from './registry.ts'
import { bodyTextCss, eyebrowTextCss } from './page-primitives.tsx'
import { routes } from './routes.ts'

export type DocsViewProps = {
  page: PageDefinition
  registry: DocsRegistry
  versions: { version: string; crawl: boolean }[]
  activeVersion?: string
  sourceUrl?: string
  children?: RemixNode | RemixNode[]
}

export function DocsDocument(handle: Handle<DocsViewProps>) {
  return () => {
    let { page, registry, versions, activeVersion, sourceUrl, children } = handle.props
    let apiName = page.docFile?.name
    let slug = page.docFile?.urlPath
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {activeVersion != null ? (
            <>
              <meta name="robots" content="noindex,nofollow" />
              <meta name="googlebot" content="noindex,nofollow" />
            </>
          ) : null}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700"
          />
          <title>{`${page.title} | Remix API Documentation`}</title>
          {slug ? (
            <link
              rel="alternate"
              type="text/markdown"
              href={routes.markdown.href({ version: activeVersion, slug })}
              title={`Markdown docs for ${apiName}`}
            />
          ) : null}
          <script
            async
            type="module"
            src={routes.assets.href({ version: activeVersion, asset: 'entry.js' })}
          />
          <RMX_01 />
        </head>
        <body mix={bodyCss}>
          <RMX_01_GLYPHS />
          <input
            id="nav-toggle"
            type="checkbox"
            mix={navToggleCss}
            aria-hidden="true"
            tabIndex={-1}
          />
          <a href="https://remix.run" mix={mobileLogoBannerCss}>
            <RemixLogoLight activeVersion={activeVersion} />
            <RemixLogoDark activeVersion={activeVersion} />
          </a>
          <label
            for="nav-toggle"
            mix={mobileTopBarCss}
            aria-controls="docs-sidebar"
            aria-label="Toggle navigation"
          >
            <span mix={mobileTopBarTextCss}>
              {page.eyebrow ? <span mix={eyebrowTextCss}>{page.eyebrow}</span> : null}
              <span mix={mobileTopBarTitleCss}>{page.navLabel || page.title || 'Overview'}</span>
            </span>
            <Glyph name="menu" mix={mobileTopBarIconCss} aria-hidden="true" />
          </label>
          <div mix={shellCss}>
            <aside id="docs-sidebar" mix={sidebarFrameCss}>
              <div mix={sidebarStickyCss}>
                <Sidebar
                  registry={registry}
                  currentPath={page.path}
                  versions={versions}
                  activeVersion={activeVersion}
                />
              </div>
            </aside>

            <main mix={mainCss}>
              <div mix={pageWrapCss}>
                <div mix={[pageContentCss, page.css]}>
                  <PageHeader page={page} sourceUrl={sourceUrl} />
                  {children}
                </div>
                <DocsFooter />
              </div>
            </main>
          </div>
          <label id="nav-backdrop" for="nav-toggle" aria-label="Close navigation" />
        </body>
      </html>
    )
  }
}

function Sidebar(
  handle: Handle<{
    registry: DocsRegistry
    currentPath: string
    versions: { version: string; crawl: boolean }[]
    activeVersion?: string
  }>,
) {
  return () => {
    let { registry, currentPath, versions, activeVersion } = handle.props
    let activePage = Object.values(registry.pages).find((p) => p.path === currentPath)
    let openSections = activePage && activePage.docFile ? [activePage.sectionId] : []

    return (
      <div mix={sidebarPanelCss}>
        <div mix={sidebarIntroCss}>
          <a href="https://remix.run" class="logo">
            <RemixLogoLight activeVersion={activeVersion} />
            <RemixLogoDark activeVersion={activeVersion} />
          </a>
        </div>

        <VersionSwitcher versions={versions} activeVersion={activeVersion} />

        {registry.sections.map((section) => (
          <details
            key={section.id}
            open={openSections.includes(section.id) || undefined}
            mix={sectionDetailsCss}
          >
            <summary mix={sectionSummaryCss}>
              <span mix={sectionSummaryLabelCss}>{section.label}</span>
            </summary>
            <div mix={sectionContentCss}>
              {section.groups.map((group) => (
                <div key={group.id} mix={sidebarGroupCss}>
                  {group.label ? <p mix={sidebarHeadingCss}>{group.label}</p> : null}
                  <nav
                    aria-label={
                      group.label ? `${section.label} ${group.label}` : `${section.label} pages`
                    }
                    mix={sidebarNavCss}
                  >
                    {group.pageIds.map((pageId) => {
                      let navPage = registry.pages[pageId]
                      return (
                        <a
                          key={navPage.path}
                          href={navPage.path}
                          aria-current={isPageActive(navPage, currentPath) ? 'page' : undefined}
                          mix={getNavItemMix(navPage, currentPath)}
                        >
                          {navPage.navLabel}
                        </a>
                      )
                    })}
                  </nav>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    )
  }
}

function RemixLogoLight(handle: Handle<{ activeVersion?: string }>) {
  let { activeVersion } = handle.props
  return () => {
    return (
      <div mix={logoLightCss}>
        <img
          src={routes.assets.href({
            version: activeVersion,
            asset: 'remix-wordmark-light-mode.svg',
          })}
          alt="Remix"
          mix={logoCss}
        />
      </div>
    )
  }
}

function RemixLogoDark(handle: Handle<{ activeVersion?: string }>) {
  let { activeVersion } = handle.props
  return () => {
    return (
      <div mix={logoDarkCss}>
        <img
          src={routes.assets.href({
            version: activeVersion,
            asset: 'remix-wordmark-dark-mode.svg',
          })}
          alt="Remix"
          mix={logoCss}
        />
      </div>
    )
  }
}

function VersionSwitcher(
  handle: Handle<{
    versions: { version: string; crawl: boolean }[]
    activeVersion?: string
  }>,
) {
  return () => {
    let { versions, activeVersion } = handle.props

    let navVersions = versions
    if (activeVersion) {
      let idx = versions.findIndex((v) => v.version === activeVersion)
      if (idx >= 0) navVersions = versions.slice(idx)
    }

    return (
      <details open={activeVersion != null || undefined} mix={sectionDetailsCss}>
        <summary mix={sectionSummaryCss}>
          <span mix={sectionSummaryLabelCss}>Version</span>
        </summary>
        <div mix={sectionContentCss}>
          <nav aria-label="Versions" mix={sidebarNavCss}>
            {navVersions.map((v) => {
              let latest =
                (versions.length === 0 || v.version === versions[0]?.version) && !activeVersion
              let active = v.version === activeVersion || latest
              let href = routes.home.href({ version: !latest ? v.version : undefined })
              return (
                <a
                  key={v.version}
                  href={href}
                  rel={!latest && !v.crawl ? 'nofollow' : undefined}
                  aria-current={active ? 'page' : undefined}
                  mix={active ? [navItemCss, navItemActiveCss] : navItemCss}
                >
                  {v.version}
                  {latest ? ' (latest)' : null}
                </a>
              )
            })}
          </nav>
        </div>
      </details>
    )
  }
}

function PageHeader(handle: Handle<{ page: PageDefinition; sourceUrl?: string }>) {
  return () => {
    let { page, sourceUrl } = handle.props
    let showTitle = !page.docFile && page.title.length > 0
    return page.eyebrow || showTitle || page.description ? (
      <header mix={pageHeaderCss}>
        {page.eyebrow && sourceUrl ? (
          <div mix={eyebrowRowCss}>
            {page.eyebrow ? <span mix={eyebrowTextCss}>{page.eyebrow}</span> : <span />}
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener" mix={viewSourceLinkCss}>
                View Source
              </a>
            ) : null}
          </div>
        ) : null}
        {showTitle ? <h2 mix={pageTitleCss}>{page.title}</h2> : null}
        {page.description ? (
          <p mix={[bodyTextCss, pageDescriptionCss]}>{page.description}</p>
        ) : null}
      </header>
    ) : null
  }
}

function DocsFooter() {
  return () => (
    <footer mix={footerCss}>
      <div mix={footerLegalTextCss}>
        <span>docs and examples licensed under mit</span>
        <span>©{new Date().getFullYear()} Shopify, Inc.</span>
      </div>
    </footer>
  )
}

function getNavItemMix(page: PageDefinition, currentPath: string) {
  return isPageActive(page, currentPath) ? [navItemCss, navItemActiveCss] : navItemCss
}

// Typography mirrors the `.md-prose` rules from the remix.run blog
// (`/styles/md.css`) and is applied site-wide.
//
// `!important` is required on the margin/decoration overrides below because the
// RMX_01 theme renders an unlayered `:where(h1, h2, ..., p, ul, ol, ...)
// { margin: 0 }` reset, while the `css()` mixin always wraps its rules in
// `@layer rmx.*`. Per the CSS cascade, unlayered author rules beat any layered
// author rule of equal/lower importance regardless of specificity — so without
// `!important` our margins are silently dropped.
const bodyCss = css({
  margin: 0,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.normal,
  lineHeight: '1.4',
  letterSpacing: '-0.008em',

  '& :is(h1, h2, h3, h4, h5, h6)': {
    fontFamily: theme.fontFamily.sans,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: '-0.02em',
    lineHeight: '1',
    color: theme.colors.text.primary,
    marginTop: `${theme.space.lg} !important`,
    marginBottom: `${theme.space.lg} !important`,
  },
  '& h1': {
    fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
    overflowWrap: 'anywhere',
  },
  '& h2': {
    fontSize: 'clamp(1.375rem, 2.5vw, 1.625rem)',
    marginTop: `calc(${theme.space.xxl} + ${theme.space.lg}) !important`,
  },
  '& h3': {
    fontSize: 'clamp(1.125rem, 1.75vw, 1.25rem)',
  },
  '& h4': {
    fontSize: '1.0625rem',
  },
  '& h5': {
    fontSize: '1rem',
  },
  '& h6': {
    fontSize: '1rem',
  },

  '& p': {
    marginTop: `${theme.space.lg} !important`,
    marginBottom: `${theme.space.lg} !important`,
  },

  '& ul': {
    listStyle: 'disc',
    marginTop: `${theme.space.xxl} !important`,
    marginBottom: `${theme.space.lg} !important`,
    paddingInlineStart: theme.space.xxl,
  },
  '& ol': {
    listStyle: 'decimal',
    marginTop: `${theme.space.xxl} !important`,
    marginBottom: `${theme.space.lg} !important`,
    paddingInlineStart: theme.space.xxl,
  },
  '& li + li': {
    marginTop: theme.space.xs,
  },
  '& li > p': {
    margin: '0 !important',
  },

  '& a': {
    color: theme.colors.text.link,
    textDecoration: 'underline',
  },

  '& :is(code, pre)': {
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
  },
  '& pre': {
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    margin: `${theme.space.lg} 0 !important`,
    overflowX: 'auto',
    lineHeight: theme.lineHeight.relaxed,
    '@media (min-width: 768px)': {
      padding: theme.space.lg,
    },
  },
  '& :not(a):not(pre) > code': {
    background: theme.surface.lvl3,
    borderRadius: theme.radius.sm,
    padding: '1px 6px 2px',
    lineHeight: '1.425',
  },
  '& :is(h1, h2, h3, h4, h5, h6) code': {
    fontSize: '90%',
    padding: '0.125em 0.25em',
  },

  '& .shiki': {
    backgroundColor: `${theme.surface.lvl4} !important`,
    '& a': {
      color: 'inherit',
    },
    '@media (prefers-color-scheme: dark)': {
      '&, & span': {
        color: 'var(--shiki-dark) !important',
      },
    },
  },

  // Sidebar opt-out: the global `& a { underline }` and `& p { margin: 2rem }`
  // would otherwise wreck the nav and group labels. Higher-specificity
  // descendant selectors win without needing !important fights.
  '& aside a': {
    textDecoration: 'none',
  },
  '& aside p': {
    marginTop: '0 !important',
    marginBottom: '0 !important',
  },

  '#nav-backdrop': {
    display: 'none',
  },

  // Mobile nav toggle: the sidebar is always positioned below the breakpoint
  // but clipped to nothing via clip-path. Toggling the checkbox animates the
  // clip-path open, wiping the content into view from top to bottom.
  '@media (max-width: 980px)': {
    '& #docs-sidebar': {
      position: 'fixed',
      top: '56px',
      bottom: '15vh',
      left: 0,
      right: 0,
      overflowY: 'auto',
      borderRight: 'none',
      borderBottom: `1px solid ${theme.colors.border.subtle}`,
      boxShadow: `0 8px 6px -6px ${theme.colors.text.secondary}`,
      zIndex: 50,
      // Negative insets on the sides and bottom give the box-shadow room to
      // paint beyond the element's bounds — clip-path otherwise clips the
      // shadow along with the rest of the element.
      clipPath: 'inset(0 -24px 100% -24px)',
      pointerEvents: 'none',
      transition: 'clip-path 280ms ease',
    },
    '& main': {
      transition: 'opacity 280ms ease',
    },
    '&:has(#nav-toggle:checked)': {
      overflow: 'hidden',
    },
    '&:has(#nav-toggle:checked) #docs-sidebar': {
      clipPath: 'inset(0 -24px -24px -24px)',
      pointerEvents: 'auto',
    },
    // The backdrop label is kept (transparent) so clicking outside the menu
    // still toggles the checkbox closed; only the gradient is gone.
    '&:has(#nav-toggle:checked) #nav-backdrop': {
      display: 'block',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '15vh',
      cursor: 'pointer',
      zIndex: 50,
    },
    '&:has(#nav-toggle:checked) main': {
      opacity: 0.25,
    },
  },
})

const shellCss = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  background:
    'linear-gradient(to bottom, color-mix(in oklab, rgb(246 246 246) 72%, white) 0%, white 18%)',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

const sidebarFrameCss = css({
  backgroundColor: theme.surface.lvl3,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 980px)': {
    // Mobile open/closed state is driven from bodyCss via :has(#nav-toggle:checked)
    // (see the bodyCss media block). The sidebar is hidden by default and
    // overlaid on top of the page when the toggle is checked, so no border
    // styling is needed here on mobile.
    borderRight: 'none',
  },
})

const sidebarStickyCss = css({
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  padding: theme.space.xl,
  '@media (max-width: 980px)': {
    position: 'static',
    height: 'auto',
    overflowY: 'visible',
  },
})

const sidebarIntroCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  paddingBottom: theme.space.sm,
  marginBottom: theme.space.sm,
})

const sidebarPanelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
})

const sidebarHeadingCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
  '@media (max-width: 980px)': {
    fontSize: theme.fontSize.xs,
  },
})

const sectionDetailsCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const sectionSummaryCss = css({
  margin: 0,
  padding: `${theme.space.xs} 0`,
  cursor: 'pointer',
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
  '&:hover': {
    color: theme.colors.text.primary,
  },
  '@media (max-width: 980px)': {
    minHeight: '44px',
    padding: `${theme.space.md} 0`,
    fontSize: theme.fontSize.xs,
  },
})

const sectionSummaryLabelCss = css({
  paddingInlineStart: theme.space.xs,
})

const sectionContentCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  paddingInlineStart: theme.space.md,
  paddingBottom: theme.space.sm,
})

const sidebarGroupCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  paddingLeft: theme.space.sm,
})

const sidebarNavCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const sidebarTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const logoLightCss = css({
  display: 'block',
  '@media (prefers-color-scheme: dark)': {
    display: 'none',
  },
})

const logoDarkCss = css({
  display: 'none',
  '@media (prefers-color-scheme: dark)': {
    display: 'block',
  },
})

const logoCss = css({
  width: 'auto',
  height: '16px',
})

const navItemCss = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: theme.control.height.sm,
  paddingInline: theme.space.sm,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  transitionProperty: 'background-color, color, box-shadow',
  transitionDuration: '120ms',
  transitionTimingFunction: 'ease',
  '&:hover': {
    backgroundColor: theme.surface.lvl0,
    color: theme.colors.text.primary,
  },
  '@media (max-width: 980px)': {
    minHeight: '44px',
  },
})

const navItemActiveCss = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  boxShadow: `inset 0 0 0 1px ${theme.colors.border.subtle}`,
})

const mainCss = css({
  minWidth: 0,
  padding: theme.space.xxl,
  paddingBlockEnd: 0,
  paddingInlineStart: 'clamp(48px, 6vw, 96px)',
  '@media (max-width: 980px)': {
    padding: theme.space.lg,
    paddingBlockEnd: 0,
  },
})

const pageWrapCss = css({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  maxWidth: '750px',
  minHeight: `calc(100vh - ${theme.space.xxl})`,
  marginInline: '0 auto',
  '@media (max-width: 980px)': {
    minHeight: `calc(100vh - ${theme.space.xl})`,
  },
})

const pageContentCss = css({
  display: 'block',
})

const pageHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '52rem',
})

const eyebrowRowCss = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: theme.space.md,
})

const viewSourceLinkCss = css({
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': {
    color: theme.colors.text.primary,
    textDecoration: 'underline',
  },
})

const pageTitleCss = css({
  margin: 0,
  fontSize: 'clamp(28px, 3vw, 38px)',
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const pageDescriptionCss = css({
  maxWidth: '64ch',
})

const footerCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 'auto',
  padding: `${theme.space.md} 0`,
  color: theme.colors.text.muted,
})

const footerLegalTextCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.space.xs,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xxxs,
  lineHeight: '1.6',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

// Visually hide the checkbox while keeping it focusable. Toggling happens via
// the <label for="nav-toggle"> elements (top bar + backdrop).
const navToggleCss = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
})

// Mobile-only Remix logo banner that sits above the sticky top bar in the
// document flow. It scrolls off the screen as the user scrolls the page.
const mobileLogoBannerCss = css({
  display: 'none',
  '@media (max-width: 980px)': {
    display: 'flex',
    alignItems: 'center',
    padding: `${theme.space.lg}`,
    backgroundColor: theme.surface.lvl3,
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

const mobileTopBarCss = css({
  display: 'none',
  '@media (max-width: 980px)': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    padding: `0 ${theme.space.lg}`,
    height: '48px',
    backgroundColor: theme.surface.lvl3,
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
    cursor: 'pointer',
    position: 'sticky',
    top: 0,
    zIndex: 60,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
})

const mobileTopBarTextCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  overflow: 'hidden',
})

const mobileTopBarTitleCss = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
})

const mobileTopBarIconCss = css({
  width: theme.fontSize.xl,
  height: theme.fontSize.xl,
  color: theme.colors.text.primary,
  flexShrink: 0,
})

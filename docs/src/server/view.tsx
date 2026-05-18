import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { Glyph } from '@remix-run/ui/glyph'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'
import type { DocsRegistry, NavGroup, PageDefinition } from './registry.ts'
import { isPageActive } from './registry.ts'
import { bodyTextCss, eyebrowTextCss } from './page-primitives.tsx'
import { routes } from './routes.ts'
import {
  MOBILE_NAV_MAX_HEIGHT,
  MOBILE_NAV_MEDIA_RULE,
  MOBILE_TOP_BAR_HEIGHT_PX,
} from '../shared/breakpoints.ts'

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
          <link
            rel="icon"
            href={routes.assets.href({ version: activeVersion, asset: 'favicon.ico' })}
            sizes="32x32"
          />
          <link
            rel="icon"
            href={routes.assets.href({ version: activeVersion, asset: 'favicon.svg' })}
            type="image/svg+xml"
            sizes="any"
          />
          {activeVersion != null ? (
            <>
              <meta name="robots" content="noindex,nofollow" />
              <meta name="googlebot" content="noindex,nofollow" />
            </>
          ) : page.docFile?.kind === 'package' ? (
            // Overview pages (package READMEs) link densely to every API page
            // in the package; those are already reachable via the sidebar, so
            // tell crawlers — including our prerender spider — not to follow
            // links from here. The page itself is still indexable.
            <meta name="robots" content="nofollow" />
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
              {section.groups.map((group) =>
                group.label ? (
                  <nav key={group.id} mix={[sidebarGroupCss]}>
                    <p mix={sidebarHeadingCss}>{group.label}</p>
                    <nav aria-label={`${section.label} ${group.label}`} mix={sidebarNavCss}>
                      <SidebarGroup registry={registry} group={group} currentPath={currentPath} />
                    </nav>
                  </nav>
                ) : (
                  <nav
                    key={group.id}
                    aria-label={`${section.label} Pages`}
                    mix={[sidebarGroupCss, css({ paddingLeft: 0 })]}
                  >
                    <SidebarGroup registry={registry} group={group} currentPath={currentPath} />
                  </nav>
                ),
              )}
            </div>
          </details>
        ))}
      </div>
    )
  }
}

function SidebarGroup(
  handle: Handle<{ registry: DocsRegistry; group: NavGroup; currentPath: string }>,
) {
  return () => {
    let { registry, group, currentPath } = handle.props
    return group.pageIds.map((pageId) => {
      let page = registry.pages[pageId]
      let active = isPageActive(page, currentPath)
      return (
        <a
          key={page.path}
          href={page.path}
          aria-current={active ? 'page' : undefined}
          data-active-doc={active ? 'true' : undefined}
          mix={navItemCss}
        >
          {page.navLabel}
        </a>
      )
    })
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
                  mix={navItemCss}
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

// Typography mirrors the `.md-prose` rules from the remix.run blog
// (`/styles/md.css`) and is applied site-wide.
const bodyCss = css({
  margin: 0,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.normal,
  lineHeight: '1.4',
  letterSpacing: '-0.008em',

  // Headings
  '& :is(h1, h2, h3, h4, h5, h6)': {
    fontFamily: theme.fontFamily.sans,
    fontWeight: theme.fontWeight.bold,
    letterSpacing: '-0.02em',
    lineHeight: '1',
    color: theme.colors.text.primary,
    margin: `${theme.space.lg} 0`,
  },
  '& h1': {
    fontSize: 'clamp(1.5rem, 4vw, 3.5rem)',
    overflowWrap: 'anywhere',
    marginTop: theme.space.xxl,
  },
  '& h2': {
    fontSize: 'clamp(1.375rem, 2.5vw, 1.625rem)',
    marginTop: theme.space.xxl,
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

  // Paragraphs
  '& p': {
    margin: `${theme.space.lg} 0`,
  },

  // Lists
  '& ol, & ul': {
    margin: `${theme.space.xxl} 0 ${theme.space.lg}`,
    paddingInlineStart: theme.space.xxl,
  },
  '& ul': {
    listStyle: 'disc',
  },
  '& ol': {
    listStyle: 'decimal',
  },
  '& li + li': {
    marginTop: theme.space.xs,
  },
  '& li > p': {
    margin: 0,
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
    margin: `${theme.space.lg} 0`,
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
    backgroundColor: theme.surface.lvl4,
    '& a': {
      color: 'inherit',
    },
    '@media (prefers-color-scheme: dark)': {
      '&, & span': {
        color: 'var(--shiki-dark)',
      },
    },
  },

  // Sidebar opt-out: the global `& a { underline }` and `& p { margin: 2rem }`
  // would otherwise wreck the nav and group labels. Higher-specificity
  // descendant selectors win without needing fights.
  '& aside a': {
    textDecoration: 'none',
  },
  '& aside p': {
    marginTop: 0,
    marginBottom: 0,
  },

  // Mobile nav toggle: the sidebar stays in document flow below the sticky top
  // bar so opening it pushes page content down instead of layering over it.
  [MOBILE_NAV_MEDIA_RULE]: {
    '& #docs-sidebar': {
      maxHeight: 0,
      overflowY: 'auto',
      borderRight: 'none',
      borderBottom: `1px solid transparent`,
      pointerEvents: 'none',
      transition: 'max-height 280ms ease, border-color 180ms ease',
    },
    '&:has(#nav-toggle:checked) #docs-sidebar': {
      maxHeight: MOBILE_NAV_MAX_HEIGHT,
      borderBottomColor: theme.colors.border.subtle,
      pointerEvents: 'auto',
    },
  },
})

const shellCss = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  background:
    'linear-gradient(to bottom, color-mix(in oklab, rgb(246 246 246) 72%, white) 0%, white 18%)',
  [MOBILE_NAV_MEDIA_RULE]: {
    gridTemplateColumns: '1fr',
  },
})

const sidebarFrameCss = css({
  backgroundColor: theme.surface.lvl3,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  [MOBILE_NAV_MEDIA_RULE]: {
    // Mobile open/closed state is driven from bodyCss via :has(#nav-toggle:checked).
    borderRight: 'none',
  },
})

const sidebarStickyCss = css({
  position: 'sticky',
  top: 0,
  height: '100vh',
  overflowY: 'auto',
  padding: theme.space.xl,
  [MOBILE_NAV_MEDIA_RULE]: {
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
  [MOBILE_NAV_MEDIA_RULE]: {
    display: 'none',
  },
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
  [MOBILE_NAV_MEDIA_RULE]: {
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
  [MOBILE_NAV_MEDIA_RULE]: {
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
  '&[aria-current="page"]': {
    backgroundColor: theme.surface.lvl0,
    color: theme.colors.text.primary,
    boxShadow: `inset 0 0 0 1px ${theme.colors.border.subtle}`,
  },
  [MOBILE_NAV_MEDIA_RULE]: {
    minHeight: '44px',
  },
})

const mainCss = css({
  minWidth: 0,
  padding: theme.space.xxl,
  paddingBlockEnd: 0,
  paddingInlineStart: 'clamp(48px, 6vw, 96px)',
  [MOBILE_NAV_MEDIA_RULE]: {
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
  [MOBILE_NAV_MEDIA_RULE]: {
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
// the mobile top bar's <label for="nav-toggle">.
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
  [MOBILE_NAV_MEDIA_RULE]: {
    display: 'flex',
    alignItems: 'center',
    padding: `${theme.space.lg}`,
    backgroundColor: theme.surface.lvl3,
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

const mobileTopBarCss = css({
  display: 'none',
  [MOBILE_NAV_MEDIA_RULE]: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
    padding: `0 ${theme.space.lg}`,
    height: MOBILE_TOP_BAR_HEIGHT_PX,
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

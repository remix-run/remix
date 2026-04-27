import { css } from 'remix/component'
import type { Handle } from 'remix/component'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'
import { NAV_SECTIONS, PAGES, type ShowcasePageDefinition, isPageActive } from './registry.tsx'
import { bodyTextCss, eyebrowTextCss } from './page-primitives.tsx'

export function ExplorerDocument(handle: Handle<{ page: ShowcasePageDefinition }>) {
  return () => {
    let { page } = handle.props
    return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <script async type="module" src="/assets/entry.js" />
        <title>{`${page.title} | Remix UI Demo`}</title>
        <RMX_01 />
      </head>
      <body mix={bodyCss}>
        <RMX_01_GLYPHS />
        <div mix={shellCss}>
          <aside mix={sidebarFrameCss}>
            <div mix={sidebarStickyCss}>
              <Sidebar currentPath={page.path} />
            </div>
          </aside>

          <main mix={mainCss}>
            <div mix={pageWrapCss}>
              <PageHeader page={page} />
              {page.render()}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
  }
}

function Sidebar(handle: Handle<{ currentPath: string }>) {
  return () => {
    let { currentPath } = handle.props
    return (
    <div mix={sidebarPanelCss}>
      <div mix={sidebarIntroCss}>
        <p mix={eyebrowTextCss}>Preview Documentation</p>
        <h1 mix={sidebarTitleCss}>Remix UI</h1>
        <p mix={bodyTextCss}>
          This is a preview of the Remix UI library. It is not yet ready for production use.
        </p>
      </div>

      {NAV_SECTIONS.map((section) => (
        <section key={section.id} mix={sidebarSectionCss}>
          <p mix={sidebarHeadingCss}>{section.label}</p>
          <nav aria-label={`${section.label} pages`} mix={sidebarNavCss}>
            {section.pageIds.map((pageId) => {
              let navPage = PAGES[pageId]
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
        </section>
      ))}
    </div>
  )
  }
}

function PageHeader(handle: Handle<{ page: ShowcasePageDefinition }>) {
  return () => {
    let { page } = handle.props
    return (
    <header mix={pageHeaderCss}>
      <p mix={eyebrowTextCss}>{page.eyebrow}</p>
      <h2 mix={pageTitleCss}>{page.title}</h2>
      <p mix={[bodyTextCss, pageDescriptionCss]}>{page.description}</p>
    </header>
  )
  }
}

function getNavItemMix(page: ShowcasePageDefinition, currentPath: string) {
  return isPageActive(page, currentPath) ? [navItemCss, navItemActiveCss] : navItemCss
}

const bodyCss = css({
  margin: 0,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
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
    borderRight: 'none',
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
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
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const sidebarPanelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

const sidebarSectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const sidebarHeadingCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
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
})

const navItemActiveCss = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  boxShadow: `inset 0 0 0 1px ${theme.colors.border.subtle}`,
})

const mainCss = css({
  minWidth: 0,
  padding: theme.space.xxl,
  '@media (max-width: 980px)': {
    padding: theme.space.xl,
  },
})

const pageWrapCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xxl,
  width: '100%',
  maxWidth: '750px',
  marginInline: 'auto',
})

const pageHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '52rem',
})

const pageTitleCss = css({
  margin: 0,
  fontSize: 'clamp(28px, 3vw, 38px)',
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  maxWidth: '18ch',
})

const pageDescriptionCss = css({
  margin: 0,
  maxWidth: '64ch',
})

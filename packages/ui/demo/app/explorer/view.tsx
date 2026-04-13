import { css } from 'remix/component'
import { createGlyphSheet, RMX_01, RMX_01_GLYPHS, theme, ui } from 'remix/ui'
import type { ThemeMix } from 'remix/ui'

import { NAV_SECTIONS, PAGES, type ShowcasePageDefinition, isPageActive } from './registry.tsx'

let RMX_01Glyphs = createGlyphSheet(RMX_01_GLYPHS)

export function ExplorerDocument() {
  return ({ page }: { page: ShowcasePageDefinition }) => (
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
        <RMX_01Glyphs />
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

function Sidebar() {
  return ({ currentPath }: { currentPath: string }) => (
    <div mix={ui.sidebar.panel}>
      <div mix={sidebarIntroCss}>
        <p mix={ui.text.eyebrow}>Remix UI</p>
        <h1 mix={sidebarTitleCss}>Showcase-first demo</h1>
        <p mix={sidebarBodyCss}>Examples first, source visible, and built from the same theme/UI surface.</p>
      </div>

      {NAV_SECTIONS.map((section) => (
        <section key={section.id} mix={ui.sidebar.section}>
          <p mix={ui.sidebar.heading}>{section.label}</p>
          <nav aria-label={`${section.label} pages`} mix={ui.nav.list}>
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

function PageHeader() {
  return ({ page }: { page: ShowcasePageDefinition }) => (
    <header mix={pageHeaderCss}>
      <p mix={ui.text.eyebrow}>{page.eyebrow}</p>
      <h2 mix={[ui.text.display, pageTitleCss]}>{page.title}</h2>
      <p mix={[ui.text.body, pageDescriptionCss]}>{page.description}</p>
    </header>
  )
}

function getNavItemMix(page: ShowcasePageDefinition, currentPath: string): ThemeMix {
  return isPageActive(page, currentPath) ? ui.nav.itemActive : ui.nav.item
}

let bodyCss = css({
  margin: 0,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
})

let shellCss = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  background:
    'linear-gradient(to bottom, color-mix(in oklab, rgb(246 246 246) 72%, white) 0%, white 18%)',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let sidebarFrameCss = css({
  backgroundColor: theme.surface.lvl3,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 980px)': {
    borderRight: 'none',
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

let sidebarStickyCss = css({
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

let sidebarIntroCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  paddingBottom: theme.space.sm,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

let sidebarTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let sidebarBodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let mainCss = css({
  minWidth: 0,
  padding: theme.space.xxl,
  '@media (max-width: 980px)': {
    padding: theme.space.xl,
  },
})

let pageWrapCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xxl,
  width: '100%',
  maxWidth: '750px',
  marginInline: 'auto',
})

let pageHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  maxWidth: '52rem',
})

let pageTitleCss = css({
  margin: 0,
  fontSize: 'clamp(28px, 3vw, 38px)',
  maxWidth: '18ch',
})

let pageDescriptionCss = css({
  margin: 0,
  maxWidth: '64ch',
})

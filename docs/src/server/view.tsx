import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'
import type { DocsRegistry, PageDefinition } from './registry.ts'
import { isPageActive } from './registry.ts'
import { bodyTextCss, eyebrowTextCss } from './page-primitives.tsx'
import { routes } from './routes.ts'
import { ServerPage } from './components.tsx'

export type DocsViewProps = {
  page: PageDefinition
  registry: DocsRegistry
  versions: { version: string; crawl: boolean }[]
  activeVersion?: string
  children?: RemixNode | RemixNode[]
}

export function DocsDocument(handle: Handle<DocsViewProps>) {
  return () => {
    let { page, registry, versions, activeVersion, children } = handle.props
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
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
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
          {/* <link
            href={routes.assets.href({ version: activeVersion, asset: 'docs.css' })}
            rel="stylesheet"
          /> */}
          <script
            async
            type="module"
            src={routes.assets.href({ version: activeVersion, asset: 'entry.js' })}
          />
          <RMX_01 />
        </head>
        <body mix={bodyCss}>
          <RMX_01_GLYPHS />
          <div mix={shellCss}>
            <aside mix={sidebarFrameCss}>
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
                <PageHeader page={page} />
                {children}
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
          <a href={routes.home.href({ version: undefined })} class="logo">
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

function PageHeader(handle: Handle<{ page: PageDefinition }>) {
  return () => {
    let { page } = handle.props
    return (
      <header mix={pageHeaderCss}>
        <p mix={eyebrowTextCss}>{page.eyebrow}</p>
        {!page.docFile ? <h2 mix={pageTitleCss}>{page.title}</h2> : null}
        {page.description ? (
          <p mix={[bodyTextCss, pageDescriptionCss]}>{page.description}</p>
        ) : null}
      </header>
    )
  }
}

function getNavItemMix(page: PageDefinition, currentPath: string) {
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
  marginBottom: theme.space.sm,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
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
  width: '100%',
  height: 'auto',
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

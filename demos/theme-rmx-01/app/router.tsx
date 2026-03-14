import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { RMX_01, theme, ui } from '@remix-run/theme'
import type { ThemeUtility } from '@remix-run/theme'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

export let router = createRouter({ middleware })

router.get('/', async () => {
  let stream = renderToStream(<App />, {
    onError(error) {
      console.error(error)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
})

function App() {
  return () => (
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
        <title>RMX_01 Theme Demo</title>
        <RMX_01 />
      </head>
      <body mix={[bodyCss]}>
        <div mix={[appShellCss]}>
          <aside mix={[sidebarCss]}>
            <div mix={[sidebarHeaderCss]}>
              <p mix={[eyebrowCss]}>Theme Preset</p>
              <h1 mix={[sidebarTitleCss]}>RMX_01</h1>
              <p mix={[sidebarBodyCss]}>
                A calm, general-purpose UI theme for dashboards, admin tools, and internal web
                applications.
              </p>
            </div>

            <nav aria-label="Demo sections" mix={[sidebarNavCss]}>
              <a href="#buttons" mix={[navLinkCss]}>
                Buttons
              </a>
              <a href="#cards" mix={[navLinkCss]}>
                Cards
              </a>
              <a href="#overlays" mix={[navLinkCss]}>
                Popovers
              </a>
              <a href="#content" mix={[navLinkCss]}>
                Content
              </a>
            </nav>

            <section mix={[calloutCss, calloutInfoCss]}>
              <p mix={[calloutTitleCss]}>Why this preset?</p>
              <p mix={[calloutBodyCss]}>
                Native-sized controls, restrained spacing, readable text contrast, and surfaces that
                feel ready for real product work.
              </p>
            </section>
          </aside>

          <main mix={[mainCss]}>
            <header mix={[heroCss]}>
              <div mix={[heroCopyCss]}>
                <p mix={[eyebrowCss]}>Application Theme</p>
                <h2 mix={[heroTitleCss]}>A default Remix theme for utilitarian interfaces</h2>
                <p mix={[heroBodyCss]}>
                  The preset leans into compact controls, neutral surfaces, predictable typography,
                  and semantic color roles that can carry a full component library.
                </p>
              </div>

              <div mix={[heroActionsCss]}>
                <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                  Create Project
                </button>
                <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                  Sign in →
                </button>
                <button type="button" mix={[buttonBaseCss, quietButtonCss]}>
                  Secondary Action
                </button>
              </div>
            </header>

            <Section
              id="buttons"
              title="Buttons"
              description="Primary, secondary, danger, and muted actions stay compact and readable by default."
            >
              <div mix={[buttonPanelCss]}>
                <div mix={[buttonGroupCss]}>
                  <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                    Save
                  </button>
                  <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                    Sign in →
                  </button>
                  <button type="button" mix={[buttonBaseCss, ui.button.danger]}>
                    Delete
                  </button>
                  <button type="button" mix={[buttonBaseCss, quietButtonCss]}>
                    Ghost
                  </button>
                </div>

                <div mix={[buttonNoteCss]}>
                  <span mix={[statusDotCss, statusInfoDotCss]} />
                  Default button density is intentionally close to native controls for app-heavy
                  layouts.
                </div>
              </div>
            </Section>

            <Section
              id="cards"
              title="Cards and Surfaces"
              description="Semantic backgrounds create clear hierarchy without relying on loud gradients or oversized shadows."
            >
              <div mix={[cardGridCss]}>
                <Card
                  title="Primary Surface"
                  body="The default working surface for forms, tables, and routine app content."
                  mixins={[surfaceCardCss]}
                />
                <Card
                  title="Secondary Surface"
                  body="A softer layer for grouped controls, filter rails, and nested layout regions."
                  mixins={[surfaceSecondaryCardCss]}
                />
                <Card
                  title="Elevated Surface"
                  body="Use this for floating panels that should lift above the rest of the page."
                  mixins={[surfaceElevatedCardCss]}
                />
                <Card
                  title="Inset Surface"
                  body="An inset tone works well for canvas backgrounds and low-emphasis utility areas."
                  mixins={[surfaceInsetCardCss]}
                />
              </div>
            </Section>

            <Section
              id="overlays"
              title="Popover-like Surfaces"
              description="These are static examples of dialog and menu styling, meant to preview token usage rather than popup behavior."
            >
              <div mix={[overlayGridCss]}>
                <div mix={[dialogSurfaceCss]}>
                  <p mix={[surfaceLabelCss]}>Dialog</p>
                  <h3 mix={[surfaceHeadingCss]}>Share workspace</h3>
                  <p mix={[surfaceBodyCss]}>
                    Invite teammates, choose a permission level, and keep the action area visually
                    distinct without making the panel feel heavy.
                  </p>
                  <div mix={[dialogFieldCss]}>
                    <label for="dialog-email" mix={[fieldLabelCss]}>
                      Email
                    </label>
                    <input
                      id="dialog-email"
                      value="team@remix.dev"
                      readOnly
                      mix={[fieldInputCss]}
                    />
                  </div>
                  <div mix={[buttonGroupCss]}>
                    <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                      Cancel
                    </button>
                    <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                      Send Invite
                    </button>
                  </div>
                </div>

                <div mix={[menuSurfaceWrapCss]}>
                  <button type="button" aria-haspopup="menu" mix={[buttonBaseCss, ui.button.secondary]}>
                    Project Menu
                  </button>
                  <div role="menu" aria-label="Project actions" mix={[menuSurfaceCss]}>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Rename project
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Copy environment
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Transfer ownership
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemDangerCss]}>
                      Archive project
                    </button>
                  </div>
                </div>

                <div mix={[menuSurfaceCss]}>
                  <p mix={[surfaceLabelCss]}>Compact Menu Surface</p>
                  <div mix={[compactRowCss]}>
                    <span mix={[compactKeyCss]}>Status</span>
                    <span mix={[statusBadgeCss, successBadgeCss]}>Healthy</span>
                  </div>
                  <div mix={[compactRowCss]}>
                    <span mix={[compactKeyCss]}>Deploys</span>
                    <span mix={[compactValueCss]}>12 this week</span>
                  </div>
                  <div mix={[compactRowCss]}>
                    <span mix={[compactKeyCss]}>Owner</span>
                    <span mix={[compactValueCss]}>Platform team</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              id="content"
              title="Content Areas"
              description="Typography stays quiet and legible so dashboards and settings screens can carry dense information comfortably."
            >
              <div mix={[contentGridCss]}>
                <article mix={[articleCardCss]}>
                  <p mix={[surfaceLabelCss]}>Team Notes</p>
                  <h3 mix={[articleTitleCss]}>Release checklist for the next deployment</h3>
                  <p mix={[articleParagraphCss]}>
                    Keep headings firm, body copy readable, and supporting notes visually secondary.
                    The goal is to make operational content easy to scan, not decorative.
                  </p>
                  <ul mix={[articleListCss]}>
                    <li>Verify background jobs are paused before the schema migration.</li>
                    <li>Run the smoke suite against staging after the first deploy finishes.</li>
                    <li>Notify support once cache warming completes.</li>
                  </ul>
                </article>

                <section mix={[articleCardCss]}>
                  <p mix={[surfaceLabelCss]}>Reading Rhythm</p>
                  <h3 mix={[articleTitleCss]}>Default copy settings</h3>
                  <p mix={[articleParagraphCss]}>
                    RMX_01 uses modest font sizes and balanced line heights so the same theme can
                    support dense tool UIs, forms, command surfaces, and longer settings content.
                  </p>
                  <div mix={[calloutCss, calloutWarningCss]}>
                    <p mix={[calloutTitleCss]}>Guideline</p>
                    <p mix={[calloutBodyCss]}>
                      Reserve brighter colors for actions, statuses, and focus affordances instead
                      of general layout chrome.
                    </p>
                  </div>
                </section>
              </div>
            </Section>
          </main>
        </div>
      </body>
    </html>
  )
}

type SectionProps = {
  id: string
  title: string
  description: string
  children: RemixNode
}

function Section() {
  return ({ id, title, description, children }: SectionProps) => (
    <section id={id} mix={[sectionCss]}>
      <div mix={[sectionHeaderCss]}>
        <h2 mix={[sectionTitleCss]}>{title}</h2>
        <p mix={[sectionDescriptionCss]}>{description}</p>
      </div>
      {children}
    </section>
  )
}

type CardProps = {
  title: string
  body: string
  mixins?: ThemeUtility[]
}

function Card() {
  return ({ title, body, mixins = [] }: CardProps) => (
    <article mix={[cardBaseCss, ...mixins]}>
      <p mix={[surfaceLabelCss]}>Surface</p>
      <h3 mix={[surfaceHeadingCss]}>{title}</h3>
      <p mix={[surfaceBodyCss]}>{body}</p>
    </article>
  )
}

let bodyCss = css({
  margin: 0,
  backgroundColor: theme.colors.background.canvas,
  color: theme.colors.text.primary,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
})

let appShellCss = css({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
  '@media (max-width: 920px)': {
    gridTemplateColumns: '1fr',
  },
})

let sidebarCss = css({
  backgroundColor: theme.colors.background.inset,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  padding: theme.space.xl,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
  '@media (max-width: 920px)': {
    borderRight: 'none',
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

let sidebarHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let sidebarTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.bold,
})

let sidebarBodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let sidebarNavCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let navLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: theme.colors.background.surface,
    color: theme.colors.text.primary,
  },
})

let mainCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xl,
  padding: theme.space.xl,
})

let heroCss = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.space.lg,
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.colors.background.surface,
  boxShadow: theme.shadow.sm,
  '@media (max-width: 760px)': {
    flexDirection: 'column',
  },
})

let heroCopyCss = css({
  maxWidth: '720px',
})

let heroTitleCss = css({
  margin: `0 0 ${theme.space.sm}`,
  fontSize: '28px',
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: '-0.03em',
})

let heroBodyCss = css({
  margin: 0,
  maxWidth: '62ch',
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let heroActionsCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let sectionCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

let sectionHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let sectionTitleCss = css({
  margin: 0,
  fontSize: '22px',
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: '-0.02em',
})

let sectionDescriptionCss = css({
  margin: 0,
  maxWidth: '70ch',
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let buttonBaseCss = css({
  position: 'relative',
  isolation: 'isolate',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '28px',
  minHeight: '28px',
  paddingInline: theme.space.md,
  overflow: 'hidden',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  lineHeight: '1',
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  boxShadow: `inset 0 0 0 1px rgb(255 255 255 / 0.7), ${theme.shadow.xs}, ${theme.shadow.sm}`,
})

let quietButtonCss = css({
  backgroundColor: theme.colors.background.surfaceSecondary,
  backgroundImage:
    'linear-gradient(to bottom, rgb(255 255 255 / 0.96) 0%, rgb(247 247 247 / 0.98) 100%)',
  color: theme.colors.text.secondary,
  border: `0.5px solid ${theme.colors.border.default}`,
  '&:hover': {
    backgroundColor: theme.colors.background.surface,
    color: theme.colors.text.primary,
  },
  '&:active': {
    backgroundColor: theme.colors.background.inset,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
})

let buttonPanelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  boxShadow: theme.shadow.xs,
})

let buttonGroupCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let buttonNoteCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

let statusDotCss = css({
  width: '8px',
  height: '8px',
  borderRadius: theme.radius.full,
  flexShrink: 0,
})

let statusInfoDotCss = css({
  backgroundColor: theme.colors.status.info.foreground,
})

let cardGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: theme.space.md,
  '@media (max-width: 1080px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  '@media (max-width: 620px)': {
    gridTemplateColumns: '1fr',
  },
})

let cardBaseCss = css({
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  minHeight: '168px',
  boxShadow: theme.shadow.xs,
})

let surfaceCardCss = css({
  backgroundColor: theme.colors.background.surface,
})

let surfaceSecondaryCardCss = css({
  backgroundColor: theme.colors.background.surfaceSecondary,
})

let surfaceElevatedCardCss = css({
  backgroundColor: theme.colors.background.surfaceElevated,
  boxShadow: theme.shadow.md,
})

let surfaceInsetCardCss = css({
  backgroundColor: theme.colors.background.inset,
})

let overlayGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr 0.9fr',
  gap: theme.space.md,
  alignItems: 'start',
  '@media (max-width: 1080px)': {
    gridTemplateColumns: '1fr',
  },
})

let dialogSurfaceCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.colors.background.surfaceElevated,
  boxShadow: theme.shadow.md,
})

let menuSurfaceWrapCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let menuSurfaceCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surfaceElevated,
  boxShadow: theme.shadow.sm,
})

let menuItemCss = css({
  width: '100%',
  minHeight: '28px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: 'none',
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.colors.background.surfaceSecondary,
  },
})

let menuItemDangerCss = css({
  minHeight: '28px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: 'none',
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.status.danger.background,
  color: theme.colors.status.danger.foreground,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover': {
    filter: 'brightness(0.98)',
  },
})

let dialogFieldCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let fieldLabelCss = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

let fieldInputCss = css({
  minHeight: '36px',
  paddingInline: theme.space.sm,
  border: `0.5px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.surface,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.7)`,
})

let surfaceLabelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let surfaceHeadingCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
})

let surfaceBodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let compactRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  minHeight: '28px',
})

let compactKeyCss = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

let compactValueCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
})

let statusBadgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '22px',
  paddingInline: theme.space.sm,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

let successBadgeCss = css({
  backgroundColor: theme.colors.status.success.background,
  color: theme.colors.status.success.foreground,
  border: `1px solid ${theme.colors.status.success.border}`,
})

let contentGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr',
  gap: theme.space.md,
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let articleCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  boxShadow: theme.shadow.xs,
})

let articleTitleCss = css({
  margin: 0,
  fontSize: '18px',
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
})

let articleParagraphCss = css({
  margin: 0,
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let articleListCss = css({
  margin: 0,
  paddingLeft: theme.space.lg,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let calloutCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.md,
  borderRadius: theme.radius.lg,
  border: '1px solid transparent',
})

let calloutInfoCss = css({
  backgroundColor: theme.colors.status.info.background,
  borderColor: theme.colors.status.info.border,
})

let calloutWarningCss = css({
  backgroundColor: theme.colors.status.warning.background,
  borderColor: theme.colors.status.warning.border,
})

let calloutTitleCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let calloutBodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

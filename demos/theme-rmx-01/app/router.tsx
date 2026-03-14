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
              <p mix={[ui.text.eyebrow, eyebrowCss]}>Theme Preset</p>
              <h1 mix={[ui.text.title, sidebarTitleCss]}>RMX_01</h1>
              <p mix={[ui.text.bodySm, sidebarBodyCss]}>
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
              <a href="#system" mix={[navLinkCss]}>
                System
              </a>
            </nav>

            <section mix={[calloutCss, calloutInfoCss]}>
              <p mix={[ui.text.label, calloutTitleCss]}>Why this preset?</p>
              <p mix={[ui.text.bodySm, calloutBodyCss]}>
                Native-sized controls, restrained spacing, readable text contrast, and surfaces that
                feel ready for real product work.
              </p>
            </section>
          </aside>

          <main mix={[mainCss]}>
            <header mix={[ui.surface.base, heroCss]}>
              <div mix={[heroCopyCss]}>
                <p mix={[ui.text.eyebrow, eyebrowCss]}>Application Theme</p>
                <h2 mix={[ui.text.display, heroTitleCss]}>A default Remix theme for utilitarian interfaces</h2>
                <p mix={[ui.text.body, heroBodyCss]}>
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
              <div mix={[ui.card.base, buttonPanelCss]}>
                <div mix={ui.card.header}>
                  <p mix={ui.card.eyebrow}>Control Recipes</p>
                  <h3 mix={ui.card.title}>Compact buttons for app-heavy interfaces</h3>
                  <p mix={ui.card.description}>
                    Button tone changes, but the shared shape, border, shadow, and density keep the
                    controls feeling like the same family.
                  </p>
                </div>

                <div mix={ui.card.body}>
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
                </div>

                <div mix={ui.card.footer}>
                  <div mix={[ui.text.bodySm, buttonNoteCss]}>
                    <span mix={[statusDotCss, statusInfoDotCss]} />
                    Default button density is intentionally close to native controls for app-heavy
                    layouts.
                  </div>
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
                  tone={ui.card.base}
                  mixins={[surfaceCardCss]}
                />
                <Card
                  title="Secondary Surface"
                  body="A softer layer for grouped controls, filter rails, and nested layout regions."
                  tone={ui.card.secondary}
                  mixins={[surfaceSecondaryCardCss]}
                />
                <Card
                  title="Elevated Surface"
                  body="Use this for floating panels that should lift above the rest of the page."
                  tone={ui.card.elevated}
                  mixins={[surfaceElevatedCardCss]}
                />
                <Card
                  title="Inset Surface"
                  body="An inset tone works well for canvas backgrounds and low-emphasis utility areas."
                  tone={ui.card.inset}
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
                <div mix={[ui.card.elevated, dialogSurfaceCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Dialog</p>
                    <h3 mix={[ui.card.title, surfaceHeadingCss]}>Share workspace</h3>
                    <p mix={ui.card.description}>
                      Invite teammates, choose a permission level, and keep the action area visually
                      distinct without making the panel feel heavy.
                    </p>
                  </div>

                  <div mix={ui.card.body}>
                    <label for="dialog-email" mix={[ui.text.label, fieldLabelCss]}>
                      Email
                    </label>
                    <input
                      id="dialog-email"
                      value="team@remix.dev"
                      readOnly
                      mix={[ui.field.base, fieldInputCss]}
                    />
                  </div>

                  <div mix={ui.card.footer}>
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
                  <div role="menu" aria-label="Project actions" mix={[ui.card.elevated, menuSurfaceCss]}>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Rename project
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Copy environment
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemCss]}>
                      Transfer ownership
                    </button>
                    <button type="button" role="menuitem" mix={[menuItemCss, menuItemDangerCss, ui.status.danger]}>
                      Archive project
                    </button>
                  </div>
                </div>

                <div mix={[ui.card.elevated, compactPanelCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Compact Menu Surface</p>
                    <h3 mix={ui.card.title}>Quick project snapshot</h3>
                  </div>
                  <div mix={ui.card.body}>
                    <div mix={[compactRowCss]}>
                      <span mix={[ui.text.eyebrow, compactKeyCss]}>Status</span>
                      <span mix={[statusBadgeCss, successBadgeCss, ui.status.success]}>Healthy</span>
                    </div>
                    <div mix={[compactRowCss]}>
                      <span mix={[ui.text.eyebrow, compactKeyCss]}>Deploys</span>
                      <span mix={[ui.text.bodySm, compactValueCss]}>12 this week</span>
                    </div>
                    <div mix={[compactRowCss]}>
                      <span mix={[ui.text.eyebrow, compactKeyCss]}>Owner</span>
                      <span mix={[ui.text.bodySm, compactValueCss]}>Platform team</span>
                    </div>
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
                <article mix={[ui.card.base, articleCardCss]}>
                  <div mix={[ui.card.headerWithAction]}>
                    <div mix={ui.card.header}>
                      <p mix={ui.card.eyebrow}>Team Notes</p>
                      <h3 mix={[ui.card.title, articleTitleCss]}>
                        Release checklist for the next deployment
                      </h3>
                      <p mix={[ui.card.description, articleParagraphCss]}>
                        Keep headings firm, body copy readable, and supporting notes visually secondary.
                        The goal is to make operational content easy to scan, not decorative.
                      </p>
                    </div>
                    <span mix={[ui.card.action, statusBadgeCss, ui.status.info]}>Draft</span>
                  </div>

                  <div mix={ui.card.body}>
                    <ul mix={[articleListCss]}>
                      <li>Verify background jobs are paused before the schema migration.</li>
                      <li>Run the smoke suite against staging after the first deploy finishes.</li>
                      <li>Notify support once cache warming completes.</li>
                    </ul>
                  </div>

                  <div mix={ui.card.footer}>
                    <p mix={[ui.text.caption, cardFooterMetaCss]}>Updated 18 minutes ago</p>
                    <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                      Open runbook
                    </button>
                  </div>
                </article>

                <section mix={[ui.card.base, articleCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Reading Rhythm</p>
                    <h3 mix={[ui.card.title, articleTitleCss]}>Default copy settings</h3>
                    <p mix={[ui.card.description, articleParagraphCss]}>
                      RMX_01 uses modest font sizes and balanced line heights so the same theme can
                      support dense tool UIs, forms, command surfaces, and longer settings content.
                    </p>
                  </div>

                  <div mix={ui.card.body}>
                    <div mix={[calloutCss, calloutWarningCss, ui.status.warning, inlineCalloutCss]}>
                      <p mix={[ui.text.label, calloutTitleCss]}>Guideline</p>
                      <p mix={[ui.text.bodySm, calloutBodyCss]}>
                        Reserve brighter colors for actions, statuses, and focus affordances instead
                        of general layout chrome.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </Section>

            <Section
              id="system"
              title="System Recipes"
              description="The demo also shows the semantic primitives directly so first-party components and app code can share the same design language."
            >
              <div mix={[systemGridCss]}>
                <article mix={[ui.card.base, systemCardCss, systemWideCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Type Roles</p>
                    <h3 mix={[ui.card.title, articleTitleCss]}>
                      A shared type vocabulary for application UI
                    </h3>
                    <p mix={[ui.card.description, articleParagraphCss]}>
                      Page roles can carry larger layout descriptions, while surface roles stay tighter
                      and calmer inside cards, dialogs, and menus.
                    </p>
                  </div>
                  <div mix={[ui.card.body, typeSpecimenPanelCss]}>
                    <div mix={[typeSpecimenGroupCss]}>
                      <p mix={[ui.text.caption, specimenGroupLabelCss]}>Page Roles</p>
                      <div mix={[typeSpecimenCss]}>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Eyebrow</p>
                          <p mix={[ui.text.eyebrow, sampleTextCss]}>Page eyebrow</p>
                        </div>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Title</p>
                          <p mix={[ui.text.title, sampleTextCss]}>Section title</p>
                        </div>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Body</p>
                          <p mix={[ui.text.bodySm, sampleTextCss]}>
                            Standard body copy for page-level descriptions and longer explanations.
                          </p>
                        </div>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Supporting</p>
                          <p mix={[ui.text.supporting, sampleTextCss]}>
                            Supporting text can back away further when needed.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div mix={[typeSpecimenGroupCss]}>
                      <p mix={[ui.text.caption, specimenGroupLabelCss]}>Utility Roles</p>
                      <div mix={[typeSpecimenCss]}>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Caption</p>
                          <p mix={[ui.text.caption, sampleTextCss]}>Caption text for compact metadata</p>
                        </div>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Code</p>
                          <code mix={[ui.text.code, codeSampleCss]}>theme.colors.background.surface</code>
                        </div>
                        <div mix={[specimenRowCss]}>
                          <p mix={[ui.text.caption, specimenLabelCss]}>Surface text</p>
                          <p mix={[ui.surfaceText.supporting, sampleTextCss]}>
                            Surface roles stay quieter inside dense UI.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article mix={[ui.card.base, systemCardCss]}>
                  <div mix={[ui.card.headerWithAction]}>
                    <div mix={ui.card.header}>
                      <p mix={ui.card.eyebrow}>Field System</p>
                      <h3 mix={[ui.card.title, articleTitleCss]}>Controls, labels, and help text</h3>
                      <p mix={[ui.card.description, articleParagraphCss]}>
                        Fields should not invent their own typography. Labels and help copy belong to the
                        same shared system.
                      </p>
                    </div>
                    <button type="button" mix={[buttonBaseCss, ui.button.secondary, ui.card.action]}>
                      Edit
                    </button>
                  </div>

                  <div mix={ui.card.body}>
                    <div mix={[fieldShowcaseCss]}>
                      <label for="system-project-name" mix={[ui.fieldText.label, fieldLabelCss]}>
                        Project name
                      </label>
                      <input
                        id="system-project-name"
                        value="RMX Internal Console"
                        readOnly
                        mix={[ui.field.base, fieldInputCss]}
                      />
                      <p mix={[ui.fieldText.help, fieldHelpCss]}>
                        Visible to collaborators in navigation, notifications, and audit events.
                      </p>
                    </div>
                  </div>
                </article>

                <article mix={[ui.card.elevated, systemCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Item Rows</p>
                    <h3 mix={[ui.card.title, articleTitleCss]}>Reusable primitives for menus and lists</h3>
                    <p mix={[ui.card.description, articleParagraphCss]}>
                      Item rows are meant to scale into tabs, combobox options, command lists, and sidebars.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <button type="button" mix={[ui.item.base, itemPreviewCss]}>
                      <span>General settings</span>
                      <span mix={[ui.text.caption, itemMetaCss]}>⌘,</span>
                    </button>
                    <button type="button" mix={[ui.item.base, ui.item.selected, itemPreviewCss]}>
                      <span>Members</span>
                      <span mix={[statusBadgeCss, successBadgeCss, ui.status.success]}>12 online</span>
                    </button>
                    <button type="button" mix={[ui.item.base, ui.item.danger, itemPreviewCss]}>
                      <span>Archive workspace</span>
                      <span mix={[ui.text.caption, itemMetaCss]}>Permanent</span>
                    </button>
                  </div>
                </article>

                <article mix={[ui.card.base, systemCardCss, systemWideCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Statuses and Utilities</p>
                    <h3 mix={[ui.card.title, articleTitleCss]}>Tone and low-level composition</h3>
                    <p mix={[ui.card.description, articleParagraphCss]}>
                      Semantic status recipes and lower-level utility mixins can work together in app code.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <div mix={[statusStackCss]}>
                    <div mix={[calloutCss, ui.status.info]}>
                      <p mix={[ui.text.label, calloutTitleCss]}>Info</p>
                      <p mix={[ui.text.bodySm, calloutBodyCss]}>Queues are processing normally.</p>
                    </div>
                    <div mix={[calloutCss, ui.status.success]}>
                      <p mix={[ui.text.label, calloutTitleCss]}>Success</p>
                      <p mix={[ui.text.bodySm, calloutBodyCss]}>Deploy completed in 42 seconds.</p>
                    </div>
                    </div>
                    <div mix={[utilityRowCss]}>
                      <div mix={[ui.p.sm, ui.rounded.lg, ui.shadow.xs, ui.bg.surfaceSecondary, utilityChipCss]}>
                        <code mix={[ui.text.code, utilityCodeCss]}>ui.p.sm</code>
                      </div>
                      <div mix={[ui.p.sm, ui.rounded.full, ui.bg.inset, utilityChipCss]}>
                        <code mix={[ui.text.code, utilityCodeCss]}>ui.rounded.full</code>
                      </div>
                      <div mix={[ui.p.sm, ui.rounded.md, ui.borderColor.default, utilityOutlineCss]}>
                        <code mix={[ui.text.code, utilityCodeCss]}>ui.borderColor.default</code>
                      </div>
                    </div>
                  </div>
                </article>
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
        <h2 mix={[ui.text.title, sectionTitleCss]}>{title}</h2>
        <p mix={[ui.text.body, sectionDescriptionCss]}>{description}</p>
      </div>
      {children}
    </section>
  )
}

type CardProps = {
  title: string
  body: string
  tone: ThemeUtility
  mixins?: ThemeUtility[]
}

function Card() {
  return ({ title, body, tone, mixins = [] }: CardProps) => (
    <article mix={[tone, ...mixins]}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Surface</p>
        <h3 mix={[ui.card.title, surfaceHeadingCss]}>{title}</h3>
        <p mix={ui.card.description}>{body}</p>
      </div>
    </article>
  )
}

let bodyCss = css({
  margin: 0,
  backgroundColor: theme.colors.background.canvas,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
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
  fontWeight: theme.fontWeight.bold,
})

let sidebarBodyCss = css({
  margin: 0,
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
  fontFamily: theme.fontFamily.sans,
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
  borderRadius: theme.radius.xl,
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
})

let heroBodyCss = css({
  margin: 0,
  maxWidth: '62ch',
})

let heroActionsCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let eyebrowCss = css({ margin: 0 })

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
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
})

let sectionDescriptionCss = css({
  margin: 0,
  maxWidth: '70ch',
})

let buttonBaseCss = ui.control.base
let quietButtonCss = ui.control.quiet

let buttonPanelCss = css({
  minHeight: '0',
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

let surfaceCardCss = css({ minHeight: '168px' })
let surfaceSecondaryCardCss = css({ minHeight: '168px' })
let surfaceElevatedCardCss = css({ minHeight: '168px' })
let surfaceInsetCardCss = css({ minHeight: '168px' })

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
  borderRadius: theme.radius.xl,
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
})

let compactPanelCss = css({
  gap: theme.space.sm,
  padding: theme.space.md,
})

let menuItemCss = css({
  width: '100%',
  minHeight: theme.control.height.sm,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: '1px solid transparent',
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.colors.background.surfaceSecondary,
  },
})

let menuItemDangerCss = css({
  borderColor: theme.colors.status.danger.border,
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
  margin: 0,
})

let fieldInputCss = css({})

let surfaceHeadingCss = css({
  margin: 0,
  maxWidth: '18ch',
})

let compactRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  minHeight: '28px',
})

let compactKeyCss = css({
  margin: 0,
})

let compactValueCss = css({ margin: 0 })

let statusBadgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '22px',
  paddingInline: theme.space.sm,
  border: '1px solid transparent',
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

let successBadgeCss = css({})

let contentGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr',
  gap: theme.space.md,
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let systemGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.md,
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
  },
})

let systemCardCss = css({
  minHeight: '240px',
})

let systemWideCardCss = css({
  gridColumn: '1 / -1',
  minHeight: '0',
})

let articleCardCss = css({
  minHeight: '0',
})

let articleTitleCss = css({
  margin: 0,
})

let articleParagraphCss = css({
  maxWidth: '50ch',
})

let cardFooterMetaCss = css({
  margin: 0,
  marginRight: 'auto',
})

let sampleTextCss = css({
  margin: 0,
})

let typeSpecimenPanelCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.md,
  paddingTop: theme.space.sm,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
})

let typeSpecimenGroupCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let specimenGroupLabelCss = css({
  margin: 0,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
})

let typeSpecimenCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let specimenRowCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
})

let specimenLabelCss = css({
  margin: 0,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let codeSampleCss = css({
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.inset,
})

let articleListCss = css({
  margin: 0,
  paddingLeft: theme.space.lg,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
  '& li + li': {
    marginTop: theme.space.sm,
  },
})

let calloutCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.md,
  borderRadius: theme.radius.lg,
  border: '1px solid transparent',
})

let calloutInfoCss = ui.status.info
let calloutWarningCss = css({})
let inlineCalloutCss = css({
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundColor: 'color-mix(in oklab, rgb(255 246 228) 34%, white)',
  borderColor: 'color-mix(in oklab, rgb(241 211 146) 58%, white)',
  boxShadow: 'none',
})

let calloutTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
})

let calloutBodyCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
})

let fieldShowcaseCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let fieldHelpCss = css({
  margin: 0,
})

let itemPreviewCss = css({
  cursor: 'pointer',
})

let itemMetaCss = css({
  flexShrink: 0,
})

let statusStackCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.sm,
  '@media (max-width: 680px)': {
    gridTemplateColumns: '1fr',
  },
})

let utilityRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let utilityChipCss = css({
  display: 'inline-flex',
  alignItems: 'center',
})

let utilityOutlineCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: theme.radius.md,
})

let utilityCodeCss = css({
  whiteSpace: 'nowrap',
})

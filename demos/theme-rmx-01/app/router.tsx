import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createRouter } from 'remix/fetch-router'
import { logger } from 'remix/logger-middleware'
import { RMX_01, RMX_01_VALUES, theme, ui } from '@remix-run/theme'
import type { ThemeUtility } from '@remix-run/theme'

type PageDefinition = {
  description: string
  eyebrow: string
  id: string
  navLabel: string
  path: string
  title: string
}

type NavGroupDefinition = {
  label: string
  pages: PageDefinition[]
}

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

let PAGES = {
  overview: {
    id: 'overview',
    path: '/',
    navLabel: 'Overview',
    eyebrow: 'Design System',
    title: 'RMX design system explorer',
    description:
      'The demo now shows the design system itself: theme values, semantic recipes, layout primitives, and the current default theme preset.',
  },
  proofSheet: {
    id: 'proof-sheet',
    path: '/proof-sheet',
    navLabel: 'Proof Sheet',
    eyebrow: 'Theme Proof Sheet',
    title: 'RMX_01 in a realistic application frame',
    description:
      'A compact fake product view for quickly judging typography, hierarchy, controls, surfaces, and overall tone when evaluating a theme.',
  },
  themeValues: {
    id: 'theme-values',
    path: '/theme-values',
    navLabel: 'Theme Values',
    eyebrow: 'Theme Contract',
    title: 'Typed theme values backed by CSS custom properties',
    description:
      'Apps and first-party components both read from the same variable contract, while themes provide the concrete values rendered into CSS.',
  },
  uiRecipes: {
    id: 'ui-recipes',
    path: '/ui-recipes',
    navLabel: 'UI Recipes',
    eyebrow: 'Semantic Recipes',
    title: 'Composable ui recipes above the token layer',
    description:
      'The `ui` surface turns raw variables into reusable styling primitives for text, cards, controls, fields, navigation, and status treatments.',
  },
  components: {
    id: 'components',
    path: '/components',
    navLabel: 'Components',
    eyebrow: 'Component Layer',
    title: 'Component ergonomics should sit on top of shared recipes',
    description:
      'The eventual first-party component library should feel thin and consistent because shared styling lives in the theme contract and `ui` recipes.',
  },
  layouts: {
    id: 'layouts',
    path: '/layouts',
    navLabel: 'Layouts',
    eyebrow: 'Layout Primitives',
    title: 'Sidebar and navigation patterns for application shells',
    description:
      'The docs shell here is demo-specific, but the sidebar, nav, and panel ingredients are useful application-level primitives worth carrying forward.',
  },
} as const satisfies Record<string, PageDefinition>

let NAV_GROUPS: NavGroupDefinition[] = [
  {
    label: 'Themes',
    pages: [PAGES.overview, PAGES.proofSheet],
  },
  {
    label: 'API',
    pages: [PAGES.themeValues, PAGES.uiRecipes, PAGES.components, PAGES.layouts],
  },
]

export let router = createRouter({ middleware })

router.get('/', createPageHandler(PAGES.overview))
router.get('/proof-sheet', createPageHandler(PAGES.proofSheet))
router.get('/theme-values', createPageHandler(PAGES.themeValues))
router.get('/ui-recipes', createPageHandler(PAGES.uiRecipes))
router.get('/components', createPageHandler(PAGES.components))
router.get('/layouts', createPageHandler(PAGES.layouts))

function createPageHandler(page: PageDefinition) {
  return async () => {
    let stream = renderToStream(<Document page={page} />, {
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
  }
}

function Document() {
  return ({ page }: { page: PageDefinition }) => (
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
        <title>{`${page.title} | RMX_01 Design System`}</title>
        <RMX_01 />
      </head>
      <body mix={bodyCss}>
        <div mix={appShellCss}>
          <aside mix={sidebarFrameCss}>
            <div mix={sidebarStickyCss}>
              <Sidebar currentPath={page.path} />
            </div>
          </aside>

          <main mix={mainCss}>
            <div mix={pageStackCss}>
              <PageHeader page={page} />
              <PageContent page={page} />
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
      {NAV_GROUPS.map(group => (
        <section key={group.label} mix={ui.sidebar.section}>
          <p mix={ui.sidebar.heading}>{group.label}</p>
          <nav aria-label={group.label} mix={ui.nav.list}>
            {group.pages.map(page => (
              <a
                key={page.path}
                href={page.path}
                aria-current={currentPath === page.path ? 'page' : undefined}
                mix={getNavItemMix(page.path, currentPath)}
              >
                {page.navLabel}
              </a>
            ))}
          </nav>
        </section>
      ))}

      <section mix={[calloutCss, calloutInfoCss]}>
        <p mix={[ui.text.label, calloutTitleCss]}>Why this structure?</p>
        <p mix={[ui.text.bodySm, calloutBodyCss]}>
          The demo is now documenting the whole system, while RMX_01 is simply the currently selected
          default theme.
        </p>
      </section>
    </div>
  )
}

function PageHeader() {
  return ({ page }: { page: PageDefinition }) => (
    <header mix={[ui.card.base, pageHeaderCss]}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>{page.eyebrow}</p>
        <h2 mix={[ui.text.display, pageTitleCss]}>{page.title}</h2>
        <p mix={[ui.text.body, pageDescriptionCss]}>{page.description}</p>
      </div>
    </header>
  )
}

function PageContent() {
  return ({ page }: { page: PageDefinition }) => {
    if (page.id === PAGES.overview.id) {
      return <OverviewPage />
    }

    if (page.id === PAGES.proofSheet.id) {
      return <ProofSheetPage />
    }

    if (page.id === PAGES.themeValues.id) {
      return <ThemeValuesPage />
    }

    if (page.id === PAGES.uiRecipes.id) {
      return <UiRecipesPage />
    }

    if (page.id === PAGES.components.id) {
      return <ComponentsPage />
    }

    return <LayoutsPage />
  }
}

function OverviewPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="System model"
        description="The design system now has three layers that should stay in sync: raw theme values, semantic ui recipes, and thin component ergonomics built on top."
      >
        <div mix={threeColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>1. Theme Values</p>
              <h3 mix={ui.card.title}>`theme` is the contract</h3>
              <p mix={ui.card.description}>
                Components and app code read `theme.*` variable references, while themes define the
                underlying CSS custom property values.
              </p>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>2. UI Recipes</p>
              <h3 mix={ui.card.title}>`ui` is the styling language</h3>
              <p mix={ui.card.description}>
                Recipes like `ui.button.primary`, `ui.card.base`, and `ui.nav.item` make composition
                fast without scattering one-off styling decisions through the app.
              </p>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>3. Components</p>
              <h3 mix={ui.card.title}>Built-ins should stay thin</h3>
              <p mix={ui.card.description}>
                First-party components can focus on markup, behavior, and ergonomics because their
                visual structure is already shared below them.
              </p>
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="What this explorer covers"
        description="The sidebar maps the design system itself, not just a single pretty page."
      >
        <div mix={twoColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Current pages</p>
              <h3 mix={ui.card.title}>A docs-style model for the system</h3>
              <p mix={ui.card.description}>
                Overview, proof sheet, theme values, ui recipes, components, and layouts are split into
                separate pages so each part can grow without turning the demo into one giant scroll.
              </p>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>Overview explains the architecture.</li>
                <li>Proof sheet shows the feel of a theme in context.</li>
                <li>API pages show the contract and recipe surface.</li>
              </ul>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Next obvious steps</p>
              <h3 mix={ui.card.title}>This structure supports future tooling</h3>
              <p mix={ui.card.description}>
                The explorer is now in a good place for a theme picker, a theme editor, route-level
                examples, and eventually real first-party component docs.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={stackSmCss}>
                <div mix={[calloutCss, calloutInfoCss]}>
                  <p mix={[ui.text.label, calloutTitleCss]}>Planned</p>
                  <p mix={[ui.text.bodySm, calloutBodyCss]}>
                    Switch between themes in the sidebar and use the proof sheet as the immediate
                    visual acceptance test.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

function ProofSheetPage() {
  return () => (
    <div id="proof-sheet" mix={pageSectionStackCss}>
      <Section
        title="Theme proof sheet"
        description="This page is intentionally closer to a fake product than a docs page. It should answer whether a theme feels right at a glance."
      >
        <div mix={[ui.card.base, proofAppShellCss]}>
          <div mix={proofToolbarCss}>
            <div mix={proofToolbarTitleCss}>
              <p mix={ui.text.eyebrow}>Workspace</p>
              <h3 mix={[ui.text.title, zeroMarginCss]}>Operations Console</h3>
            </div>
            <div mix={buttonRowCss}>
              <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                Export
              </button>
              <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                New release
              </button>
            </div>
          </div>

          <div mix={proofLayoutCss}>
            <aside mix={[ui.card.secondary, proofSidebarCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="Proof sheet app navigation" mix={ui.nav.list}>
                  <a href="/proof-sheet" aria-current="page" mix={[ui.nav.item, ui.nav.itemActive]}>
                    Overview
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    Deployments
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    Logs
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    Settings
                  </a>
                </nav>
              </div>

              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Environment</p>
                <div mix={stackSmCss}>
                  <div mix={compactRowCss}>
                    <span mix={ui.text.caption}>Status</span>
                    <span mix={[statusBadgeCss, ui.status.success]}>Healthy</span>
                  </div>
                  <div mix={compactRowCss}>
                    <span mix={ui.text.caption}>Version</span>
                    <span mix={ui.text.bodySm}>v0.19.4</span>
                  </div>
                  <div mix={compactRowCss}>
                    <span mix={ui.text.caption}>Owner</span>
                    <span mix={ui.text.bodySm}>Platform team</span>
                  </div>
                </div>
              </div>
            </aside>

            <div mix={proofMainCss}>
              <div mix={proofStatsGridCss}>
                <MetricCard
                  badge="Stable"
                  metric="99.97%"
                  tone={ui.card.base}
                  title="Availability"
                  value="Healthy week-over-week"
                  dataId="primary"
                />
                <MetricCard
                  badge="12"
                  metric="Deploys"
                  tone={ui.card.base}
                  title="This week"
                  value="Consistent release cadence"
                />
                <MetricCard
                  badge="4m"
                  metric="Review"
                  tone={ui.card.base}
                  title="Average rollback window"
                  value="Fast enough for routine shipping"
                />
                <MetricCard
                  badge="2"
                  metric="Alerts"
                  tone={ui.card.secondary}
                  title="Open incidents"
                  value="Low but visible attention needed"
                />
              </div>

              <div mix={proofContentGridCss}>
                <article mix={[ui.card.base, proofWideCardCss]}>
                  <div mix={[ui.card.headerWithAction]}>
                    <div mix={ui.card.header}>
                      <p mix={ui.card.eyebrow}>Release checklist</p>
                      <h3 mix={ui.card.title}>Readability under operational pressure</h3>
                      <p mix={ui.card.description}>
                        The proof sheet should reveal whether dense task-oriented surfaces still feel
                        calm, legible, and trustworthy.
                      </p>
                    </div>
                    <span mix={[ui.card.action, statusBadgeCss, ui.status.info]}>Draft</span>
                  </div>
                  <div mix={ui.card.body}>
                    <ul mix={bulletListCss}>
                      <li>Verify migrations are locked before the deploy starts.</li>
                      <li>Hold background workers for the first rollout window.</li>
                      <li>Run smoke tests before enabling the scheduled queue.</li>
                    </ul>
                  </div>
                  <div mix={ui.card.footer}>
                    <p mix={[ui.text.caption, metaTextCss]}>Updated 18 minutes ago</p>
                    <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                      Open runbook
                    </button>
                  </div>
                </article>

                <article mix={[ui.card.elevated, proofNarrowCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Quick action</p>
                    <h3 mix={ui.card.title}>Invite collaborator</h3>
                    <p mix={ui.card.description}>
                      Fields, labels, and actions should remain compact without feeling cramped.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <label for="proof-email" mix={ui.fieldText.label}>
                      Email
                    </label>
                    <input
                      id="proof-email"
                      readOnly
                      value="team@remix.dev"
                      mix={[ui.field.base, proofInputCss]}
                    />
                    <p mix={ui.fieldText.help}>Editors can ship changes but cannot manage billing.</p>
                  </div>
                  <div mix={ui.card.footer}>
                    <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                      Cancel
                    </button>
                    <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                      Send invite
                    </button>
                  </div>
                </article>

                <article mix={[ui.card.base, proofWideCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Recent activity</p>
                    <h3 mix={ui.card.title}>A table-like content area without heavy chrome</h3>
                    <p mix={ui.card.description}>
                      Utility apps need lists and rows to be quiet, aligned, and easy to scan.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <div mix={rowTableCss}>
                      {[
                        ['Deploy preview', '2 minutes ago', 'Success'],
                        ['Cache warmup', '13 minutes ago', 'Running'],
                        ['Customer import', '26 minutes ago', 'Queued'],
                      ].map(([label, time, status]) => (
                        <div key={label} mix={rowTableItemCss}>
                          <div mix={stackXsCss}>
                            <p mix={[ui.text.bodySm, zeroMarginCss]}>{label}</p>
                            <p mix={[ui.text.caption, zeroMarginCss]}>{time}</p>
                          </div>
                          <span mix={[statusBadgeCss, getStatusMix(status)]}>{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article mix={[ui.card.base, proofNarrowCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Menu surface</p>
                    <h3 mix={ui.card.title}>Floating panels should stay related to the system</h3>
                  </div>
                  <div mix={ui.card.body}>
                    <div role="menu" aria-label="Project actions" mix={[ui.card.elevated, proofMenuCss]}>
                      <button type="button" role="menuitem" mix={menuItemCss}>
                        Rename project
                      </button>
                      <button type="button" role="menuitem" mix={menuItemCss}>
                        Copy environment
                      </button>
                      <button type="button" role="menuitem" mix={[menuItemCss, menuItemDangerCss, ui.status.danger]}>
                        Archive project
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

function ThemeValuesPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Core contract"
        description="The contract is the stable API. Themes provide the values, but app code and first-party components always consume `theme.*` variable references."
      >
        <div mix={twoColumnGridCss}>
          <TokenGroupCard
            code="theme.space.md"
            rows={[
              ['xs', String(RMX_01_VALUES.space.xs)],
              ['sm', String(RMX_01_VALUES.space.sm)],
              ['md', String(RMX_01_VALUES.space.md)],
              ['lg', String(RMX_01_VALUES.space.lg)],
            ]}
            title="Space scale"
          />
          <TokenGroupCard
            code="theme.radius.lg"
            rows={[
              ['sm', String(RMX_01_VALUES.radius.sm)],
              ['md', String(RMX_01_VALUES.radius.md)],
              ['lg', String(RMX_01_VALUES.radius.lg)],
              ['full', String(RMX_01_VALUES.radius.full)],
            ]}
            title="Radius scale"
          />
          <TokenGroupCard
            code="theme.fontSize.sm"
            rows={[
              ['3xs', String(RMX_01_VALUES.fontSize['3xs'])],
              ['xs', String(RMX_01_VALUES.fontSize.xs)],
              ['md', String(RMX_01_VALUES.fontSize.md)],
              ['2xl', String(RMX_01_VALUES.fontSize['2xl'])],
            ]}
            title="Typography sizes"
          />
          <TokenGroupCard
            code="theme.shadow.md"
            rows={[
              ['xs', String(RMX_01_VALUES.shadow.xs)],
              ['sm', String(RMX_01_VALUES.shadow.sm)],
              ['md', String(RMX_01_VALUES.shadow.md)],
              ['lg', String(RMX_01_VALUES.shadow.lg)],
            ]}
            title="Shadows and elevation"
          />
        </div>
      </Section>

      <Section
        title="Semantic color roles"
        description="The system distinguishes content, surfaces, borders, actions, and statuses so components can read the right semantic value rather than inventing their own colors."
      >
        <div mix={threeColumnGridCss}>
          <ColorRoleCard
            role="Surface stack"
            swatches={[
              ['Canvas', String(RMX_01_VALUES.colors.background.canvas)],
              ['Surface', String(RMX_01_VALUES.colors.background.surface)],
              ['Secondary', String(RMX_01_VALUES.colors.background.surfaceSecondary)],
              ['Inset', String(RMX_01_VALUES.colors.background.inset)],
            ]}
          />
          <ColorRoleCard
            role="Text stack"
            swatches={[
              ['Primary', String(RMX_01_VALUES.colors.text.primary)],
              ['Secondary', String(RMX_01_VALUES.colors.text.secondary)],
              ['Muted', String(RMX_01_VALUES.colors.text.muted)],
              ['Link', String(RMX_01_VALUES.colors.text.link)],
            ]}
          />
          <ColorRoleCard
            role="Action and status"
            swatches={[
              ['Primary', String(RMX_01_VALUES.colors.action.primary.background)],
              ['Danger', String(RMX_01_VALUES.colors.action.danger.background)],
              ['Info', String(RMX_01_VALUES.colors.status.info.background)],
              ['Success', String(RMX_01_VALUES.colors.status.success.background)],
            ]}
          />
        </div>
      </Section>

      <Section
        title="Authoring model"
        description="This is the contract the app and library code share. The actual component styling never needs JS-resolved values, only CSS variable references."
      >
        <article mix={ui.card.base}>
          <div mix={ui.card.header}>
            <p mix={ui.card.eyebrow}>Example</p>
            <h3 mix={ui.card.title}>Theme values render into CSS custom properties</h3>
          </div>
          <div mix={ui.card.body}>
            <pre mix={codeBlockCss}>
              <code>{`let Theme = createTheme({
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
  },
  colors: {
    action: {
      primary: {
        background: "#3561cf",
        foreground: "rgb(255 255 255 / 0.92)",
      },
    },
  },
})`}</code>
            </pre>
            <pre mix={codeBlockCss}>
              <code>{`:root {
  --rmx-space-md: 12px;
  --rmx-color-action-primary-background: #3561cf;
}`}</code>
            </pre>
          </div>
        </article>
      </Section>
    </div>
  )
}

function UiRecipesPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Recipe families"
        description="Recipes are where the design system becomes practical. They should absorb recurring layout and typography decisions so app code composes instead of restyling."
      >
        <div mix={twoColumnGridCss}>
          <RecipeFamilyCard
            code="ui.text.*"
            description="Page-level typography roles for headings, body copy, captions, and metadata."
            title="Text roles"
          >
            <p mix={ui.text.eyebrow}>Page eyebrow</p>
            <p mix={ui.text.title}>Section title</p>
            <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
          </RecipeFamilyCard>

          <RecipeFamilyCard
            code="ui.card.*"
            description="Shared shell, spacing, and slot rhythm for cards, popovers, and content panels."
            title="Card recipes"
          >
            <div mix={ui.card.base}>
              <div mix={ui.card.header}>
                <p mix={ui.card.eyebrow}>Surface</p>
                <h4 mix={ui.card.title}>Card header</h4>
                <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
              </div>
            </div>
          </RecipeFamilyCard>

          <RecipeFamilyCard
            code="ui.button.*"
            description="Compact action treatments that stay cohesive across white, colored, and destructive states."
            title="Buttons and controls"
          >
            <div mix={buttonRowCss}>
              <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                Save
              </button>
              <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                Ghost
              </button>
              <button type="button" mix={[buttonBaseCss, ui.button.danger]}>
                Delete
              </button>
            </div>
          </RecipeFamilyCard>

          <RecipeFamilyCard
            code="ui.field.* / ui.fieldText.*"
            description="Field chrome and label/help typography should travel together."
            title="Fields"
          >
            <div mix={stackXsCss}>
              <label for="ui-recipe-field" mix={ui.fieldText.label}>
                Project name
              </label>
              <input id="ui-recipe-field" value="RMX Internal Console" readOnly mix={ui.field.base} />
              <p mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</p>
            </div>
          </RecipeFamilyCard>

          <RecipeFamilyCard
            code="ui.item.* / ui.status.*"
            description="List rows and status treatments underpin menus, comboboxes, command surfaces, and sidebars."
            title="Items and status"
          >
            <div mix={stackXsCss}>
              <button type="button" mix={ui.item.base}>
                <span>Members</span>
                <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
              </button>
              <button type="button" mix={[ui.item.base, ui.item.danger]}>
                <span>Archive workspace</span>
                <span mix={ui.text.caption}>Permanent</span>
              </button>
            </div>
          </RecipeFamilyCard>

          <RecipeFamilyCard
            code="ui.sidebar.* / ui.nav.*"
            description="Sidebar and navigation primitives are useful app-level building blocks even though this docs shell itself is demo-specific."
            title="Sidebar and nav"
          >
            <div mix={[ui.card.secondary, navPreviewCardCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="UI recipe nav preview" mix={ui.nav.list}>
                  <a href="/ui-recipes" aria-current="page" mix={[ui.nav.item, ui.nav.itemActive]}>
                    Current page
                  </a>
                  <a href="/ui-recipes" mix={ui.nav.item}>
                    Secondary page
                  </a>
                </nav>
              </div>
            </div>
          </RecipeFamilyCard>
        </div>
      </Section>

      <Section
        title="Low-level composition still matters"
        description="The recipe layer should not replace utility composition. It should sit above it and remove the most repetitive styling choices."
      >
        <article mix={ui.card.base}>
          <div mix={ui.card.header}>
            <p mix={ui.card.eyebrow}>Utilities</p>
            <h3 mix={ui.card.title}>Recipes and low-level utilities can coexist</h3>
          </div>
          <div mix={utilityRowCss}>
            <div mix={[ui.p.sm, ui.rounded.lg, ui.shadow.xs, ui.bg.surfaceSecondary, utilityChipCss]}>
              <code mix={ui.text.code}>ui.p.sm</code>
            </div>
            <div mix={[ui.p.sm, ui.rounded.full, ui.bg.inset, utilityChipCss]}>
              <code mix={ui.text.code}>ui.rounded.full</code>
            </div>
            <div mix={[ui.p.sm, ui.rounded.md, ui.borderColor.default, utilityOutlineCss]}>
              <code mix={ui.text.code}>ui.borderColor.default</code>
            </div>
          </div>
        </article>
      </Section>
    </div>
  )
}

function ComponentsPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Current component direction"
        description="Components should mostly be ergonomic shells around behavior and shared recipes rather than isolated style islands."
      >
        <div mix={threeColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Button</p>
              <h3 mix={ui.card.title}>A thin wrapper over control + tone</h3>
              <p mix={ui.card.description}>
                A button component can expose behavior and semantics while still leaning on
                `ui.control.base` and `ui.button.*`.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={buttonRowCss}>
                <button type="button" mix={[buttonBaseCss, ui.button.primary]}>
                  Primary
                </button>
                <button type="button" mix={[buttonBaseCss, ui.button.secondary]}>
                  Secondary
                </button>
              </div>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Card</p>
              <h3 mix={ui.card.title}>Likely a micro-layout helper</h3>
              <p mix={ui.card.description}>
                The most useful component-level value may be ergonomic card composition, while
                subparts like headers and footers stay as mixins instead of wrappers.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={[ui.card.secondary, componentPreviewCardCss]}>
                <div mix={ui.card.header}>
                  <p mix={ui.card.eyebrow}>Example</p>
                  <h4 mix={ui.card.title}>Small card composition</h4>
                </div>
              </div>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Popover shells</p>
              <h3 mix={ui.card.title}>Menus and dialogs should stay on-system</h3>
              <p mix={ui.card.description}>
                Floating layers should feel like related surfaces instead of separate aesthetic worlds.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={[ui.card.elevated, componentPreviewCardCss]}>
                <button type="button" mix={menuItemCss}>
                  Rename project
                </button>
                <button type="button" mix={menuItemCss}>
                  Copy environment
                </button>
              </div>
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="Planned first-party surface area"
        description="The component library should eventually cover the usual app primitives, but the visual language should still come from shared recipes and theme values."
      >
        <div mix={twoColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>High-confidence early wins</p>
              <h3 mix={ui.card.title}>Start with components that prove the shared system</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>Button and button group</li>
                <li>Card and surface shells</li>
                <li>Dialog, popover, dropdown menu, tooltip</li>
                <li>Tabs, combobox, command, select</li>
                <li>Field, input, textarea, checkbox, switch, radio group</li>
              </ul>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Longer-term library</p>
              <h3 mix={ui.card.title}>The broader shadcn-style surface area can follow</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>Calendar, date picker, chart, data table</li>
                <li>Drawer, sheet, sidebar, navigation menu, menubar</li>
                <li>Toast, sonner, spinner, progress, skeleton</li>
                <li>Carousel, resizable, scroll area, pagination</li>
                <li>Table, badge, breadcrumb, avatar, separator</li>
              </ul>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

function LayoutsPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Demo shell vs reusable layout ingredients"
        description="The docs shell here is not the package abstraction. What should travel into the system are the reusable parts like sidebar panels, nav items, carded rails, and content rhythm."
      >
        <div mix={twoColumnGridCss}>
          <article mix={[ui.card.base, layoutPreviewShellCss]}>
            <div mix={layoutPreviewSidebarCss}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Account</p>
                <nav aria-label="Settings sidebar" mix={ui.nav.list}>
                  <a href="/layouts" aria-current="page" mix={[ui.nav.item, ui.nav.itemActive]}>
                    Profile
                  </a>
                  <a href="/layouts" mix={ui.nav.item}>
                    Members
                  </a>
                  <a href="/layouts" mix={ui.nav.item}>
                    Billing
                  </a>
                </nav>
              </div>
            </div>
            <div mix={layoutPreviewMainCss}>
              <div mix={[ui.card.secondary, componentPreviewCardCss]}>
                <div mix={ui.card.header}>
                  <p mix={ui.card.eyebrow}>Settings layout</p>
                  <h3 mix={ui.card.title}>Sticky side navigation + flexible main rail</h3>
                  <p mix={ui.card.description}>
                    A common app shell pattern that should be easy to build from shared sidebar and card
                    primitives.
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>What belongs in the package</p>
              <h3 mix={ui.card.title}>Reusable primitives, not demo-specific wrappers</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>`ui.sidebar.*` for panel rhythm and section labeling</li>
                <li>`ui.nav.*` for compact application navigation items</li>
                <li>`ui.card.*` for content rails and side panels</li>
                <li>Demo-specific docs shell composition stays local to the docs app</li>
              </ul>
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="Why layouts matter here"
        description="As the component library grows, app shells and settings-style layouts become one of the best places to prove that the design system feels cohesive in real use."
      >
        <article mix={ui.card.base}>
          <div mix={ui.card.header}>
            <p mix={ui.card.eyebrow}>Current takeaway</p>
            <h3 mix={ui.card.title}>The layout layer is where system quality becomes obvious</h3>
            <p mix={ui.card.description}>
              If nav, cards, typography, buttons, and fields all feel like they belong together inside
              a practical app shell, the rest of the library gets easier to trust.
            </p>
          </div>
        </article>
      </Section>
    </div>
  )
}

function Section() {
  return ({
    children,
    description,
    title,
  }: {
    children: RemixNode
    description: string
    title: string
  }) => (
    <section mix={sectionCss}>
      <div mix={sectionHeaderCss}>
        <h2 mix={[ui.text.title, sectionTitleCss]}>{title}</h2>
        <p mix={[ui.text.body, sectionDescriptionCss]}>{description}</p>
      </div>
      {children}
    </section>
  )
}

function TokenGroupCard() {
  return ({
    code,
    rows,
    title,
  }: {
    code: string
    rows: Array<[string, string]>
    title: string
  }) => (
    <article mix={ui.card.base}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Value group</p>
        <h3 mix={ui.card.title}>{title}</h3>
      </div>
      <div mix={ui.card.body}>
        <code mix={[ui.text.code, inlineCodeCss]}>{code}</code>
        <div mix={tokenListCss}>
          {rows.map(([label, value]) => (
            <div key={label} mix={tokenRowCss}>
              <span mix={ui.text.caption}>{label}</span>
              <code mix={ui.text.code}>{value}</code>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function ColorRoleCard() {
  return ({
    role,
    swatches,
  }: {
    role: string
    swatches: Array<[string, string]>
  }) => (
    <article mix={ui.card.base}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Color role</p>
        <h3 mix={ui.card.title}>{role}</h3>
      </div>
      <div mix={ui.card.body}>
        {swatches.map(([label, value]) => (
          <div key={label} mix={swatchRowCss}>
            <div mix={swatchMetaCss}>
              <span mix={ui.text.caption}>{label}</span>
              <code mix={ui.text.code}>{value}</code>
            </div>
            <span mix={[swatchCss, css({ backgroundColor: value })]} />
          </div>
        ))}
      </div>
    </article>
  )
}

function RecipeFamilyCard() {
  return ({
    children,
    code,
    description,
    title,
  }: {
    children: RemixNode
    code: string
    description: string
    title: string
  }) => (
    <article mix={ui.card.base}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Recipe family</p>
        <h3 mix={ui.card.title}>{title}</h3>
        <p mix={ui.card.description}>{description}</p>
      </div>
      <div mix={ui.card.body}>
        <code mix={[ui.text.code, inlineCodeCss]}>{code}</code>
        {children}
      </div>
    </article>
  )
}

function MetricCard() {
  return ({
    badge,
    dataId,
    metric,
    title,
    tone,
    value,
  }: {
    badge: string
    dataId?: string
    metric: string
    title: string
    tone: ThemeUtility
    value: string
  }) => (
    <article data-proof-card={dataId} mix={[tone, metricCardCss]}>
      <div mix={metricBadgeRowCss}>
        <span mix={[statusBadgeCss, ui.status.info]}>{badge}</span>
        <span mix={ui.text.caption}>{metric}</span>
      </div>
      <div mix={ui.card.header}>
        <h3 mix={[ui.card.title, zeroMarginCss]}>{title}</h3>
        <p mix={[ui.card.description, zeroTopMarginCss]}>{value}</p>
      </div>
    </article>
  )
}

function getNavItemMix(path: string, currentPath: string) {
  return currentPath === path ? [ui.nav.item, ui.nav.itemActive] : [ui.nav.item]
}

function getStatusMix(label: string) {
  if (label === 'Success') {
    return ui.status.success
  }

  if (label === 'Running') {
    return ui.status.info
  }

  return ui.status.warning
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
  gridTemplateColumns: '304px minmax(0, 1fr)',
  background:
    'linear-gradient(to bottom, color-mix(in oklab, rgb(246 246 246) 72%, white) 0%, white 18%)',
  '@media (max-width: 960px)': {
    gridTemplateColumns: '1fr',
  },
})

let sidebarFrameCss = css({
  backgroundColor: theme.colors.background.inset,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 960px)': {
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
  boxSizing: 'border-box',
  '@media (max-width: 960px)': {
    position: 'static',
    height: 'auto',
    overflowY: 'visible',
  },
})

let mainCss = css({
  minWidth: 0,
  padding: theme.space['2xl'],
  '@media (max-width: 960px)': {
    padding: theme.space.xl,
  },
})

let pageStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xl,
  maxWidth: '1180px',
})

let pageHeaderCss = css({
  padding: theme.space.xl,
})

let pageTitleCss = css({
  margin: 0,
  fontSize: 'clamp(28px, 3vw, 36px)',
  maxWidth: '18ch',
})

let pageDescriptionCss = css({
  margin: 0,
  maxWidth: '68ch',
})

let pageSectionStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xl,
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
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
})

let sectionDescriptionCss = css({
  margin: 0,
  maxWidth: '72ch',
})

let threeColumnGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.md,
  '@media (max-width: 1080px)': {
    gridTemplateColumns: '1fr',
  },
})

let twoColumnGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.md,
  '@media (max-width: 920px)': {
    gridTemplateColumns: '1fr',
  },
})

let bulletListCss = css({
  margin: 0,
  paddingLeft: theme.space.lg,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
  '& li + li': {
    marginTop: theme.space.sm,
  },
})

let stackSmCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let stackXsCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
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

let calloutTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
})

let calloutBodyCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
})

let proofAppShellCss = css({
  gap: theme.space.lg,
  padding: theme.space.lg,
})

let proofToolbarCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  paddingBottom: theme.space.md,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 720px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

let proofToolbarTitleCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let proofLayoutCss = css({
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: theme.space.md,
  '@media (max-width: 920px)': {
    gridTemplateColumns: '1fr',
  },
})

let proofSidebarCss = css({
  alignSelf: 'start',
  gap: theme.space.md,
  padding: theme.space.md,
})

let proofMainCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  minWidth: 0,
})

let proofStatsGridCss = css({
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

let metricCardCss = css({
  minHeight: '136px',
})

let metricBadgeRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
})

let proofContentGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr',
  gap: theme.space.md,
  '@media (max-width: 1080px)': {
    gridTemplateColumns: '1fr',
  },
})

let proofWideCardCss = css({
  minHeight: '0',
})

let proofNarrowCardCss = css({
  minHeight: '0',
})

let proofInputCss = css({
  width: '100%',
  boxSizing: 'border-box',
})

let proofMenuCss = css({
  gap: theme.space.xs,
  padding: theme.space.sm,
})

let rowTableCss = css({
  display: 'flex',
  flexDirection: 'column',
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

let rowTableItemCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: `${theme.space.sm} 0`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

let buttonBaseCss = ui.control.base

let buttonRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
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
})

let compactRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  minHeight: theme.control.height.sm,
})

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

let metaTextCss = css({
  margin: 0,
  marginRight: 'auto',
})

let zeroMarginCss = css({ margin: 0 })
let zeroTopMarginCss = css({ marginTop: 0 })

let codeBlockCss = css({
  margin: 0,
  padding: theme.space.md,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.inset,
  overflowX: 'auto',
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
  whiteSpace: 'pre',
})

let inlineCodeCss = css({
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.inset,
})

let tokenListCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let tokenRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
})

let swatchRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
})

let swatchMetaCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  minWidth: 0,
})

let swatchCss = css({
  width: '44px',
  height: '24px',
  borderRadius: theme.radius.full,
  border: `1px solid ${theme.colors.border.subtle}`,
  flexShrink: 0,
})

let navPreviewCardCss = css({
  padding: theme.space.md,
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

let componentPreviewCardCss = css({
  gap: theme.space.sm,
  padding: theme.space.md,
})

let layoutPreviewShellCss = css({
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: theme.space.md,
  '@media (max-width: 780px)': {
    gridTemplateColumns: '1fr',
  },
})

let layoutPreviewSidebarCss = css({
  paddingRight: theme.space.md,
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 780px)': {
    paddingRight: 0,
    paddingBottom: theme.space.md,
    borderRight: 'none',
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

let layoutPreviewMainCss = css({
  minWidth: 0,
})

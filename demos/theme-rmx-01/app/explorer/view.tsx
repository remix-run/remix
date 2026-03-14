import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import { RMX_01, RMX_01_VALUES, theme, ui } from '@remix-run/theme'
import type { ThemeRecipe } from '@remix-run/theme'
import type { PageDefinition } from './data.ts'
import { NAV_GROUPS, PAGES, UI_RECIPE_PAGES } from './data.ts'

export function ExplorerDocument() {
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
            {group.pages.map(page => {
              let isUiRecipesParent = page.id === PAGES.uiRecipes.id

              return (
                <div key={page.path} mix={sidebarNavGroupItemCss}>
                  <a
                    href={page.path}
                    aria-current={currentPath === page.path ? 'page' : undefined}
                    mix={getNavItemMix(page.path, currentPath)}
                  >
                    {page.navLabel}
                  </a>

                  {isUiRecipesParent ? (
                    <nav aria-label="UI recipe pages" mix={sidebarSubnavCss}>
                      {UI_RECIPE_PAGES.map(recipePage => (
                        <a
                          key={recipePage.path}
                          href={recipePage.path}
                          aria-current={currentPath === recipePage.path ? 'page' : undefined}
                          mix={getSubnavItemMix(recipePage.path, currentPath)}
                        >
                          {recipePage.navLabel}
                        </a>
                      ))}
                    </nav>
                  ) : null}
                </div>
              )
            })}
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
    <header mix={pageHeaderCss}>
      <p mix={ui.text.eyebrow}>{page.eyebrow}</p>
      <h2 mix={[ui.text.display, pageTitleCss]}>{page.title}</h2>
      <p mix={[ui.text.body, pageDescriptionCss]}>{page.description}</p>
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

    if (UI_RECIPE_PAGES.some(recipePage => recipePage.id === page.id)) {
      return <UiRecipeDetailPage page={page} />
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
            <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
              <button mix={ui.button.secondary}>
                Export
              </button>
              <button mix={ui.button.primary}>
                New release
              </button>
            </div>
          </div>

          <div mix={proofLayoutCss}>
            <aside mix={[ui.card.secondary, proofSidebarCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="Proof sheet app navigation" mix={ui.nav.list}>
                  <a href="/proof-sheet" aria-current="page" mix={ui.nav.itemActive}>
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
                  <div mix={ui.card.headerWithAction}>
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
                    <button mix={ui.button.secondary}>
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
                    <button mix={ui.button.secondary}>
                      Cancel
                    </button>
                    <button mix={ui.button.primary}>
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
              <code mix={codeTextCss}>{renderHighlightedCode(`let Theme = createTheme({
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
})`)}</code>
            </pre>
            <pre mix={codeBlockCss}>
              <code mix={codeTextCss}>{renderHighlightedCode(`:root {
  --rmx-space-md: 12px;
  --rmx-color-action-primary-background: #3561cf;
}`)}</code>
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
          <RecipeExample
            code={`<div mix={[ui.stack, ui.gap.sm]}>
  <p mix={ui.text.eyebrow}>Page eyebrow</p>
  <p mix={ui.text.title}>Section title</p>
  <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
</div>`}
            description="Page-level typography roles for headings, body copy, captions, and metadata."
            href={PAGES.uiRecipeText.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Text roles"
          >
            <div mix={[ui.stack, ui.gap.sm]}>
              <p mix={ui.text.eyebrow}>Page eyebrow</p>
              <p mix={ui.text.title}>Section title</p>
              <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={ui.card.base}>
  <div mix={ui.card.header}>
    <p mix={ui.card.eyebrow}>Surface</p>
    <h4 mix={ui.card.title}>Card header</h4>
    <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
  </div>
</div>`}
            description="Shared shell, spacing, and slot rhythm for cards, popovers, and content panels."
            href={PAGES.uiRecipeCard.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Card recipes"
          >
            <div mix={ui.card.base}>
              <div mix={ui.card.header}>
                <p mix={ui.card.eyebrow}>Surface</p>
                <h4 mix={ui.card.title}>Card header</h4>
                <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
              </div>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={buttonExampleRowCss}>
  <button mix={ui.button.primary}>Save</button>
  <button mix={ui.button.secondary}>Secondary</button>
  <button mix={ui.button.ghost}>Ghost</button>
  <button mix={ui.button.danger}>Delete</button>
</div>`}
            description="Compact action treatments for primary, surfaced neutral, text-first ghost, and destructive actions."
            href={PAGES.uiRecipeButton.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Buttons and controls"
          >
            <div mix={buttonExampleRowCss}>
              <button mix={ui.button.primary}>
                Save
              </button>
              <button mix={ui.button.secondary}>
                Secondary
              </button>
              <button mix={ui.button.ghost}>
                Ghost
              </button>
              <button mix={ui.button.danger}>
                Delete
              </button>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={[ui.stack, ui.gap.xs]}>
  <label for="ui-recipe-field" mix={ui.fieldText.label}>Project name</label>
  <input id="ui-recipe-field" value="RMX Internal Console" readOnly mix={ui.field.base} />
  <p mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</p>
</div>`}
            description="Field chrome and label/help typography should travel together."
            href={PAGES.uiRecipeField.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Fields"
          >
            <div mix={[ui.stack, ui.gap.xs]}>
              <label for="ui-recipe-field" mix={ui.fieldText.label}>
                Project name
              </label>
              <input id="ui-recipe-field" value="RMX Internal Console" readOnly mix={ui.field.base} />
              <p mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={[ui.stack, ui.gap.xs]}>
  <button type="button" mix={ui.item.base}>
    <span>Members</span>
    <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
  </button>
  <button type="button" mix={ui.item.danger}>
    <span>Archive workspace</span>
    <span mix={ui.text.caption}>Permanent</span>
  </button>
</div>`}
            description="List rows and status treatments underpin menus, comboboxes, command surfaces, and sidebars."
            href={PAGES.uiRecipeItem.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Items and status"
          >
            <div mix={[ui.stack, ui.gap.xs]}>
              <button type="button" mix={ui.item.base}>
                <span>Members</span>
                <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
              </button>
              <button type="button" mix={ui.item.danger}>
                <span>Archive workspace</span>
                <span mix={ui.text.caption}>Permanent</span>
              </button>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<nav aria-label="UI recipe nav preview" mix={ui.nav.list}>
  <a href="/ui-recipes" aria-current="page" mix={ui.nav.itemActive}>
    Current page
  </a>
  <a href="/ui-recipes" mix={ui.nav.item}>Secondary page</a>
</nav>`}
            description="Sidebar and navigation primitives are useful app-level building blocks even though this docs shell itself is demo-specific."
            href={PAGES.uiRecipeNav.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Sidebar and nav"
          >
            <div mix={[ui.card.secondary, navPreviewCardCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="UI recipe nav preview" mix={ui.nav.list}>
                  <a href="/ui-recipes" aria-current="page" mix={ui.nav.itemActive}>
                    Current page
                  </a>
                  <a href="/ui-recipes" mix={ui.nav.item}>
                    Secondary page
                  </a>
                </nav>
              </div>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={[ui.stack, ui.gap.md]}>
  <div mix={[ui.row, ui.row.between, ui.gap.sm]}>
    <p mix={ui.text.label}>Toolbar</p>
    <button mix={ui.button.secondary}>Filter</button>
  </div>
  <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
    <button mix={ui.button.primary}>Save</button>
    <button mix={ui.button.secondary}>Share</button>
    <button mix={ui.button.danger}>Delete</button>
  </div>
</div>`}
            description="Symmetrical row and stack primitives replace demo-specific flex helpers and pair naturally with the shared spacing scale."
            href={PAGES.uiRecipeLayout.path}
            previewMix={docsExamplePreviewCenterCss}
            title="Row and stack"
          >
            <div mix={[ui.stack, ui.gap.md]}>
              <div mix={[ui.row, ui.row.between, ui.gap.sm]}>
                <p mix={[ui.text.label, zeroMarginCss]}>Toolbar</p>
                <button mix={ui.button.secondary}>Filter</button>
              </div>
              <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
                <button mix={ui.button.primary}>Save</button>
                <button mix={ui.button.secondary}>Share</button>
                <button mix={ui.button.danger}>Delete</button>
              </div>
            </div>
          </RecipeExample>
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

function UiRecipeDetailPage() {
  return ({ page }: { page: PageDefinition }) => {
    if (page.id === PAGES.uiRecipeText.id) {
      return <UiRecipeTextPage />
    }

    if (page.id === PAGES.uiRecipeCard.id) {
      return <UiRecipeCardPage />
    }

    if (page.id === PAGES.uiRecipeButton.id) {
      return <UiRecipeButtonPage />
    }

    if (page.id === PAGES.uiRecipeField.id) {
      return <UiRecipeFieldPage />
    }

    if (page.id === PAGES.uiRecipeItem.id) {
      return <UiRecipeItemPage />
    }

    if (page.id === PAGES.uiRecipeLayout.id) {
      return <UiRecipeLayoutPage />
    }

    return <UiRecipeNavPage />
  }
}

function UiRecipeTextPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Text recipe overview"
        description="Text recipes provide the shared page-level voice of the system. They are the default vocabulary for headings, body copy, supporting notes, captions, and code."
      >
        <RecipeExample
          code={`<div mix={[ui.stack, ui.gap.sm]}>
  <p mix={ui.text.eyebrow}>Page eyebrow</p>
  <p mix={ui.text.title}>Section title</p>
  <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
  <p mix={ui.text.supporting}>Supporting notes can back away when needed.</p>
  <code mix={ui.text.code}>theme.colors.background.surface</code>
</div>`}
          description="Use page-level text roles when content sits in ordinary document flow and should read like part of the page rather than a surface-specific micro-layout."
          previewMix={docsExamplePreviewCenterCss}
          title="Page typography"
        >
          <div mix={[ui.stack, ui.gap.sm]}>
            <p mix={ui.text.eyebrow}>Page eyebrow</p>
            <p mix={ui.text.title}>Section title</p>
            <p mix={ui.text.bodySm}>Readable default copy for descriptive text.</p>
            <p mix={ui.text.supporting}>Supporting notes can back away when needed.</p>
            <code mix={ui.text.code}>theme.colors.background.surface</code>
          </div>
        </RecipeExample>
      </Section>

      <Section
        title="Included roles"
        description="These roles should be enough for most page-level writing without inventing component-specific typography every time."
      >
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={bulletListCss}>
              <li>`ui.text.eyebrow` for quiet uppercase metadata</li>
              <li>`ui.text.title` and `ui.text.display` for hierarchy</li>
              <li>`ui.text.body` and `ui.text.bodySm` for explanatory copy</li>
              <li>`ui.text.supporting`, `ui.text.caption`, and `ui.text.code` for secondary needs</li>
            </ul>
          </div>
        </article>
      </Section>
    </div>
  )
}

function UiRecipeCardPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Card recipe overview"
        description="Card recipes solve recurring shell and spacing problems: the outer surface, the header rhythm, body spacing, action alignment, and footer boundaries."
      >
        <RecipeExample
          code={`<article mix={[ui.card.base, docsExampleInnerCardCss]}>
  <div mix={ui.card.headerWithAction}>
    <div mix={ui.card.header}>
      <p mix={ui.card.eyebrow}>Surface</p>
      <h4 mix={ui.card.title}>Card header</h4>
      <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
    </div>
    <span mix={[ui.card.action, statusBadgeCss, ui.status.info]}>Info</span>
  </div>
  <div mix={ui.card.body}>
    <p mix={[ui.text.bodySm, zeroMarginCss]}>
      Body content can stay simple because the structural spacing is already solved.
    </p>
  </div>
  <div mix={ui.card.footer}>
    <button mix={ui.button.secondary}>Cancel</button>
    <button mix={ui.button.primary}>Continue</button>
  </div>
</article>`}
          description="Use the card layer for content panels, popovers, previews, settings groups, and any other surface that needs consistent slot rhythm."
          previewMix={docsExamplePreviewCenterCss}
          title="Structured surface"
        >
          <article mix={[ui.card.base, docsExampleInnerCardCss]}>
            <div mix={ui.card.headerWithAction}>
              <div mix={ui.card.header}>
                <p mix={ui.card.eyebrow}>Surface</p>
                <h4 mix={ui.card.title}>Card header</h4>
                <p mix={ui.card.description}>Typography and spacing stay consistent across surfaces.</p>
              </div>
              <span mix={[ui.card.action, statusBadgeCss, ui.status.info]}>Info</span>
            </div>
            <div mix={ui.card.body}>
              <p mix={[ui.text.bodySm, zeroMarginCss]}>
                Body content can stay simple because the structural spacing is already solved.
              </p>
            </div>
            <div mix={ui.card.footer}>
              <button mix={ui.button.secondary}>
                Cancel
              </button>
              <button mix={ui.button.primary}>
                Continue
              </button>
            </div>
          </article>
        </RecipeExample>
      </Section>

      <Section
        title="Anatomy and tones"
        description="The recipe family is really two things working together: structural slots and surface tone. Components can mix those pieces without inventing a new card model each time."
      >
        <div mix={twoColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Slots</p>
              <h3 mix={ui.card.title}>Reusable structure</h3>
              <p mix={ui.card.description}>
                These slots are what make cards useful as a layout primitive instead of just a border
                and background.
              </p>
            </div>
            <div mix={anatomyGridCss}>
              <div mix={[ui.card.secondary, anatomyPillCss]}>
                <code mix={ui.text.code}>ui.card.header</code>
              </div>
              <div mix={[ui.card.secondary, anatomyPillCss]}>
                <code mix={ui.text.code}>ui.card.headerWithAction</code>
              </div>
              <div mix={[ui.card.secondary, anatomyPillCss]}>
                <code mix={ui.text.code}>ui.card.body</code>
              </div>
              <div mix={[ui.card.secondary, anatomyPillCss]}>
                <code mix={ui.text.code}>ui.card.footer</code>
              </div>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Surface tones</p>
              <h3 mix={ui.card.title}>Visual hierarchy stays semantic</h3>
              <p mix={ui.card.description}>
                Tone is separate from structure, so different surfaces can still feel like the same
                family.
              </p>
            </div>
            <div mix={toneGridCss}>
              <div mix={[ui.card.base, toneSampleCss]}>
                <span mix={ui.text.caption}>Base</span>
              </div>
              <div mix={[ui.card.secondary, toneSampleCss]}>
                <span mix={ui.text.caption}>Secondary</span>
              </div>
              <div mix={[ui.card.elevated, toneSampleCss]}>
                <span mix={ui.text.caption}>Elevated</span>
              </div>
              <div mix={[ui.card.inset, toneSampleCss]}>
                <span mix={ui.text.caption}>Inset</span>
              </div>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

function UiRecipeButtonPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Buttons"
        description="The button API now supports both fast aliases and deliberate composition. Use the flat button recipes when they fit, or compose `base + size + tone` when you need more control."
      >
        <RecipeExample
          code={`<div mix={buttonExampleRowCss}>
  <button type="submit" mix={ui.button.primary}>Save</button>
  <button mix={ui.button.secondary}>Secondary</button>
  <button mix={ui.button.ghost}>Ghost</button>
  <button mix={ui.button.danger}>Delete</button>
</div>`}
          description="These aliases are the quickest way to style ordinary actions. They already include `ui.button.base`, the default `md` size, and the matching tone."
          previewMix={docsExamplePreviewCenterCss}
          title="Everyday button aliases"
        >
          <div mix={buttonExampleRowCss}>
            <button type="submit" mix={ui.button.primary}>
              Save
            </button>
            <button mix={ui.button.secondary}>
              Secondary
            </button>
            <button mix={ui.button.ghost}>
              Ghost
            </button>
            <button mix={ui.button.danger}>
              Delete
            </button>
          </div>
        </RecipeExample>
      </Section>

      <Section
        title="Composition"
        description="Use the composable model when you need a specific size, when you want to apply button styling to a link, or when a first-party component should build its own button shape from shared parts."
      >
        <div mix={pageSectionStackCss}>
          <RecipeExample
            code={`<div mix={buttonExampleRowCss}>
  <button
    type="submit"
    mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}
  >
    Publish
  </button>

  <a
    href="/proof-sheet"
    mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}
  >
    View proof sheet
  </a>
</div>`}
            description="Button recipes compose directly onto both `<button>` and `<a>`. This is the alternative to wrapper-heavy `asChild` patterns."
            previewMix={docsExamplePreviewCenterCss}
            title="Base, size, and tone"
          >
            <div mix={buttonExampleRowCss}>
              <button type="submit" mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
                Publish
              </button>
              <a href="/proof-sheet" mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
                View proof sheet
              </a>
            </div>
          </RecipeExample>
          <RecipeExample
            code={`<div mix={buttonExampleRowCss}>
  <button mix={[ui.button.base, ui.button.sm, ui.button.tone.secondary]}>
    Small
  </button>
  <button mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
    Medium
  </button>
  <button mix={[ui.button.base, ui.button.lg, ui.button.tone.secondary]}>
    Large
  </button>
  <button
    aria-label="Refresh"
    mix={[ui.button.base, ui.button.icon, ui.button.tone.secondary]}
  >
    <span data-slot="icon" aria-hidden="true">+</span>
  </button>
</div>`}
            description="Size is a separate layer. `ui.button.icon` is for icon-only buttons and keeps the control square."
            previewMix={docsExamplePreviewCenterCss}
            title="Sizes"
          >
            <div mix={buttonExampleRowCss}>
              <button mix={[ui.button.base, ui.button.sm, ui.button.tone.secondary]}>
                Small
              </button>
              <button mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
                Medium
              </button>
              <button mix={[ui.button.base, ui.button.lg, ui.button.tone.secondary]}>
                Large
              </button>
              <button
                aria-label="Refresh"
                mix={[ui.button.base, ui.button.icon, ui.button.tone.secondary]}
              >
                <span data-slot="icon" aria-hidden="true">
                  +
                </span>
              </button>
            </div>
          </RecipeExample>
        </div>
      </Section>

      <Section
        title="Slots and states"
        description="Buttons use slot selectors for icons and keep loading layout-stable by treating the spinner as just another icon."
      >
        <div mix={pageSectionStackCss}>
          <RecipeExample
            code={`<div mix={buttonExampleRowCss}>
  <button mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
    <span data-slot="icon" aria-hidden="true">+</span>
    <span data-slot="label">New issue</span>
  </button>

  <button mix={[ui.button.base, ui.button.md, ui.button.tone.ghost]}>
    <span data-slot="label">Open</span>
    <span data-slot="icon" aria-hidden="true">→</span>
  </button>

  <button
    disabled
    mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}
  >
    Disabled
  </button>

  <button
    aria-busy="true"
    mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}
  >
    <span data-slot="icon" aria-hidden="true">◌</span>
    <span data-slot="label">Saving</span>
  </button>
</div>`}
            description={
              'Use `[data-slot="icon"]` and `[data-slot="label"]` for leading icons, trailing icons, and loading spinners. Loading is a content convention, not a separate button variant.'
            }
            previewMix={docsExamplePreviewCenterCss}
            title="Icons, loading, and disabled"
          >
            <div mix={buttonExampleRowCss}>
              <button mix={[ui.button.base, ui.button.md, ui.button.tone.primary]}>
                <span data-slot="icon" aria-hidden="true">
                  +
                </span>
                <span data-slot="label">New issue</span>
              </button>

              <button mix={[ui.button.base, ui.button.md, ui.button.tone.ghost]}>
                <span data-slot="label">Open</span>
                <span data-slot="icon" aria-hidden="true">
                  →
                </span>
              </button>

              <button disabled mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}>
                Disabled
              </button>

              <button
                aria-busy="true"
                mix={[ui.button.base, ui.button.md, ui.button.tone.secondary]}
              >
                <span data-slot="icon" aria-hidden="true" mix={buttonSpinnerGlyphCss}>
                  ◌
                </span>
                <span data-slot="label">Saving</span>
              </button>
            </div>
          </RecipeExample>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Usage rules</p>
              <h3 mix={ui.card.title}>What developers and agents should remember</h3>
              <p mix={ui.card.description}>
                The button API is intentionally small. Most decisions should be about action
                hierarchy, size, and whether the host is a button or a link.
              </p>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>`ui.button.primary` is for the main action in a surface or action group.</li>
                <li>`ui.button.secondary` is the surfaced neutral button for cancel, back, filter, or supporting actions.</li>
                <li>`ui.button.ghost` is for low-emphasis actions that should read like text until interaction.</li>
                <li>`ui.button.danger` is only for destructive work like delete, archive, or revoke access.</li>
                <li>Recipes default real `button` elements to `type="button"`, so use `type="submit"` explicitly when needed.</li>
                <li>Use the flat aliases for speed, and the composable layers when a first-party component needs to own size or structure.</li>
              </ul>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

function UiRecipeFieldPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Field recipe overview"
        description="Fields should not reinvent their own chrome or type. The field and field-text recipes keep forms aligned with the rest of the system."
      >
        <RecipeExample
          code={`<div mix={[ui.stack, ui.gap.xs, docsExampleFieldStackCss]}>
  <label for="ui-recipe-detail-field" mix={ui.fieldText.label}>Project name</label>
  <input id="ui-recipe-detail-field" value="RMX Internal Console" readOnly mix={ui.field.base} />
  <p mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</p>
</div>`}
          description="Labels, help text, and field chrome belong together. That gives first-party form components a strong default shape."
          previewMix={docsExamplePreviewCenterCss}
          title="Field stack"
        >
          <div mix={[ui.stack, ui.gap.xs, docsExampleFieldStackCss]}>
            <label for="ui-recipe-detail-field" mix={ui.fieldText.label}>
              Project name
            </label>
            <input
              id="ui-recipe-detail-field"
              value="RMX Internal Console"
              readOnly
              mix={ui.field.base}
            />
            <p mix={ui.fieldText.help}>Shown in navigation, notifications, and audit logs.</p>
          </div>
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeItemPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Item and status recipe overview"
        description="Rows and status treatments are the basis for menus, command surfaces, tabs, combobox options, and sidebar collections."
      >
        <RecipeExample
          code={`<div mix={[ui.stack, ui.gap.xs, docsExampleFieldStackCss]}>
  <button type="button" mix={ui.item.base}>
    <span>Members</span>
    <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
  </button>
  <button type="button" mix={ui.item.danger}>
    <span>Archive workspace</span>
    <span mix={ui.text.caption}>Permanent</span>
  </button>
</div>`}
          description="Items should be useful as a boring default. Status treatments then add semantic tone without changing the row structure."
          previewMix={docsExamplePreviewCenterCss}
          title="Row primitives"
        >
          <div mix={[ui.stack, ui.gap.xs, docsExampleFieldStackCss]}>
            <button type="button" mix={ui.item.base}>
              <span>Members</span>
              <span mix={[statusBadgeCss, ui.status.success]}>12 online</span>
            </button>
            <button type="button" mix={ui.item.danger}>
              <span>Archive workspace</span>
              <span mix={ui.text.caption}>Permanent</span>
            </button>
          </div>
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeNavPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Sidebar and nav recipe overview"
        description="The docs shell here is local, but the sidebar and navigation ingredients are useful application primitives that can be reused elsewhere."
      >
        <RecipeExample
          code={`<div mix={[ui.card.secondary, navPreviewCardCss]}>
  <div mix={ui.sidebar.section}>
    <p mix={ui.sidebar.heading}>Navigation</p>
    <nav aria-label="UI recipe nav detail preview" mix={ui.nav.list}>
      <a href="/ui-recipes/navigation" aria-current="page" mix={ui.nav.itemActive}>
        Current page
      </a>
      <a href="/ui-recipes/navigation" mix={ui.nav.item}>Secondary page</a>
      <a href="/ui-recipes/navigation" mix={ui.nav.item}>Tertiary page</a>
    </nav>
  </div>
</div>`}
          description="These recipes should support settings rails, project navigation, and docs-style sidebars without requiring a wrapper-heavy layout API."
          previewMix={docsExamplePreviewCenterCss}
          title="Sidebar stack"
        >
          <div mix={[ui.card.secondary, navPreviewCardCss]}>
            <div mix={ui.sidebar.section}>
              <p mix={ui.sidebar.heading}>Navigation</p>
              <nav aria-label="UI recipe nav detail preview" mix={ui.nav.list}>
                <a href="/ui-recipes/navigation" aria-current="page" mix={ui.nav.itemActive}>
                  Current page
                </a>
                <a href="/ui-recipes/navigation" mix={ui.nav.item}>
                  Secondary page
                </a>
                <a href="/ui-recipes/navigation" mix={ui.nav.item}>
                  Tertiary page
                </a>
              </nav>
            </div>
          </div>
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeLayoutPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Row and stack recipe overview"
        description="These primitives cover the common flex mechanics that kept showing up as demo-only helpers: horizontal alignment, vertical rhythm, distribution, and wrapping."
      >
        <RecipeExample
          code={`<div mix={[ui.stack, ui.gap.md]}>
  <div mix={[ui.row, ui.row.between, ui.gap.sm]}>
    <p mix={ui.text.label}>Toolbar</p>
    <button mix={ui.button.secondary}>Filter</button>
  </div>
  <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
    <button mix={ui.button.primary}>Save</button>
    <button mix={ui.button.secondary}>Share</button>
    <button mix={ui.button.danger}>Delete</button>
  </div>
</div>`}
          description="Use `ui.row` and `ui.stack` for repeated flex mechanics, then add spacing with `ui.gap.*` instead of inventing purpose-built row helpers."
          previewMix={docsExamplePreviewCenterCss}
          title="Composed layout primitives"
        >
          <div mix={[ui.stack, ui.gap.md]}>
            <div mix={[ui.row, ui.row.between, ui.gap.sm]}>
              <p mix={[ui.text.label, zeroMarginCss]}>Toolbar</p>
              <button mix={ui.button.secondary}>Filter</button>
            </div>
            <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
              <button mix={ui.button.primary}>Save</button>
              <button mix={ui.button.secondary}>Share</button>
              <button mix={ui.button.danger}>Delete</button>
            </div>
          </div>
        </RecipeExample>
      </Section>

      <Section
        title="Included modifiers"
        description="Rows and stacks stay symmetrical so they are easy to remember and easy for coding agents to reach for."
      >
        <div mix={twoColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Row</p>
              <h3 mix={ui.card.title}>Horizontal alignment + distribution</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>`ui.row`</li>
                <li>`ui.row.start`, `ui.row.center`, `ui.row.end`</li>
                <li>`ui.row.between`</li>
                <li>`ui.row.wrap`</li>
              </ul>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Stack</p>
              <h3 mix={ui.card.title}>Vertical flow with the same modifier model</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>`ui.stack`</li>
                <li>`ui.stack.start`, `ui.stack.center`, `ui.stack.end`</li>
                <li>`ui.stack.between`</li>
                <li>`ui.stack.wrap`</li>
              </ul>
            </div>
          </article>
        </div>
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
              <h3 mix={ui.card.title}>A thin wrapper over a shared recipe</h3>
              <p mix={ui.card.description}>
                A button component can expose behavior and semantics while directly consuming
                `ui.button.*`.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={[ui.row, ui.row.wrap, ui.gap.sm]}>
                <button mix={ui.button.primary}>
                  Primary
                </button>
                <button mix={ui.button.secondary}>
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
                  <a href="/layouts" aria-current="page" mix={ui.nav.itemActive}>
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
        <code mix={[ui.text.code, inlineCodeCss]}>{renderHighlightedCode(code)}</code>
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

function RecipeExample() {
  return ({
    children,
    code,
    description,
    href,
    previewMix,
    title,
  }: {
    children: RemixNode
    code: string
    description: string
    href?: string
    previewMix?: ThemeRecipe
    title: string
  }) => (
    <div mix={docsExampleBlockCss}>
      <div mix={docsExampleIntroCss}>
        <p mix={ui.text.eyebrow}>Recipe family</p>
        <h3 mix={[ui.text.title, docsExampleTitleCss]}>{title}</h3>
        <p mix={[ui.text.bodySm, docsExampleDescriptionCss]}>{description}</p>
      </div>
      <article mix={docsExampleCardCss}>
        <div mix={previewMix ? [docsExamplePreviewCss, previewMix] : [docsExamplePreviewCss]}>
          {children}
        </div>
        <div mix={docsExampleCodePanelCss}>
          <code mix={[ui.text.code, docsExampleCodeCss]}>{renderHighlightedCode(code)}</code>
          {href ? (
            <a href={href} mix={docsExampleLinkCss}>
              Open recipe page
            </a>
          ) : null}
        </div>
      </article>
    </div>
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
    tone: ThemeRecipe
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
  return currentPath === path ? ui.nav.itemActive : ui.nav.item
}

function getSubnavItemMix(path: string, currentPath: string) {
  return currentPath === path
    ? [ui.nav.itemActive, sidebarSubnavItemCss]
    : [ui.nav.item, sidebarSubnavItemCss]
}

function renderHighlightedCode(code: string) {
  let pattern = /\b(?:ui|theme)(?:\.[A-Za-z0-9_]+)+|\bcreateTheme\b|\bRMX_01(?:_VALUES)?\b/g
  let nodes: Array<RemixNode> = []
  let lastIndex = 0

  for (let match of code.matchAll(pattern)) {
    let index = match.index ?? 0
    let value = match[0]

    if (index > lastIndex) {
      nodes.push(code.slice(lastIndex, index))
    }

    nodes.push(
      <span key={`${value}-${index}`} mix={apiCodeTokenCss}>
        {value}
      </span>,
    )

    lastIndex = index + value.length
  }

  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex))
  }

  return nodes
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
  width: '100%',
  maxWidth: '960px',
  marginInline: 'auto',
})

let pageHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
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

let sidebarNavGroupItemCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let sidebarSubnavCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  paddingLeft: theme.space.md,
})

let sidebarSubnavItemCss = css({
  minHeight: '28px',
  paddingBlock: '3px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
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

let codeTextCss = css({
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

let docsExampleBlockCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let docsExampleIntroCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let docsExampleTitleCss = css({
  margin: 0,
})

let docsExampleDescriptionCss = css({
  margin: 0,
  maxWidth: '64ch',
})

let docsExampleCardCss = css({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  overflow: 'hidden',
})

let docsExamplePreviewCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '180px',
  padding: theme.space.md,
  background:
    'linear-gradient(to bottom, color-mix(in oklab, rgb(250 250 250) 70%, white) 0%, white 100%)',
})

let docsExamplePreviewCenterCss = css({
  alignItems: 'center',
  justifyContent: 'center',
})

let buttonExampleRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  width: 'max-content',
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: theme.space.xs,
  '& > *': {
    flexShrink: 0,
  },
})

let buttonSpinnerGlyphCss = css({
  opacity: 0.72,
})

let docsExampleCodePanelCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  padding: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: 'color-mix(in oklab, rgb(248 248 248) 76%, white)',
  overflowX: 'auto',
  '@media (max-width: 640px)': {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
})

let docsExampleCodeCss = css({
  display: 'block',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  color: theme.colors.text.secondary,
  minWidth: 'max-content',
  whiteSpace: 'pre',
})

let apiCodeTokenCss = css({
  color: theme.colors.text.link,
})

let docsExampleLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.colors.text.link,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  '&:hover': {
    textDecoration: 'underline',
  },
})

let docsExampleInnerCardCss = css({
  width: '100%',
  maxWidth: '500px',
})

let docsExampleFieldStackCss = css({
  width: '100%',
  maxWidth: '360px',
})

let anatomyGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.sm,
  '@media (max-width: 640px)': {
    gridTemplateColumns: '1fr',
  },
})

let anatomyPillCss = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: '48px',
  padding: theme.space.sm,
})

let toneGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.sm,
  '@media (max-width: 640px)': {
    gridTemplateColumns: '1fr',
  },
})

let toneSampleCss = css({
  minHeight: '84px',
  alignItems: 'flex-end',
  justifyContent: 'flex-start',
  padding: theme.space.sm,
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

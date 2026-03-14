import { css } from 'remix/component'
import type { RemixNode } from 'remix/component'
import {
  createGlyphSheet,
  Glyph,
  glyphNames,
  RMX_01,
  RMX_01_GLYPHS,
  theme,
  ui,
} from 'remix/ui'
import type { ThemeRecipe } from 'remix/ui'
import { EXAMPLES } from '../examples/index.tsx'
import type { PageDefinition } from './data.ts'
import { PAGES, PRIMARY_PAGES, THEME_TOKEN_PAGES, UI_RECIPE_PAGES } from './data.ts'

let RMX_01Glyphs = createGlyphSheet(RMX_01_GLYPHS)

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
        <RMX_01Glyphs />
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
      <nav aria-label="Design system pages" mix={ui.nav.list}>
        {PRIMARY_PAGES.slice(0, 2).map(page => (
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

      <section mix={ui.sidebar.section}>
        <p mix={ui.sidebar.heading}>Theme Tokens</p>
        <nav aria-label="Theme token pages" mix={ui.nav.list}>
          {THEME_TOKEN_PAGES.map(tokenPage => (
            <a
              key={tokenPage.path}
              href={tokenPage.path}
              aria-current={currentPath === tokenPage.path ? 'page' : undefined}
              mix={getSubnavItemMix(tokenPage.path, currentPath)}
            >
              {tokenPage.navLabel}
            </a>
          ))}
        </nav>
      </section>

      <nav aria-label="Additional API pages" mix={ui.nav.list}>
        <a
          href={PAGES.glyphs.path}
          aria-current={currentPath === PAGES.glyphs.path ? 'page' : undefined}
          mix={getNavItemMix(PAGES.glyphs.path, currentPath)}
        >
          {PAGES.glyphs.navLabel}
        </a>
      </nav>

      <section mix={ui.sidebar.section}>
        <p mix={ui.sidebar.heading}>UI Mixins</p>
        <nav aria-label="UI mixin pages" mix={ui.nav.list}>
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
      </section>

      <nav aria-label="Remaining pages" mix={ui.nav.list}>
        {PRIMARY_PAGES.slice(3).map(page => (
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

      <section mix={[calloutCss, calloutInfoCss]}>
        <p mix={[ui.text.label, calloutTitleCss]}>What this shows</p>
        <p mix={[ui.text.bodySm, calloutBodyCss]}>
          RMX_01 is the current default theme, and the pages here show the tokens, mixins, blocks,
          and examples available right now.
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

    if (THEME_TOKEN_PAGES.some(tokenPage => tokenPage.id === page.id)) {
      return <ThemeTokenDetailPage page={page} />
    }

    if (page.id === PAGES.glyphs.id) {
      return <GlyphsPage />
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
        title="Available today"
        description="The explorer is organized around the pieces you can use directly: theme tokens, ui mixins, blocks, and proof-sheet examples."
      >
        <div mix={threeColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>1. Theme Tokens</p>
              <h3 mix={ui.card.title}>`theme` is the contract</h3>
              <p mix={ui.card.description}>
                Components and app code read `theme.*` variable references, while themes define the
                underlying CSS custom property values.
              </p>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>2. UI Mixins</p>
              <h3 mix={ui.card.title}>`ui` speeds up composition</h3>
              <p mix={ui.card.description}>
                Mixins like `ui.button.primary`, `ui.card.base`, and `ui.nav.item` make composition
                fast without scattering one-off styling decisions through the app.
              </p>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>3. Blocks</p>
              <h3 mix={ui.card.title}>Blocks handle bigger structure</h3>
              <p mix={ui.card.description}>
                Cards, sidebars, rails, and shell sections are larger structural pieces that can be
                built from shared mixins without immediately turning into full behavioral components.
              </p>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>4. Components</p>
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
        title="Pages"
        description="Use the sidebar to jump straight to the token, mixin, block, and proof-sheet pages you need."
      >
        <div mix={exampleStackCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Browse</p>
              <h3 mix={ui.card.title}>Focused pages by API area</h3>
              <p mix={ui.card.description}>
                Theme tokens, glyphs, ui mixins, components, and blocks each have their own pages so
                the explorer stays easy to scan.
              </p>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>Overview highlights what is available.</li>
                <li>Proof sheet shows the feel of a theme in context.</li>
                <li>API pages show the available tokens, mixins, and blocks.</li>
              </ul>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Use</p>
              <h3 mix={ui.card.title}>Examples stay practical</h3>
              <p mix={ui.card.description}>
                The explorer is meant to show what is available and how to use it briefly, without
                turning every page into a long explanation.
              </p>
            </div>
            <div mix={ui.card.body}>
              <div mix={stackSmCss}>
                <div mix={[calloutCss, calloutInfoCss]}>
                  <p mix={[ui.text.label, calloutTitleCss]}>Current focus</p>
                  <p mix={[ui.text.bodySm, calloutBodyCss]}>
                    Keep tightening the shared tokens, mixins, typography, and examples until the
                    system is strong enough for first-party components.
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
                <Glyph mix={ui.button.icon} name="chevronDown" />
                <span mix={ui.button.label}>Export</span>
              </button>
              <button mix={ui.button.primary}>
                <Glyph mix={ui.button.icon} name="add" />
                <span mix={ui.button.label}>New release</span>
              </button>
            </div>
          </div>

          <div mix={proofLayoutCss}>
            <aside mix={[ui.card.secondary, proofSidebarCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="Proof sheet app navigation" mix={ui.nav.list}>
                  <a href="/proof-sheet" aria-current="page" mix={ui.nav.itemActive}>
                    <Glyph mix={[ui.icon.sm, proofNavGlyphCss]} name="menu" />
                    Overview
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    <Glyph mix={[ui.icon.sm, proofNavGlyphCss]} name="search" />
                    Deployments
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    <Glyph mix={[ui.icon.sm, proofNavGlyphCss]} name="spinner" />
                    Logs
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    <Glyph mix={[ui.icon.sm, proofNavGlyphCss]} name="info" />
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
                    <ul mix={proofChecklistCss}>
                      <li mix={proofChecklistItemCss}>
                        <Glyph mix={[ui.icon.md, proofChecklistGlyphCss]} name="check" />
                        <span>Verify migrations are locked before the deploy starts.</span>
                      </li>
                      <li mix={proofChecklistItemCss}>
                        <Glyph mix={[ui.icon.md, proofChecklistGlyphCss]} name="alert" />
                        <span>Hold background workers for the first rollout window.</span>
                      </li>
                      <li mix={proofChecklistItemCss}>
                        <Glyph mix={[ui.icon.md, proofChecklistGlyphCss]} name="check" />
                        <span>Run smoke tests before enabling the scheduled queue.</span>
                      </li>
                    </ul>
                  </div>
                  <div mix={ui.card.footer}>
                    <p mix={[ui.text.caption, metaTextCss]}>Updated 18 minutes ago</p>
                    <button mix={ui.button.secondary}>
                      <span mix={ui.button.label}>Open runbook</span>
                      <Glyph mix={ui.button.icon} name="chevronRight" />
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
                      <span mix={ui.button.label}>Cancel</span>
                    </button>
                    <button mix={ui.button.primary}>
                      <span mix={ui.button.label}>Send invite</span>
                      <Glyph mix={ui.button.icon} name="chevronRight" />
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
                        <Glyph mix={[ui.icon.sm, menuItemGlyphCss]} name="search" />
                        Rename project
                      </button>
                      <button type="button" role="menuitem" mix={menuItemCss}>
                        <Glyph mix={[ui.icon.sm, menuItemGlyphCss]} name="chevronRight" />
                        Copy environment
                      </button>
                      <button type="button" role="menuitem" mix={[menuItemCss, menuItemDangerCss, ui.status.danger]}>
                        <Glyph mix={[ui.icon.sm, menuItemGlyphCss]} name="close" />
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

function ThemeTokenDetailPage() {
  return ({ page }: { page: PageDefinition }) => {
    if (page.id === PAGES.themeTokenSpace.id) {
      return <ThemeTokenSpacePage />
    }

    if (page.id === PAGES.themeTokenRadius.id) {
      return <ThemeTokenRadiusPage />
    }

    if (page.id === PAGES.themeTokenTypography.id) {
      return <ThemeTokenTypographyPage />
    }

    if (page.id === PAGES.themeTokenColors.id) {
      return <ThemeTokenColorsPage />
    }

    if (page.id === PAGES.themeTokenShadow.id) {
      return <ThemeTokenShadowPage />
    }

    if (page.id === PAGES.themeTokenMotion.id) {
      return <ThemeTokenMotionPage />
    }

    return <ThemeTokenControlPage />
  }
}

function ThemeTokenSpacePage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <div mix={exampleStackCss}>
          <RecipeExample
            code={`<div mix={[ui.stack, css({ gap: theme.space.sm })]}>
  <div mix={[ui.card.secondary, css({ padding: theme.space.xs })]}>theme.space.xs</div>
  <div mix={[ui.card.secondary, css({ padding: theme.space.sm })]}>theme.space.sm</div>
  <div mix={[ui.card.secondary, css({ padding: theme.space.md })]}>theme.space.md</div>
  <div mix={[ui.card.secondary, css({ padding: theme.space.lg })]}>theme.space.lg</div>
</div>`}
            description="Use space tokens for padding and internal rhythm so density changes with the theme instead of being hard-coded per component."
            previewMix={docsExamplePreviewStartCss}
            title="Padding scale"
          >
            <div mix={[ui.stack, css({ gap: theme.space.sm, width: '100%' })]}>
              <div mix={[ui.card.secondary, css({ padding: theme.space.xs })]}>theme.space.xs</div>
              <div mix={[ui.card.secondary, css({ padding: theme.space.sm })]}>theme.space.sm</div>
              <div mix={[ui.card.secondary, css({ padding: theme.space.md })]}>theme.space.md</div>
              <div mix={[ui.card.secondary, css({ padding: theme.space.lg })]}>theme.space.lg</div>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={[ui.stack, css({ gap: theme.space.xs })]}>
  <div mix={spaceRowSampleCss}>
    <span />
    <span />
    <span />
  </div>
  <div mix={[spaceRowSampleCss, css({ gap: theme.space.sm })]}>
    <span />
    <span />
    <span />
  </div>
  <div mix={[spaceRowSampleCss, css({ gap: theme.space.md })]}>
    <span />
    <span />
    <span />
  </div>
</div>`}
            description="Gap tokens keep repeated layouts consistent across rows, stacks, toolbars, and grouped controls."
            previewMix={docsExamplePreviewStartCss}
            title="Gap rhythm"
          >
            <div mix={[ui.stack, css({ gap: theme.space.sm, width: '100%' })]}>
              <div mix={[spaceRowSampleCss, css({ gap: theme.space.xs })]}>
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
              </div>
              <div mix={[spaceRowSampleCss, css({ gap: theme.space.sm })]}>
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
              </div>
              <div mix={[spaceRowSampleCss, css({ gap: theme.space.md })]}>
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
              </div>
              <div mix={[spaceRowSampleCss, css({ gap: theme.space.lg })]}>
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
                <span mix={spaceDotCss} />
              </div>
            </div>
          </RecipeExample>
        </div>
      </section>
    </div>
  )
}

function ThemeTokenRadiusPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <RecipeExample
          code={`<div mix={radiusPreviewGridCss}>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.none })]}>none</div>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.sm })]}>sm</div>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.md })]}>md</div>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.lg })]}>lg</div>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.xl })]}>xl</div>
  <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.full })]}>full</div>
</div>`}
          description="Use radius tokens directly when a component needs a specific corner shape instead of introducing another semantic abstraction."
          previewMix={docsExamplePreviewStartCss}
          title="Corner shapes"
        >
          <div mix={radiusPreviewGridCss}>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.none })]}>none</div>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.sm })]}>sm</div>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.md })]}>md</div>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.lg })]}>lg</div>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.xl })]}>xl</div>
            <div mix={[radiusTokenSampleCss, css({ borderRadius: theme.radius.full })]}>full</div>
          </div>
        </RecipeExample>
      </section>
    </div>
  )
}

function ThemeTokenTypographyPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <div mix={exampleStackCss}>
          <RecipeExample
            code={`<div mix={typePreviewStackCss}>
  <p mix={css({ fontSize: theme.fontSize.xxs })}>xxs label</p>
  <p mix={css({ fontSize: theme.fontSize.xs })}>xs body</p>
  <p mix={css({ fontSize: theme.fontSize.md })}>md body</p>
  <p mix={css({ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold })}>xl title</p>
</div>`}
            description="Font size tokens should change the overall rhythm of the theme without every component redefining its own scale."
            previewMix={docsExamplePreviewStartCss}
            title="Font sizes"
          >
            <div mix={typePreviewStackCss}>
              <p mix={[tokenTextResetCss, css({ fontSize: theme.fontSize.xxs })]}>xxs label</p>
              <p mix={[tokenTextResetCss, css({ fontSize: theme.fontSize.xs })]}>xs body</p>
              <p mix={[tokenTextResetCss, css({ fontSize: theme.fontSize.md })]}>md body</p>
              <p
                mix={[
                  tokenTextResetCss,
                  css({ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold }),
                ]}
              >
                xl title
              </p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={typePreviewStackCss}>
  <p mix={css({ fontWeight: theme.fontWeight.normal })}>normal</p>
  <p mix={css({ fontWeight: theme.fontWeight.medium })}>medium</p>
  <p mix={css({ fontWeight: theme.fontWeight.semibold })}>semibold</p>
  <p mix={css({ fontWeight: theme.fontWeight.bold })}>bold</p>
</div>`}
            description="Weight tokens define emphasis and hierarchy while staying inside the same type family."
            previewMix={docsExamplePreviewStartCss}
            title="Font weights"
          >
            <div mix={typePreviewStackCss}>
              <p mix={[tokenTextResetCss, css({ fontWeight: theme.fontWeight.normal })]}>normal</p>
              <p mix={[tokenTextResetCss, css({ fontWeight: theme.fontWeight.medium })]}>medium</p>
              <p mix={[tokenTextResetCss, css({ fontWeight: theme.fontWeight.semibold })]}>semibold</p>
              <p mix={[tokenTextResetCss, css({ fontWeight: theme.fontWeight.bold })]}>bold</p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={lineHeightPreviewStackCss}>
  <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.tight })]}>Tight line height keeps dense product labels, short instructions, and compact headings feeling crisp without opening extra space between every wrapped line of text.</p>
  <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.normal })]}>Normal line height is the default workhorse for app copy, status messages, and short paragraphs where readability matters but the surface still needs to stay compact.</p>
  <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.relaxed })]}>Relaxed line height gives longer notes, supporting explanations, and reference text a calmer rhythm so extended reading feels easier inside cards, sidebars, and content areas.</p>
</div>`}
            description="Line height tokens tune how open or compact the text feels across a theme."
            previewMix={docsExamplePreviewStartCss}
            title="Line heights"
          >
            <div mix={lineHeightPreviewStackCss}>
              <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.tight })]}>
                Tight line height keeps dense product labels, short instructions, and compact
                headings feeling crisp without opening extra space between every wrapped line of
                text.
              </p>
              <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.normal })]}>
                Normal line height is the default workhorse for app copy, status messages, and
                short paragraphs where readability matters but the surface still needs to stay
                compact.
              </p>
              <p mix={[tokenTextResetCss, css({ lineHeight: theme.lineHeight.relaxed })]}>
                Relaxed line height gives longer notes, supporting explanations, and reference text
                a calmer rhythm so extended reading feels easier inside cards, sidebars, and
                content areas.
              </p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={typePreviewStackCss}>
  <p mix={css({ letterSpacing: theme.letterSpacing.tight })}>tight tracking</p>
  <p mix={css({ letterSpacing: theme.letterSpacing.normal })}>normal tracking</p>
  <p mix={css({ letterSpacing: theme.letterSpacing.wide, textTransform: 'uppercase' })}>wide tracking</p>
</div>`}
            description="Tracking tokens help themes fine-tune how compact or airy labels and titles feel."
            previewMix={docsExamplePreviewStartCss}
            title="Letter spacing"
          >
            <div mix={typePreviewStackCss}>
              <p mix={[tokenTextResetCss, css({ letterSpacing: theme.letterSpacing.tight })]}>
                tight tracking
              </p>
              <p mix={[tokenTextResetCss, css({ letterSpacing: theme.letterSpacing.normal })]}>
                normal tracking
              </p>
              <p
                mix={[
                  tokenTextResetCss,
                  css({ letterSpacing: theme.letterSpacing.wide, textTransform: 'uppercase' }),
                ]}
              >
                wide tracking
              </p>
            </div>
          </RecipeExample>
        </div>
      </section>

      <Section
        title="Font families"
        description="Family tokens keep the system grounded in a readable sans stack with a distinct mono option for code and metadata."
      >
        <RecipeExample
          code={`<div mix={typePreviewStackCss}>
  <p mix={css({ fontFamily: theme.fontFamily.sans })}>Sans family for interface copy</p>
  <code mix={css({ fontFamily: theme.fontFamily.mono })}>Mono family for code and diagnostics</code>
</div>`}
          description="Family tokens should be enough to support ordinary interface copy and code-like content without reaching for custom stacks."
          previewMix={docsExamplePreviewStartCss}
          title="Font families"
        >
          <div mix={typePreviewStackCss}>
            <p mix={[tokenTextResetCss, css({ fontFamily: theme.fontFamily.sans })]}>
              Sans family for interface copy
            </p>
            <code mix={[ui.text.code, css({ fontFamily: theme.fontFamily.mono })]}>
              Mono family for code and diagnostics
            </code>
          </div>
        </RecipeExample>
      </Section>
    </div>
  )
}

function ThemeTokenColorsPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <div mix={exampleStackCss}>
          <RecipeExample
            code={`<div mix={colorStackCss}>
  <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.canvas })]}>theme.colors.background.canvas</div>
  <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.surface })]}>theme.colors.background.surface</div>
  <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.surfaceSecondary })]}>theme.colors.background.surfaceSecondary</div>
  <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.inset })]}>theme.colors.background.inset</div>
</div>`}
            description="Background roles should separate canvas, ordinary surfaces, secondary surfaces, and inset treatments without hard-coding specific colors."
            previewMix={docsExamplePreviewStartCss}
            title="Surface stack"
          >
            <div mix={colorStackCss}>
              <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.canvas })]}>
                <code mix={ui.text.code}>theme.colors.background.canvas</code>
              </div>
              <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.surface })]}>
                <code mix={ui.text.code}>theme.colors.background.surface</code>
              </div>
              <div
                mix={[
                  colorSwatchRowCss,
                  css({ backgroundColor: theme.colors.background.surfaceSecondary }),
                ]}
              >
                <code mix={ui.text.code}>theme.colors.background.surfaceSecondary</code>
              </div>
              <div mix={[colorSwatchRowCss, css({ backgroundColor: theme.colors.background.inset })]}>
                <code mix={ui.text.code}>theme.colors.background.inset</code>
              </div>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={typePreviewStackCss}>
  <p mix={css({ color: theme.colors.text.primary })}>theme.colors.text.primary</p>
  <p mix={css({ color: theme.colors.text.secondary })}>theme.colors.text.secondary</p>
  <p mix={css({ color: theme.colors.text.muted })}>theme.colors.text.muted</p>
  <p mix={css({ color: theme.colors.text.link })}>theme.colors.text.link</p>
</div>`}
            description="Text roles should provide hierarchy and emphasis without components choosing one-off colors."
            previewMix={docsExamplePreviewStartCss}
            title="Text stack"
          >
            <div mix={typePreviewStackCss}>
              <p mix={[tokenTextResetCss, css({ color: theme.colors.text.primary })]}>
                theme.colors.text.primary
              </p>
              <p mix={[tokenTextResetCss, css({ color: theme.colors.text.secondary })]}>
                theme.colors.text.secondary
              </p>
              <p mix={[tokenTextResetCss, css({ color: theme.colors.text.muted })]}>
                theme.colors.text.muted
              </p>
              <p mix={[tokenTextResetCss, css({ color: theme.colors.text.link })]}>
                theme.colors.text.link
              </p>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={statusPreviewStackCss}>
  <button mix={ui.button.primary}>Primary action</button>
  <button mix={ui.button.danger}>Danger action</button>
  <span mix={[statusBadgeCss, ui.status.info]}>Info</span>
  <span mix={[statusBadgeCss, ui.status.success]}>Success</span>
</div>`}
            description="Action and status roles should feel related to the rest of the theme while still communicating priority and meaning."
            previewMix={docsExamplePreviewStartCss}
            title="Action and status"
          >
            <div mix={statusPreviewStackCss}>
              <button mix={ui.button.primary}>Primary action</button>
              <button mix={ui.button.danger}>Danger action</button>
              <span mix={[statusBadgeCss, ui.status.info]}>Info</span>
              <span mix={[statusBadgeCss, ui.status.success]}>Success</span>
            </div>
          </RecipeExample>
        </div>
      </section>
    </div>
  )
}

function ThemeTokenShadowPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <RecipeExample
          code={`<div mix={shadowPreviewGridCss}>
  <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.xs })]}>theme.shadow.xs</div>
  <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.sm })]}>theme.shadow.sm</div>
  <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.md })]}>theme.shadow.md</div>
  <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.lg })]}>theme.shadow.lg</div>
</div>`}
          description="Shadow tokens should make changes in depth and emphasis visible immediately when a theme changes."
          previewMix={docsExamplePreviewStartCss}
          title="Shadow samples"
        >
          <div mix={shadowPreviewGridCss}>
            <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.xs })]}>theme.shadow.xs</div>
            <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.sm })]}>theme.shadow.sm</div>
            <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.md })]}>theme.shadow.md</div>
            <div mix={[shadowTokenSampleCss, css({ boxShadow: theme.shadow.lg })]}>theme.shadow.lg</div>
          </div>
        </RecipeExample>
      </section>
    </div>
  )
}

function ThemeTokenMotionPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <div mix={exampleStackCss}>
          <RecipeExample
            code={`<div mix={motionPreviewStackCss}>
  <button mix={[ui.button.secondary, motionHoverSampleCss, css({ transitionDuration: theme.duration.fast })]}>
    Fast duration
  </button>
  <button mix={[ui.button.secondary, motionHoverSampleCss, css({ transitionDuration: theme.duration.normal })]}>
    Normal duration
  </button>
  <button mix={[ui.button.secondary, motionHoverSampleCss, css({ transitionDuration: theme.duration.slow })]}>
    Slow duration
  </button>
  <Glyph mix={[ui.icon.md, ui.animation.spin, css({ animationDuration: theme.duration.spin })]} name="spinner" />
</div>`}
            description="Duration tokens should control both transitions and longer-running activity indicators without hard-coding milliseconds into components."
            previewMix={docsExamplePreviewStartCss}
            title="Durations"
          >
            <div mix={motionPreviewStackCss}>
              <button
                mix={[
                  ui.button.secondary,
                  motionHoverSampleCss,
                  css({ transitionDuration: theme.duration.fast }),
                ]}
              >
                Fast duration
              </button>
              <button
                mix={[
                  ui.button.secondary,
                  motionHoverSampleCss,
                  css({ transitionDuration: theme.duration.normal }),
                ]}
              >
                Normal duration
              </button>
              <button
                mix={[
                  ui.button.secondary,
                  motionHoverSampleCss,
                  css({ transitionDuration: theme.duration.slow }),
                ]}
              >
                Slow duration
              </button>
              <Glyph
                mix={[ui.icon.md, ui.animation.spin, css({ animationDuration: theme.duration.spin })]}
                name="spinner"
              />
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={motionPreviewStackCss}>
  <button mix={[ui.button.secondary, motionHoverSampleCss, css({ transitionTimingFunction: theme.easing.standard })]}>
    Standard easing
  </button>
  <button mix={[ui.button.secondary, motionHoverSampleCss, css({ transitionTimingFunction: theme.easing.emphasized })]}>
    Emphasized easing
  </button>
</div>`}
            description="Easing tokens should give interactive elements a shared feel without each component choosing its own curve."
            previewMix={docsExamplePreviewStartCss}
            title="Easing"
          >
            <div mix={motionPreviewStackCss}>
              <button
                mix={[
                  ui.button.secondary,
                  motionHoverSampleCss,
                  css({ transitionTimingFunction: theme.easing.standard }),
                ]}
              >
                Standard easing
              </button>
              <button
                mix={[
                  ui.button.secondary,
                  motionHoverSampleCss,
                  css({ transitionTimingFunction: theme.easing.emphasized }),
                ]}
              >
                Emphasized easing
              </button>
            </div>
          </RecipeExample>
        </div>
      </section>
    </div>
  )
}

function ThemeTokenControlPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <section mix={sectionCss}>
        <div mix={exampleStackCss}>
          <RecipeExample
            code={`<div mix={controlPreviewStackCss}>
  <button mix={[ui.button.base, css({ minHeight: theme.control.height.sm })]}>theme.control.height.sm</button>
  <button mix={[ui.button.base, css({ minHeight: theme.control.height.md })]}>theme.control.height.md</button>
</div>`}
            description="Height tokens should keep small and medium controls aligned across buttons, fields, menus, and other compact interactions."
            previewMix={docsExamplePreviewStartCss}
            title="Control heights"
          >
            <div mix={controlPreviewStackCss}>
              <button mix={[ui.button.base, ui.button.tone.secondary, css({ minHeight: theme.control.height.sm })]}>
                theme.control.height.sm
              </button>
              <button mix={[ui.button.base, ui.button.tone.secondary, css({ minHeight: theme.control.height.md })]}>
                theme.control.height.md
              </button>
            </div>
          </RecipeExample>

          <RecipeExample
            code={`<div mix={controlPreviewStackCss}>
  <button mix={[ui.button.base, css({ paddingInline: theme.control.paddingInline.sm })]}>padding sm</button>
  <button mix={[ui.button.base, css({ paddingInline: theme.control.paddingInline.md })]}>padding md</button>
  <button mix={[ui.button.base, css({ paddingInline: theme.control.paddingInline.lg })]}>padding lg</button>
</div>`}
            description="Inline padding tokens set how compact or roomy control chrome feels without changing component markup."
            previewMix={docsExamplePreviewStartCss}
            title="Inline padding"
          >
            <div mix={controlPreviewStackCss}>
              <button
                mix={[ui.button.base, ui.button.tone.secondary, css({ paddingInline: theme.control.paddingInline.sm })]}
              >
                padding sm
              </button>
              <button
                mix={[ui.button.base, ui.button.tone.secondary, css({ paddingInline: theme.control.paddingInline.md })]}
              >
                padding md
              </button>
              <button
                mix={[ui.button.base, ui.button.tone.secondary, css({ paddingInline: theme.control.paddingInline.lg })]}
              >
                padding lg
              </button>
            </div>
          </RecipeExample>
        </div>
      </section>
    </div>
  )
}

function GlyphsPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Glyph contract"
        description="Glyphs are a sibling system to theme tokens: a fixed shared icon contract, a sprite sheet renderer, and a thin `<Glyph />` wrapper for app code and first-party components."
      >
        <div mix={exampleStackCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Usage</p>
              <h3 mix={ui.card.title}>Render the sheet once, then reference glyphs anywhere</h3>
              <p mix={ui.card.description}>
                The style tag stays in the head, while the glyph sprite lives in the body. Components
                only need the shared glyph names.
              </p>
            </div>
            <div mix={ui.card.body}>
              <pre mix={codeBlockCss}>
                <code mix={codeTextCss}>{renderHighlightedCode(`import {
  createGlyphSheet,
  Glyph,
  RMX_01_GLYPHS,
  ui,
} from "remix/ui"

let Glyphs = createGlyphSheet(RMX_01_GLYPHS)

<body>
  <Glyphs />
  <button mix={ui.button.primary}>
    <Glyph mix={ui.button.icon} name="add" />
    <span mix={ui.button.label}>New project</span>
  </button>
</body>`)}
                </code>
              </pre>
            </div>
          </article>

          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Built-in names</p>
              <h3 mix={ui.card.title}>The package owns a stable glyph vocabulary</h3>
            </div>
            <div mix={glyphPreviewGridCss}>
              {glyphNames.map(name => (
                <div key={name} mix={glyphPreviewItemCss}>
                  <Glyph mix={[ui.icon.md, glyphPreviewGlyphCss]} name={name} />
                  <code mix={ui.text.code}>{name}</code>
                </div>
              ))}
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="Icon sizing"
        description="A small shared icon scale is enough for most utilitarian app UI: compact navigation and menu icons, ordinary inline icons, and a slightly larger size for emphasis."
      >
        <article mix={ui.card.base}>
          <div mix={ui.card.header}>
            <p mix={ui.card.eyebrow}>Shared sizes</p>
            <h3 mix={ui.card.title}>`ui.icon.sm`, `ui.icon.md`, and `ui.icon.lg`</h3>
            <p mix={ui.card.description}>
              These mixins size the glyph itself. Layout-specific mixins like `ui.button.icon`
              still handle spacing and alignment inside controls.
            </p>
          </div>
          <div mix={glyphSizingRowCss}>
            <div mix={glyphSizingItemCss}>
              <Glyph mix={[ui.icon.sm, glyphPreviewGlyphCss]} name="search" />
              <code mix={ui.text.code}>ui.icon.sm</code>
            </div>
            <div mix={glyphSizingItemCss}>
              <Glyph mix={[ui.icon.md, glyphPreviewGlyphCss]} name="search" />
              <code mix={ui.text.code}>ui.icon.md</code>
            </div>
            <div mix={glyphSizingItemCss}>
              <Glyph mix={[ui.icon.lg, glyphPreviewGlyphCss]} name="search" />
              <code mix={ui.text.code}>ui.icon.lg</code>
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
        title="Text mixin overview"
        description="Text mixins provide the shared page-level voice of the system. They are the default vocabulary for headings, body copy, supporting notes, captions, and code."
      >
        <RecipeExample
          code={EXAMPLES.textPageTypography.code}
          description="Use page-level text roles when content sits in ordinary document flow and should read like part of the page rather than a surface-specific micro-layout."
          previewMix={docsExamplePreviewCenterCss}
          title="Page typography"
        >
          {EXAMPLES.textPageTypography.preview}
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
        title="Card mixin overview"
        description="Card mixins solve recurring shell and spacing problems: the outer surface, the header rhythm, body spacing, action alignment, and footer boundaries."
      >
        <RecipeExample
          code={EXAMPLES.cardStructuredSurface.code}
          description="Use the card layer for content panels, popovers, previews, settings groups, and any other surface that needs consistent slot rhythm."
          previewMix={docsExamplePreviewCenterCss}
          title="Structured surface"
        >
          {EXAMPLES.cardStructuredSurface.preview}
        </RecipeExample>
      </Section>

      <Section
        title="Anatomy and tones"
        description="This mixin family is really two things working together: structural slots and surface tone. Components can mix those pieces without inventing a new card model each time."
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
        description="The button API now supports both fast aliases and deliberate composition. Use the flat button mixins when they fit, or compose `base + size + tone` when you need more control."
      >
        <RecipeExample
          code={EXAMPLES.buttonAliases.code}
          description="These aliases are the quickest way to style ordinary actions. They already include `ui.button.base`, the default `md` size, and the matching tone."
          previewMix={docsExamplePreviewCenterCss}
          title="Everyday button aliases"
        >
          {EXAMPLES.buttonAliases.preview}
        </RecipeExample>
      </Section>

      <Section
        title="Composition"
        description="Use the composable model when you need a specific size, when you want to apply button styling to a link, or when a first-party component should build its own button shape from shared parts."
      >
        <div mix={pageSectionStackCss}>
          <RecipeExample
            code={EXAMPLES.buttonBaseSizeTone.code}
            description="Button mixins compose directly onto both `<button>` and `<a>`. This is the alternative to wrapper-heavy `asChild` patterns."
            previewMix={docsExamplePreviewCenterCss}
            title="Base, size, and tone"
          >
            {EXAMPLES.buttonBaseSizeTone.preview}
          </RecipeExample>
          <RecipeExample
            code={EXAMPLES.buttonSizes.code}
            description="Size is a separate layer. `ui.button.iconOnly` is for icon-only buttons and keeps the control square."
            previewMix={docsExamplePreviewCenterCss}
            title="Sizes"
          >
            {EXAMPLES.buttonSizes.preview}
          </RecipeExample>
        </div>
      </Section>

      <Section
        title="Slots and states"
        description="Buttons use slot mixins for icons and keep loading layout-stable by treating the spinner as just another icon."
      >
        <div mix={pageSectionStackCss}>
          <RecipeExample
            code={EXAMPLES.buttonSlotsStates.code}
            description={
              'Use `ui.button.icon` and `ui.button.label` for leading icons, trailing icons, and loading spinners. Add `ui.animation.spin` when the glyph should visibly indicate in-progress work.'
            }
            previewMix={docsExamplePreviewCenterCss}
            title="Icons, loading, and disabled"
          >
            {EXAMPLES.buttonSlotsStates.preview}
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
                <li>Mixins default real `button` elements to `type="button"`, so use `type="submit"` explicitly when needed.</li>
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
        title="Field mixin overview"
        description="Fields should not reinvent their own chrome or type. The field and field-text mixins keep forms aligned with the rest of the system."
      >
        <RecipeExample
          code={EXAMPLES.fieldStack.code}
          description="Labels, help text, and field chrome belong together. That gives first-party form components a strong default shape."
          previewMix={docsExamplePreviewCenterCss}
          title="Field stack"
        >
          {EXAMPLES.fieldStack.preview}
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeItemPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Item and status mixin overview"
        description="Rows and status treatments are the basis for menus, command surfaces, tabs, combobox options, and sidebar collections."
      >
        <RecipeExample
          code={EXAMPLES.itemStatus.code}
          description="Items should be useful as a boring default. Status treatments then add semantic tone without changing the row structure."
          previewMix={docsExamplePreviewCenterCss}
          title="Row primitives"
        >
          {EXAMPLES.itemStatus.preview}
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeNavPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Sidebar and nav mixin overview"
        description="The docs shell here is local, but the sidebar and navigation ingredients are useful application primitives that can be reused elsewhere."
      >
        <RecipeExample
          code={EXAMPLES.navDetail.code}
          description="These mixins should support settings rails, project navigation, and docs-style sidebars without requiring a wrapper-heavy layout API."
          previewMix={docsExamplePreviewCenterCss}
          title="Sidebar stack"
        >
          {EXAMPLES.navDetail.preview}
        </RecipeExample>
      </Section>
    </div>
  )
}

function UiRecipeLayoutPage() {
  return () => (
    <div mix={pageSectionStackCss}>
      <Section
        title="Row and stack mixin overview"
        description="These primitives cover the common flex mechanics that kept showing up as demo-only helpers: horizontal alignment, vertical rhythm, distribution, and wrapping."
      >
        <RecipeExample
          code={EXAMPLES.rowStack.code}
          description="Use `ui.row` and `ui.stack` for repeated flex mechanics, then add spacing with `ui.gap.*` instead of inventing purpose-built row helpers."
          previewMix={docsExamplePreviewCenterCss}
          title="Composed layout primitives"
        >
          {EXAMPLES.rowStack.preview}
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
        description="Components should mostly be ergonomic shells around behavior, shared mixins, and reusable blocks rather than isolated style islands."
      >
        <div mix={threeColumnGridCss}>
          <article mix={ui.card.base}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Button</p>
              <h3 mix={ui.card.title}>A thin wrapper over shared mixins</h3>
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
        description="The component library should eventually cover the usual app primitives, but the visual language should still come from shared mixins and theme values."
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
        title="Blocks vs demo shell"
        description="The docs shell here is not the package abstraction. What should travel into the system are reusable blocks like sidebar panels, carded rails, content sections, and shell ingredients."
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
              <h3 mix={ui.card.title}>Reusable blocks, not demo-specific wrappers</h3>
            </div>
            <div mix={ui.card.body}>
              <ul mix={bulletListCss}>
                <li>`ui.sidebar.*` for panel rhythm and section labeling</li>
                <li>`ui.nav.*` for compact application navigation items</li>
                <li>`ui.card.*` for content rails and side panels</li>
                <li>Blocks can be composed from those mixins without turning the docs shell itself into package API</li>
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
        <p mix={ui.text.eyebrow}>Mixin family</p>
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
              Open mixin page
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
  let pattern =
    /\b(?:ui|theme)(?:\.[A-Za-z0-9_]+)+|\b(?:createTheme|createGlyphSheet|Glyph|glyphNames)\b|\bRMX_01(?:_VALUES|_GLYPHS)?\b/g
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
  gap: '2px',
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

let exampleStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xl,
})

let lineHeightPreviewStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
  '& > * + *': {
    paddingTop: theme.space.lg,
    borderTop: `1px solid ${theme.colors.border.subtle}`,
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

let proofNavGlyphCss = css({
  color: theme.colors.text.muted,
  flexShrink: 0,
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

let proofChecklistCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

let proofChecklistItemCss = css({
  display: 'grid',
  gridTemplateColumns: '14px minmax(0, 1fr)',
  alignItems: 'start',
  gap: theme.space.sm,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let proofChecklistGlyphCss = css({
  marginTop: '2px',
  color: theme.colors.text.muted,
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
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
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

let menuItemGlyphCss = css({
  color: 'currentColor',
  flexShrink: 0,
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

let docsExampleBlockCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let docsExampleIntroCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
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

let docsExamplePreviewStartCss = css({
  alignItems: 'stretch',
  justifyContent: 'flex-start',
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

let tokenTextResetCss = css({
  margin: 0,
})

let typePreviewStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let spaceRowSampleCss = css({
  display: 'flex',
  alignItems: 'center',
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.surfaceSecondary,
})

let spaceDotCss = css({
  width: '18px',
  height: '18px',
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.text.link,
  flexShrink: 0,
})

let radiusPreviewGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.sm,
  width: '100%',
  '@media (max-width: 640px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
})

let radiusTokenSampleCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '84px',
  padding: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: theme.colors.background.surface,
  boxShadow: theme.shadow.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})

let colorStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let colorSwatchRowCss = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: '52px',
  padding: `${theme.space.sm} ${theme.space.md}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  boxSizing: 'border-box',
})

let statusPreviewStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.space.sm,
  width: '100%',
})

let shadowPreviewGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.md,
  width: '100%',
})

let shadowTokenSampleCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '84px',
  padding: theme.space.sm,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.colors.background.surface,
  color: theme.colors.text.secondary,
})

let motionPreviewStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.space.md,
  width: '100%',
})

let motionHoverSampleCss = css({
  transitionProperty: 'transform, background-color, color, border-color',
  transitionDuration: theme.duration.normal,
  '&:hover': {
    transform: 'translateX(8px)',
  },
})

let controlPreviewStackCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.space.sm,
  width: '100%',
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

let glyphPreviewGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.sm,
  padding: theme.space.lg,
  '@media (max-width: 640px)': {
    gridTemplateColumns: '1fr',
  },
})

let glyphPreviewItemCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minHeight: theme.control.height.md,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.surfaceSecondary,
})

let glyphPreviewGlyphCss = css({
  color: theme.colors.text.secondary,
  flexShrink: 0,
})

let glyphSizingRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  padding: theme.space.lg,
})

let glyphSizingItemCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minHeight: theme.control.height.md,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.colors.background.surfaceSecondary,
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

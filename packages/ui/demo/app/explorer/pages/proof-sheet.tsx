import { css } from 'remix/component'
import { Glyph, theme, ui } from 'remix/ui'

import { PageSection, pageStackCss } from '../page-primitives.tsx'

let metrics = [
  ['Stable', 'Availability', '99.97%', ui.status.success, 'primary'],
  ['12', 'Deploys', 'This week', ui.status.info, undefined],
  ['4m', 'Rollback', 'Average window', ui.status.warning, undefined],
  ['2', 'Alerts', 'Open incidents', ui.status.danger, undefined],
] as const

export function renderProofSheetPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Proof sheet"
        description="This page should answer the product question quickly: does the current theme and UI layer feel coherent when it looks like a real application?"
      >
        <article mix={[ui.card.base, proofShellCss]}>
          <header mix={toolbarCss}>
            <div mix={toolbarTitleCss}>
              <p mix={ui.text.eyebrow}>Workspace</p>
              <h3 mix={toolbarHeadingCss}>Release console</h3>
            </div>
            <div mix={toolbarActionsCss}>
              <button mix={ui.button.secondary}>
                <span mix={ui.button.label}>Export</span>
              </button>
              <button mix={ui.button.primary}>
                <Glyph mix={ui.button.icon} name="add" />
                <span mix={ui.button.label}>New release</span>
              </button>
            </div>
          </header>

          <div mix={layoutCss}>
            <aside mix={[ui.card.inset, sidebarCss]}>
              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Navigation</p>
                <nav aria-label="Proof sheet navigation" mix={ui.nav.list}>
                  <a href="/proof-sheet" aria-current="page" mix={ui.nav.itemActive}>
                    <Glyph mix={[ui.icon.sm, navGlyphCss]} name="menu" />
                    Overview
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    <Glyph mix={[ui.icon.sm, navGlyphCss]} name="search" />
                    Deployments
                  </a>
                  <a href="/proof-sheet" mix={ui.nav.item}>
                    <Glyph mix={[ui.icon.sm, navGlyphCss]} name="spinner" />
                    Logs
                  </a>
                </nav>
              </div>

              <div mix={ui.sidebar.section}>
                <p mix={ui.sidebar.heading}>Environment</p>
                <div mix={sidebarMetaCss}>
                  <div mix={metaRowCss}>
                    <span mix={ui.text.caption}>Status</span>
                    <span mix={[statusBadgeCss, ui.status.success]}>Healthy</span>
                  </div>
                  <div mix={metaRowCss}>
                    <span mix={ui.text.caption}>Version</span>
                    <span mix={ui.text.bodySm}>v0.19.4</span>
                  </div>
                  <div mix={metaRowCss}>
                    <span mix={ui.text.caption}>Owner</span>
                    <span mix={ui.text.bodySm}>Platform team</span>
                  </div>
                </div>
              </div>
            </aside>

            <div mix={mainCss}>
              <div mix={metricsGridCss}>
                {metrics.map(([badge, label, value, statusMix, dataId]) => (
                  <article
                    key={label}
                    data-proof-card={dataId}
                    mix={[ui.card.base, metricCardCss]}
                  >
                    <div mix={metricHeaderCss}>
                      <span mix={[statusBadgeCss, statusMix]}>{badge}</span>
                      <span mix={ui.text.caption}>{label}</span>
                    </div>
                    <div mix={ui.card.header}>
                      <h3 mix={ui.card.title}>{value}</h3>
                    </div>
                  </article>
                ))}
              </div>

              <div mix={contentGridCss}>
                <article mix={[ui.card.base, uiCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Release checklist</p>
                    <h3 mix={ui.card.title}>Operational readability</h3>
                    <p mix={ui.card.description}>
                      Dense task surfaces should still feel calm enough to trust under pressure.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <ul mix={checklistCss}>
                      <li mix={checklistItemCss}>
                        <Glyph mix={[ui.icon.sm, checklistGlyphCss]} name="check" />
                        Verify migrations before the deploy starts.
                      </li>
                      <li mix={checklistItemCss}>
                        <Glyph mix={[ui.icon.sm, checklistGlyphCss]} name="alert" />
                        Hold background workers during the first rollout window.
                      </li>
                      <li mix={checklistItemCss}>
                        <Glyph mix={[ui.icon.sm, checklistGlyphCss]} name="check" />
                        Run smoke tests before enabling the queue.
                      </li>
                    </ul>
                  </div>
                  <div mix={ui.card.footer}>
                    <p mix={[ui.text.caption, footerMetaCss]}>Updated 18 minutes ago</p>
                    <button mix={ui.button.secondary}>
                      <span mix={ui.button.label}>Open runbook</span>
                      <Glyph mix={ui.button.icon} name="chevronRight" />
                    </button>
                  </div>
                </article>

                <article mix={[ui.card.elevated, uiCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Quick action</p>
                    <h3 mix={ui.card.title}>Invite collaborator</h3>
                    <p mix={ui.card.description}>
                      Form chrome, spacing, and actions should still feel like part of the same
                      system.
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
                      mix={[ui.field.base, inputCss]}
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

                <article mix={[ui.card.base, uiCardCss]}>
                  <div mix={ui.card.header}>
                    <p mix={ui.card.eyebrow}>Menu surface</p>
                    <h3 mix={ui.card.title}>Popup UI should stay related</h3>
                    <p mix={ui.card.description}>
                      Menus and listboxes should look like siblings of the rest of the interface.
                    </p>
                  </div>
                  <div mix={ui.card.body}>
                    <div mix={[ui.menu.popover, staticPopoverCss]}>
                      <div role="menu" aria-label="Project actions" mix={ui.menu.list}>
                        <button type="button" role="menuitem" mix={ui.menu.item}>
                          <Glyph mix={ui.menu.itemGlyph} name="search" />
                          <span mix={ui.menu.itemLabel}>Rename project</span>
                        </button>
                        <button type="button" role="menuitem" mix={ui.menu.trigger}>
                          <span mix={ui.menu.itemLabel}>Copy environment</span>
                          <Glyph mix={ui.menu.triggerGlyph} name="chevronRight" />
                        </button>
                        <button type="button" role="menuitem" mix={[ui.menu.item, dangerItemCss]}>
                          <Glyph mix={ui.menu.itemGlyph} name="close" />
                          <span mix={ui.menu.itemLabel}>Archive project</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </article>
      </PageSection>
    </div>
  )
}

let proofShellCss = css({
  gap: theme.space.lg,
  padding: theme.space.lg,
})

let toolbarCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  paddingBottom: theme.space.md,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  '@media (max-width: 780px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

let toolbarTitleCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let toolbarHeadingCss = css({
  margin: 0,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let toolbarActionsCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

let layoutCss = css({
  display: 'grid',
  gridTemplateColumns: '240px minmax(0, 1fr)',
  gap: theme.space.md,
  '@media (max-width: 960px)': {
    gridTemplateColumns: '1fr',
  },
})

let sidebarCss = css({
  gap: theme.space.md,
  padding: theme.space.md,
})

let navGlyphCss = css({
  color: theme.colors.text.muted,
})

let sidebarMetaCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let metaRowCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  minHeight: theme.control.height.sm,
})

let mainCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  minWidth: 0,
})

let metricsGridCss = css({
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
  minHeight: '132px',
})

let metricHeaderCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
})

let contentGridCss = css({
  display: 'grid',
  gridTemplateColumns: '1.4fr 1fr',
  gap: theme.space.md,
  '@media (max-width: 1080px)': {
    gridTemplateColumns: '1fr',
  },
})

let uiCardCss = css({
  gap: theme.space.md,
})

let checklistCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

let checklistItemCss = css({
  display: 'grid',
  gridTemplateColumns: '14px minmax(0, 1fr)',
  alignItems: 'start',
  gap: theme.space.sm,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let checklistGlyphCss = css({
  marginTop: '2px',
  color: theme.colors.text.muted,
})

let footerMetaCss = css({
  margin: 0,
  marginRight: 'auto',
})

let inputCss = css({
  width: '100%',
})

let staticPopoverCss = css({
  position: 'relative',
  inset: 'auto',
  opacity: 1,
})

let dangerItemCss = css({
  color: theme.colors.status.danger.foreground,
  borderColor: theme.colors.status.danger.border,
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

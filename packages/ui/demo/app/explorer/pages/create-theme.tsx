import { ExplorerExampleCard } from '../example-card.tsx'
import {
  compactGridCss,
  eyebrowTextCss,
  PageSection,
  panelCss,
  panelHeaderCss,
  panelDescriptionTextCss,
  panelTitleTextCss,
  pageStackCss,
  tokenChipCss,
  tokenChipRowCss,
} from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderCreateThemePage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Create a theme"
        description="The core workflow is simple: define values with `createTheme(...)`, scope them if needed, and keep consuming the same shared `theme` contract plus the button and component styling namespaces."
      >
        <ExplorerExampleCard example={EXAMPLES.createThemeLocal} />
      </PageSection>

      <PageSection
        title="What the built-in theme already proves"
        description="The built-in theme is useful as a reference implementation because it already exercises the full token surface area."
      >
        <div mix={compactGridCss}>
          <article mix={panelCss}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Geometry</p>
              <h3 mix={panelTitleTextCss}>Layout and shape</h3>
              <p mix={panelDescriptionTextCss}>
                These are the values that most directly affect density and the feel of controls and
                surfaces.
              </p>
            </div>
            <div mix={tokenChipRowCss}>
              <span mix={tokenChipCss}>space</span>
              <span mix={tokenChipCss}>radius</span>
              <span mix={tokenChipCss}>control.height</span>
              <span mix={tokenChipCss}>surface</span>
            </div>
          </article>

          <article mix={panelCss}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Type and motion</p>
              <h3 mix={panelTitleTextCss}>System rhythm</h3>
              <p mix={panelDescriptionTextCss}>
                These groups shape hierarchy, scanning speed, and interaction feel before any
                component-specific decisions exist.
              </p>
            </div>
            <div mix={tokenChipRowCss}>
              <span mix={tokenChipCss}>fontFamily</span>
              <span mix={tokenChipCss}>fontSize</span>
              <span mix={tokenChipCss}>fontWeight</span>
              <span mix={tokenChipCss}>lineHeight</span>
              <span mix={tokenChipCss}>letterSpacing</span>
              <span mix={tokenChipCss}>duration</span>
              <span mix={tokenChipCss}>easing</span>
            </div>
          </article>

          <article mix={panelCss}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Color and depth</p>
              <h3 mix={panelTitleTextCss}>Visual hierarchy</h3>
              <p mix={panelDescriptionTextCss}>
                These groups let a theme change emphasis, state, and mood while preserving the same
                component code.
              </p>
            </div>
            <div mix={tokenChipRowCss}>
              <span mix={tokenChipCss}>colors.text</span>
              <span mix={tokenChipCss}>colors.border</span>
              <span mix={tokenChipCss}>colors.action</span>
              <span mix={tokenChipCss}>shadow</span>
              <span mix={tokenChipCss}>zIndex</span>
            </div>
          </article>
        </div>
      </PageSection>
    </div>
  )
}

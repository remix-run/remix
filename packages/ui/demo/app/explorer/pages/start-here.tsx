import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import {
  featureGridCss,
  noteCardCss,
  noteListCss,
  PageSection,
  pageStackCss,
  tokenGroupGridCss,
} from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderStartHerePage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Three layers, one system"
        description="Start here if you want the shortest explanation of what ships today and where each kind of decision belongs."
      >
        <div mix={featureGridCss}>
          <ExplorerExampleCard example={EXAMPLES.startHereTheme} title="Theme" />
          <ExplorerExampleCard example={EXAMPLES.startHereUi} title="UI" />
          <ExplorerExampleCard
            example={EXAMPLES.breadcrumbsBasic}
            title="Components"
            description="Components should stay thin convenience or behavior wrappers that sit on top of the shared theme and UI layers."
          />
        </div>
      </PageSection>

      <PageSection
        title="Rules of thumb"
        description="The goal is to keep responsibility obvious in both API design and day-to-day app code."
      >
        <div mix={tokenGroupGridCss}>
          <article mix={[ui.card.base, noteCardCss]}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Theme</p>
              <h3 mix={ui.card.title}>Raw values</h3>
            </div>
            <ul mix={noteListCss}>
              <li>Use `theme.*` when you need a specific surface, gap, radius, type, or color role.</li>
              <li>The theme contract should stay stable and boring to consume.</li>
            </ul>
          </article>

          <article mix={[ui.card.base, noteCardCss]}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>UI</p>
              <h3 mix={ui.card.title}>Reusable styling roles</h3>
            </div>
            <ul mix={noteListCss}>
              <li>`ui.*` should capture recurring structure and semantic styling, not speculative abstractions.</li>
              <li>Popup-backed controls can share theme values while keeping separate component-owned contracts.</li>
            </ul>
          </article>

          <article mix={[ui.card.base, noteCardCss]}>
            <div mix={ui.card.header}>
              <p mix={ui.card.eyebrow}>Components</p>
              <h3 mix={ui.card.title}>Markup, behavior, ergonomics</h3>
            </div>
            <ul mix={noteListCss}>
              <li>Components should solve semantics, state, and interaction before they invent style islands.</li>
              <li>When the styling layer is strong, component APIs can stay smaller.</li>
            </ul>
          </article>
        </div>
      </PageSection>
    </div>
  )
}

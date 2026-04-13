import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let menuExamples = [EXAMPLES.menuButtonOverview, EXAMPLES.menuButtonBubbling]

export function renderComponentMenuPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Menu"
        description="Menu reuses the popup foundation but stays action-oriented instead of value-oriented. The public API should stay small and event-driven."
      >
        <div mix={exampleGridCss}>
          {menuExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Use Menu when the popup offers commands rather than a committed value.</li>
              <li>Listen for `Menu.select` on the menu or any ancestor and let bubbling do the work.</li>
              <li>Keep `ui.menu.*` separate from `ui.listbox.*` even when both point at the same theme values today.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}

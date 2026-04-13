import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let accordionExamples = [
  EXAMPLES.accordionOverview,
  EXAMPLES.accordionCard,
  EXAMPLES.accordionMultiple,
]

export function renderComponentAccordionPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Accordion"
        description="Accordion is the clearest current example of how visuals can stay shared while the component owns behavior, context, and events."
      >
        <div mix={exampleGridCss}>
          {accordionExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Use single mode when one section usually stays open.</li>
              <li>Use multiple mode for operational surfaces where parallel reading is common.</li>
              <li>Listen with `on(Accordion.change, ...)` instead of asking the component for app-specific state APIs.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const accordionExamples = [
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
    </div>
  )
}

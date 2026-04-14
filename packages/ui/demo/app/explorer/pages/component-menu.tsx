import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const menuExamples = [EXAMPLES.menuButtonOverview, EXAMPLES.menuButtonBubbling]

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
    </div>
  )
}

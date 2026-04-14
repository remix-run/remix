import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const breadcrumbExamples = [EXAMPLES.breadcrumbsBasic, EXAMPLES.breadcrumbsSeparator]

export function renderComponentBreadcrumbsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Breadcrumbs"
        description="This component is intentionally small. It should be a faster way to get to good output, not a wrapper that traps you."
      >
        <div mix={exampleGridCss}>
          {breadcrumbExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}

import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let breadcrumbExamples = [
  EXAMPLES.breadcrumbsBasic,
  EXAMPLES.breadcrumbsSeparator,
  EXAMPLES.breadcrumbsDecomposed,
]

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

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Use the component when the ordinary breadcrumb trail is enough.</li>
              <li>Change the separator when the app wants a different visual language.</li>
              <li>Drop back to plain `nav`, `ol`, and primitives when the layout needs to diverge.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}

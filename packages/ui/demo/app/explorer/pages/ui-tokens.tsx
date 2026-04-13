import { ExplorerExampleCard } from '../example-card.tsx'
import { compactGridCss, exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let uiFoundationExamples = [
  EXAMPLES.textPageTypography,
  EXAMPLES.cardStructuredSurface,
  EXAMPLES.buttonBaseSizeTone,
  EXAMPLES.fieldStack,
  EXAMPLES.navDetail,
]

let popupExamples = [EXAMPLES.popoverContract, EXAMPLES.menuContract, EXAMPLES.listboxContract]

export function renderUiTokensPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Everyday UI tokens"
        description="This layer should make the common styling decisions in app code and first-party components feel repetitive in a good way."
      >
        <div mix={exampleGridCss}>
          {uiFoundationExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Layout mechanics"
        description="Rows and stacks are intentionally boring. They should be fast to remember and easy to compose."
      >
        <div mix={compactGridCss}>
          <ExplorerExampleCard example={EXAMPLES.rowStack} />
        </div>
      </PageSection>

      <PageSection
        title="Popup family contracts"
        description="Popup-backed controls can still share theme values without collapsing into one public UI contract."
      >
        <div mix={exampleGridCss}>
          {popupExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}

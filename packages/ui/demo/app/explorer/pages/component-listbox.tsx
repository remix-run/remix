import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let listboxExamples = [
  EXAMPLES.selectOverview,
  EXAMPLES.listboxPopover,
  EXAMPLES.listboxStatic,
  EXAMPLES.listboxStaticMultiple,
]

export function renderComponentListboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Listbox"
        description="Listbox starts headless, composes directly into a popover surface, and now also powers a thin `Select` convenience component for the ordinary popup-backed value-control shape."
      >
        <div mix={exampleGridCss}>
          {listboxExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>
                Reach for `Select` when you want the ordinary single-select button + popover pattern
                without assembling the pieces yourself.
              </li>
              <li>
                Use `listbox.context`, `listbox.list()`, and `listbox.option()` for the current
                supported surface.
              </li>
              <li>
                Keep focus on the list root and let `aria-activedescendant` describe the active
                option.
              </li>
              <li>Handle selection with `on(listbox.change, ...)` on the list or any ancestor.</li>
              <li>
                Inside popovers, put `popover.initialFocus()` on the list and close the surface with
                a local ref when selection changes.
              </li>
              <li>
                In multiple mode, Space toggles the focused option and Enter keeps only the focused
                option selected.
              </li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}

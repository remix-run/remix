import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

export const DemoSourceBehavior = clientEntry(
  import.meta.url,
  function DemoSourceBehavior(handle: Handle<{ sourceId: string }>) {
    return () => {
      handle.queueTask((signal) => {
        let code = document.getElementById(handle.props.sourceId)
        let source = code?.closest<HTMLElement>('.docs-demo-source')
        let button = source?.querySelector('button[aria-controls]')
        if (!code || !source || !button) return

        button.addEventListener(
          'click',
          () => {
            let expanded = button.getAttribute('aria-expanded') !== 'true'
            source.dataset.expanded = String(expanded)
            code.inert = !expanded
            code.setAttribute('aria-hidden', String(!expanded))
            button.setAttribute('aria-expanded', String(expanded))
            button.textContent = expanded ? 'Hide code' : 'Show code'
            if (!expanded) button.scrollIntoView({ block: 'start' })
          },
          { signal },
        )
      })
      return null
    }
  },
)

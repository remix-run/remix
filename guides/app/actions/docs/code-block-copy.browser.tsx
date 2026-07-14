import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

export const CodeBlockCopyButtons = clientEntry(
  import.meta.url,
  function CodeBlockCopyButtons(handle: Handle<{ rootId: string }>) {
    let copiedTimers = new WeakMap<HTMLButtonElement, number>()

    handle.queueTask((signal) => {
      let root = document.getElementById(handle.props.rootId)
      if (!root) return

      root.addEventListener('click', handleClick)
      signal.addEventListener('abort', () => root.removeEventListener('click', handleClick))
    })

    return () => null

    async function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return

      let button = event.target.closest<HTMLButtonElement>('[data-code-block-copy]')
      if (!button) return

      let codeBlock = button.closest<HTMLElement>('[data-code-block]')
      let text = codeBlock?.querySelector('pre')?.textContent
      if (!text) return

      event.preventDefault()

      try {
        await navigator.clipboard.writeText(text)
      } catch {
        return
      }

      button.dataset.copied = 'true'

      let copiedTimer = copiedTimers.get(button)
      if (copiedTimer !== undefined) {
        window.clearTimeout(copiedTimer)
      }

      copiedTimers.set(
        button,
        window.setTimeout(() => {
          delete button.dataset.copied
          copiedTimers.delete(button)
        }, 1500),
      )
    }
  },
)

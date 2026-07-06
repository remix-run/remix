import { clientEntry, css } from 'remix/ui'
import type { Handle } from 'remix/ui'

const copyIconMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='13' height='13' x='9' y='9' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E")`
const checkIconMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E")`
const activeCopyButtonSelector =
  '& [data-code-block-copy]:hover, & [data-code-block-copy]:focus, & [data-code-block-copy][data-copied="true"]'

export const codeBlockCopyStyles = css({
  '& [data-code-block]': {
    position: 'relative',
    margin: '1rem 0',
  },
  '& [data-code-block-filename]': {
    display: 'block',
    overflow: 'hidden',
    padding:
      'calc(var(--rmx-space-sm) + var(--rmx-space-xs)) calc(var(--rmx-space-xl) + var(--rmx-space-lg)) calc(var(--rmx-space-sm) + var(--rmx-space-xs)) var(--rmx-space-lg)',
    border: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
    borderRadius: 'var(--rmx-radius-md) var(--rmx-radius-md) 0 0',
    background: 'var(--rmx-surface-lvl2)',
    color: 'var(--rmx-color-text-secondary)',
    fontFamily: 'var(--rmx-font-family-mono)',
    fontSize: 'var(--rmx-font-size-sm)',
    lineHeight: 1.4,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& [data-code-block-copy]': {
    position: 'absolute',
    top: 'var(--rmx-space-lg)',
    right: 'var(--rmx-space-lg)',
    width: 'var(--rmx-font-size-lg)',
    height: 'var(--rmx-font-size-lg)',
    padding: 0,
    border: 0,
    background: 'var(--rmx-color-text-muted)',
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 150ms ease, background 150ms ease',
    mask: `${copyIconMask} center / cover no-repeat`,
  },
  '& [data-code-block]:hover [data-code-block-copy], & [data-code-block-copy]:focus': {
    opacity: 1,
  },
  '& [data-code-block-filename] + pre + [data-code-block-copy]': {
    top: 'var(--rmx-space-md)',
  },
  [activeCopyButtonSelector]: {
    background: 'var(--rmx-color-text-secondary)',
  },
  '& [data-code-block-copy][data-copied="true"]': {
    opacity: 1,
    maskImage: checkIconMask,
  },
  '& [data-code-block-copy] span': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
})

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

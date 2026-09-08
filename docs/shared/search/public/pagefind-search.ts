const FULL_TRIGGER_ID = 'docs-search-button'
const COMPACT_TRIGGER_ID = 'docs-search-compact'
const TRIGGER_SELECTOR = `#${FULL_TRIGGER_ID}, #${COMPACT_TRIGGER_ID}`

export function startPagefindSearch(): () => void {
  function handleClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return

    let trigger = event.target.closest(TRIGGER_SELECTOR)
    if (trigger instanceof HTMLElement) void openPagefindSearch(trigger)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.key.toLowerCase() !== 'k' ||
      (!event.metaKey && !event.ctrlKey) ||
      event.altKey ||
      event.shiftKey
    ) {
      return
    }

    let activeElement = document.activeElement
    if (
      activeElement instanceof HTMLElement &&
      (activeElement.matches('input, textarea') || activeElement.isContentEditable)
    ) {
      return
    }

    let trigger = resolveSearchTrigger()
    if (!trigger) return

    event.preventDefault()
    void openPagefindSearch(trigger)
  }

  document.addEventListener('click', handleClick)
  document.addEventListener('keydown', handleKeydown)

  return () => {
    document.removeEventListener('click', handleClick)
    document.removeEventListener('keydown', handleKeydown)
  }
}

async function openPagefindSearch(trigger: HTMLElement): Promise<void> {
  await customElements.whenDefined('pagefind-modal')

  let modal = document.querySelector('pagefind-modal')
  if (!(modal instanceof HTMLElement) || !trigger.isConnected) return

  let open = Reflect.get(modal, 'open')
  if (typeof open !== 'function') return

  let dialog = modal.querySelector('dialog')
  if (dialog?.open) return

  document.getElementById(COMPACT_TRIGGER_ID)?.setAttribute('aria-expanded', 'false')
  document.getElementById(FULL_TRIGGER_ID)?.setAttribute('aria-expanded', 'false')
  if (dialog?.id) trigger.setAttribute('aria-controls', dialog.id)
  trigger.setAttribute('aria-expanded', 'true')
  dialog?.addEventListener(
    'close',
    () => {
      trigger.setAttribute('aria-expanded', 'false')
      if (trigger.isConnected) trigger.focus()
    },
    { once: true },
  )
  open.call(modal)
}

export function closePagefindSearch(): void {
  let modal = document.querySelector('pagefind-modal')
  if (modal instanceof HTMLElement) {
    let close = Reflect.get(modal, 'close')
    if (typeof close === 'function') close.call(modal)
  }

  document.getElementById(COMPACT_TRIGGER_ID)?.blur()
  document.getElementById(FULL_TRIGGER_ID)?.blur()
}

function resolveSearchTrigger(): HTMLElement | null {
  let compactTrigger = document.getElementById(COMPACT_TRIGGER_ID)
  if (
    compactTrigger instanceof HTMLElement &&
    document.documentElement.hasAttribute('data-docs-nav-collapsed') &&
    window.matchMedia('(width >= 900px)').matches
  ) {
    return compactTrigger
  }

  let fullTrigger = document.getElementById(FULL_TRIGGER_ID)
  return fullTrigger instanceof HTMLElement ? fullTrigger : null
}

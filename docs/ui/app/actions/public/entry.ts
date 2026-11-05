import { runDocsApp } from 'remix-docs-shared/app/browser'

const app = runDocsApp()

app
  .ready()
  .then(revealApiFragment)
  .catch(() => {})

window.addEventListener('hashchange', revealApiFragment)

function revealApiFragment() {
  let id: string
  try {
    id = decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return
  }
  let target = document.getElementById(id)
  if (!target?.classList.contains('ui-api-entry-content')) return
  let disclosure = target.closest('details')
  // Browsers reveal a fragment inside closed details on navigation, but may
  // restore its scroll position without opening the disclosure on reload.
  if (disclosure && !disclosure.open) {
    disclosure.open = true
    target.scrollIntoView()
  }
}

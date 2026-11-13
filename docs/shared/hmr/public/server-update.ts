import type { run } from 'remix/component'

export function reloadOnServerUpdate(app: ReturnType<typeof run>): void {
  import.meta.hot?.on('server:update', async () => {
    await app.ready()
    await restoreStylesheetHrefs()
    await app.frames.top.reload()
  })
}

// CSS hot updates point `<link>` elements at cache-busted `?t=` URLs. Restore the rendered URLs
// before re-rendering, otherwise the re-render swaps them back and flashes unstyled content.
async function restoreStylesheetHrefs(): Promise<void> {
  let links = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"][href*="t="]:not([data-remix-hmr-stylesheet])',
  )
  await Promise.all(Array.from(links, restoreStylesheetHref))
}

function restoreStylesheetHref(link: HTMLLinkElement): Promise<void> {
  let url = new URL(link.href)
  if (url.origin !== window.location.origin || !url.searchParams.has('t')) return Promise.resolve()
  url.searchParams.delete('t')

  return new Promise((resolve) => {
    let next = link.cloneNode() as HTMLLinkElement
    next.href = url.pathname + url.search
    next.onload = next.onerror = () => {
      link.remove()
      resolve()
    }
    link.after(next)
  })
}

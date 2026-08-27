const SERVER_MODULE_PRELOAD_SELECTOR = 'link[data-rmx-module-preload][rel~="modulepreload" i][href]'

interface ModulePreloader {
  adoptInitialPreloadLinks(source: ParentNode): void
  consumePreloadLinks(source: ParentNode): void
  hasActivePreloads(): boolean
  isActivePreload(node: Node): boolean
}

const modulePreloaders = new WeakMap<Document, ModulePreloader>()

export function getDocumentModulePreloader(doc: Document): ModulePreloader {
  let preloader = modulePreloaders.get(doc)
  if (!preloader) {
    preloader = createModulePreloader(doc)
    modulePreloaders.set(doc, preloader)
  }
  return preloader
}

function createModulePreloader(doc: Document): ModulePreloader {
  let requestedUrls = new Set<string>()
  let activeLinks = new WeakSet<HTMLLinkElement>()
  let activeLinkCount = 0

  function activateLink(link: HTMLLinkElement): void {
    activeLinks.add(link)
    activeLinkCount++
  }

  function deactivateLink(link: HTMLLinkElement): void {
    if (activeLinks.delete(link)) activeLinkCount--
  }

  function preload(href: string): void {
    let link = doc.createElement('link')
    link.rel = 'modulepreload'
    link.href = href
    link.setAttribute('data-rmx-module-preload', '')
    let url = link.href
    if (requestedUrls.has(url)) return
    requestedUrls.add(url)

    activateLink(link)
    link.addEventListener(
      'load',
      () => {
        deactivateLink(link)
        link.remove()
      },
      { once: true },
    )
    link.addEventListener(
      'error',
      () => {
        deactivateLink(link)
        link.remove()
        requestedUrls.delete(url)
      },
      { once: true },
    )
    doc.head.append(link)
  }

  return {
    adoptInitialPreloadLinks(source) {
      for (let initialLink of source.querySelectorAll<HTMLLinkElement>(
        SERVER_MODULE_PRELOAD_SELECTOR,
      )) {
        if (activeLinks.has(initialLink)) continue

        // An identical link joins the document's existing module-map request and receives its own
        // terminal event, even when the parser-created link settled before runtime startup.
        let observerLink = doc.createElement('link')
        observerLink.rel = 'modulepreload'
        observerLink.href = initialLink.href
        observerLink.setAttribute('data-rmx-module-preload', '')
        let url = initialLink.href
        requestedUrls.add(url)
        activateLink(initialLink)
        activateLink(observerLink)

        let settled = false
        function settle(succeeded: boolean): void {
          if (settled) return
          settled = true
          deactivateLink(initialLink)
          deactivateLink(observerLink)
          initialLink.remove()
          observerLink.remove()
          if (!succeeded) requestedUrls.delete(url)
        }

        observerLink.addEventListener('load', () => settle(true), { once: true })
        observerLink.addEventListener('error', () => settle(false), { once: true })
        doc.head.append(observerLink)
      }
    },
    consumePreloadLinks(source) {
      let hrefs: string[] = []
      for (let link of source.querySelectorAll<HTMLLinkElement>(SERVER_MODULE_PRELOAD_SELECTOR)) {
        let href = link.getAttribute('href')
        link.remove()
        if (href) hrefs.push(href)
      }
      for (let href of hrefs) preload(href)
    },
    hasActivePreloads() {
      return activeLinkCount > 0
    },
    isActivePreload(node) {
      return node instanceof HTMLLinkElement && activeLinks.has(node)
    },
  }
}

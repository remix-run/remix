const documentReloadInfo = 'remix-document-reload'

export function isDocumentReload(info: unknown): boolean {
  return info === documentReloadInfo
}

export function reloadDocument(doc: Document, href = doc.location.href): void {
  let navigation = doc.defaultView?.navigation
  if (navigation) {
    navigation.navigate(href, { history: 'replace', info: documentReloadInfo })
  } else {
    doc.location.replace(href)
  }
}

export function reloadCurrentDocument(doc: Document): void {
  let navigation = doc.defaultView?.navigation
  if (navigation && typeof navigation.reload === 'function') {
    navigation.reload({ info: documentReloadInfo })
  } else {
    doc.location.reload()
  }
}

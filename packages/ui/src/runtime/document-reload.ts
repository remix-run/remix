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

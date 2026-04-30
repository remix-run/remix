if (typeof document !== 'undefined' && !document.adoptedStyleSheets) {
  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    value: [],
    writable: true,
  })
}

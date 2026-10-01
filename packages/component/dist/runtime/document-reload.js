const documentReloadInfo = 'remix-document-reload';
export function isDocumentReload(info) {
    return info === documentReloadInfo;
}
export function reloadDocument(doc, href = doc.location.href) {
    let navigation = doc.defaultView?.navigation;
    if (navigation) {
        navigation.navigate(href, { history: 'replace', info: documentReloadInfo });
    }
    else {
        doc.location.replace(href);
    }
}
export function reloadCurrentDocument(doc) {
    let navigation = doc.defaultView?.navigation;
    if (navigation && typeof navigation.reload === 'function') {
        navigation.reload({ info: documentReloadInfo });
    }
    else {
        doc.location.reload();
    }
}
//# sourceMappingURL=document-reload.js.map
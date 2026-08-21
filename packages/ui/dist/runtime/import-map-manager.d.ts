interface ImportMapManager {
    consumeImportMaps(source: ParentNode): void;
    shouldPreserveHeadNode(node: Node): boolean;
}
export declare function getDocumentImportMapManager(doc: Document): ImportMapManager;
export {};

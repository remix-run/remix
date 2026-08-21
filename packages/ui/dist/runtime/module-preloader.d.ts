interface ModulePreloader {
    adoptInitialPreloadLinks(source: ParentNode): void;
    consumePreloadLinks(source: ParentNode): void;
    hasActivePreloads(): boolean;
    isActivePreload(node: Node): boolean;
}
export declare function getDocumentModulePreloader(doc: Document): ModulePreloader;
export {};

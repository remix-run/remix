interface ModulePreloader {
    adoptInitialPreloadLinks(source: ParentNode): void;
    consumePreloadLinks(source: ParentNode, process?: ProcessClientEntryPreloads): Promise<void>;
    hasActivePreloads(): boolean;
    isActivePreload(node: Node): boolean;
}
export type ProcessClientEntryPreloads = (preloads: string[]) => string[] | Promise<string[]>;
export declare function getDocumentModulePreloader(doc: Document): ModulePreloader;
export {};

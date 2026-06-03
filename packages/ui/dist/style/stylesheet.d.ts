export type ServerStyleSource = ParentNode | Iterable<Node>;
export interface StyleManager {
    insert(className: string, rule: string): void;
    remove(className: string): void;
    has(className: string): boolean;
    getGeneration(): number;
    reset(): void;
    adoptServerStyles(source: ServerStyleSource): Set<string>;
    replaceServerStyles(source: ServerStyleSource): void;
    selectors(): IterableIterator<string>;
    dispose(): void;
}
export declare function createStyleManager(layer?: string): StyleManager;

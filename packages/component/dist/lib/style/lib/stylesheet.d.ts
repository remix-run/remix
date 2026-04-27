type ServerStyleSource = ParentNode | Iterable<Node>;
export declare function createStyleManager(layer?: string): {
    insert: (className: string, rule: string) => void;
    remove: (className: string) => void;
    has: (className: string) => boolean;
    reset: () => void;
    adoptServerStyles: (source: ServerStyleSource) => void;
    dispose: () => void;
};
export {};

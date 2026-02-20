export declare function createStyleManager(layer?: string): {
    insert: (className: string, rule: string) => void;
    remove: (className: string) => void;
    has: (className: string) => boolean;
    dispose: () => void;
};

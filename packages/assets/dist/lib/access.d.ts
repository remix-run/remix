type AccessPolicy = {
    isAllowed(filePath: string): boolean;
};
export declare function createAccessPolicy(options: {
    allow: readonly string[];
    deny?: readonly string[];
    rootDir: string;
}): AccessPolicy;
export {};
//# sourceMappingURL=access.d.ts.map
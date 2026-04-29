export interface HelpTextSectionRow {
    description: string;
    label: string;
}
export interface HelpTextOptions {
    commands?: HelpTextSectionRow[];
    description?: string;
    examples?: string[];
    options?: HelpTextSectionRow[];
    usage: string[];
}
export declare function formatHelpText(options: HelpTextOptions, target?: NodeJS.WriteStream): string;
//# sourceMappingURL=help-text.d.ts.map
export declare function configureColors(options: {
    disabled: boolean;
}): void;
export declare function bold(text: string, target?: NodeJS.WriteStream): string;
export declare function lightGreen(text: string, target?: NodeJS.WriteStream): string;
export declare function lightBlue(text: string, target?: NodeJS.WriteStream): string;
export declare function boldLightBlue(text: string, target?: NodeJS.WriteStream): string;
export declare function lightGray(text: string, target?: NodeJS.WriteStream): string;
export declare function lightMagenta(text: string, target?: NodeJS.WriteStream): string;
export declare function lightRed(text: string, target?: NodeJS.WriteStream): string;
export declare function lightYellow(text: string, target?: NodeJS.WriteStream): string;
export declare function reset(target: NodeJS.WriteStream): string;
export declare function remixWordmark(target?: NodeJS.WriteStream): string;
export declare function clearCurrentLine(): string;
export declare function restoreTerminalFormatting(): void;
export declare function canUseAnsi(target: NodeJS.WriteStream): boolean;
//# sourceMappingURL=terminal.d.ts.map
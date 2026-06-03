export interface CliErrorDefinition {
    code: string;
    docsUrl?: string;
    fix?: string;
    title: string;
}
export type CliErrorContext = Record<string, boolean | number | string | null | undefined>;
export interface CliErrorOptions {
    code: string;
    context?: CliErrorContext;
    docsUrl?: string;
    fix?: string;
    message: string;
    showHelp?: boolean;
    title: string;
}
export declare const CLI_ERROR_DEFINITIONS: {
    appNameUnavailable: {
        code: string;
        title: string;
        fix: string;
    };
    remixVersionUnavailable: {
        code: string;
        title: string;
    };
    invalidCompletionRequest: {
        code: string;
        title: string;
    };
    fetchUnavailable: {
        code: string;
        title: string;
        fix: string;
    };
    internalError: {
        code: string;
        title: string;
    };
    invalidFlagCombination: {
        code: string;
        title: string;
        fix: string;
    };
    invalidPackageName: {
        code: string;
        title: string;
        fix: string;
    };
    missingOptionValue: {
        code: string;
        title: string;
        fix: string;
    };
    missingTargetDirectory: {
        code: string;
        title: string;
        fix: string;
    };
    projectRootNotFound: {
        code: string;
        title: string;
        fix: string;
    };
    remoteSkillDataMissing: {
        code: string;
        title: string;
    };
    routeMapLoaderFailed: {
        code: string;
        title: string;
        fix: string;
    };
    routeMapLoaderInvalidJson: {
        code: string;
        title: string;
        fix: string;
    };
    routeMapLoaderSignal: {
        code: string;
        title: string;
        fix: string;
    };
    routeOwnerPlanUnresolved: {
        code: string;
        title: string;
    };
    routesFileNotFound: {
        code: string;
        title: string;
        fix: string;
    };
    targetDirectoryNotEmpty: {
        code: string;
        title: string;
        fix: string;
    };
    targetPathNotDirectory: {
        code: string;
        title: string;
        fix: string;
    };
    unexpectedExtraArgument: {
        code: string;
        title: string;
        fix: string;
    };
    unknownArgument: {
        code: string;
        title: string;
        fix: string;
    };
    unknownCommand: {
        code: string;
        title: string;
        fix: string;
    };
    unknownCompletionShell: {
        code: string;
        title: string;
        fix: string;
    };
    unknownHelpTopic: {
        code: string;
        title: string;
        fix: string;
    };
};
export declare class CliError extends Error {
    code: string;
    context?: CliErrorContext;
    docsUrl?: string;
    fix?: string;
    showHelp: boolean;
    title: string;
    constructor(options: CliErrorOptions);
}
export declare class UsageError extends CliError {
    constructor(options: CliErrorOptions);
}
export declare function appNameUnavailable(targetDir?: string): UsageError;
export declare function remixVersionUnavailable(): CliError;
export declare function invalidCompletionRequest(): CliError;
export declare function fetchUnavailable(): CliError;
export declare function invalidFlagCombination(details: string): UsageError;
export declare function invalidPackageName(input: string): UsageError;
export declare function missingOptionValue(option: string): UsageError;
export declare function missingTargetDirectory(): UsageError;
export declare function projectRootNotFound(startDir?: string): CliError;
export declare function remoteSkillDataMissing(name: string): CliError;
export declare function routeMapLoaderFailed(details: string): CliError;
export declare function routeMapLoaderInvalidJson(): CliError;
export declare function routeMapLoaderSignal(signal: NodeJS.Signals): CliError;
export declare function routeOwnerPlanUnresolved(routeName: string): CliError;
export declare function routesFileNotFound(startDir?: string): CliError;
export declare function targetDirectoryNotEmpty(targetDir: string): UsageError;
export declare function targetPathNotDirectory(targetDir: string): UsageError;
export declare function toCliError(error: unknown): CliError;
export declare function unknownArgument(argument: string): UsageError;
export declare function unknownCommand(command: string): UsageError;
export declare function unknownCompletionShell(shell: string): UsageError;
export declare function unknownHelpTopic(topic: string): UsageError;
export declare function unexpectedExtraArgument(argument: string): UsageError;
export declare function renderCliError(error: unknown, options?: {
    helpText?: string;
}): string;
//# sourceMappingURL=errors.d.ts.map
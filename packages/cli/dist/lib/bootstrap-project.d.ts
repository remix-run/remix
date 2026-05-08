import { type StepProgressReporter } from './reporter.ts';
export declare const MINIMUM_SUPPORTED_NODE_VERSION = "24.3.0";
export interface BootstrapProjectOptions {
    appName: string | null;
    cwd?: string;
    force: boolean;
    remixVersion?: string;
    targetDir: string;
}
export type BootstrapProjectPhase = 'prepare-target-directory' | 'generate-scaffold-files' | 'finalize-package-json';
export interface BootstrappedProject {
    appDisplayName: string;
    targetDir: string;
}
export type BootstrapProgressReporter = StepProgressReporter<BootstrapProjectPhase>;
export declare function bootstrapProject(options: BootstrapProjectOptions, progress?: BootstrapProgressReporter): Promise<BootstrappedProject>;
//# sourceMappingURL=bootstrap-project.d.ts.map
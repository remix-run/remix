import { type StepProgressReporter } from './reporter.ts';
export interface SkillChange {
    action: 'add' | 'replace';
    name: string;
}
export interface SkillStatusEntry {
    name: string;
    state: 'installed' | 'missing' | 'outdated';
}
interface SkillsResult {
    entries: SkillStatusEntry[];
    projectRoot: string;
    skillsDir: string;
}
export interface SkillsOverview extends SkillsResult {
}
export interface SkillsInstallResult extends SkillsResult {
    appliedChanges: SkillChange[];
}
export interface SkillsOptions {
    progress?: SkillsProgressReporter;
    skillsDir?: string;
}
export type SkillsInstallPhase = 'resolve-project-root' | 'fetch-remix-skills-metadata' | 'read-local-skills-cache' | 'compare-local-skills' | 'download-remix-skills-archive' | 'write-updated-skills';
export type SkillsProgressReporter = StepProgressReporter<SkillsInstallPhase>;
type FetchImpl = typeof fetch;
export declare function getSkillsOverview(cwd?: string, fetchImpl?: FetchImpl, options?: SkillsOptions): Promise<SkillsOverview>;
export declare function installRemixSkills(cwd?: string, fetchImpl?: FetchImpl, options?: SkillsOptions): Promise<SkillsInstallResult>;
export {};
//# sourceMappingURL=skills.d.ts.map
import { type DoctorFixPlan, type DoctorSuiteResult } from './types.ts';
interface DoctorPackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    name?: string;
}
export interface EnvironmentDoctorResult {
    packageJson?: DoctorPackageJson;
    packageJsonPath?: string;
    projectRoot?: string;
    suite: DoctorSuiteResult;
}
export declare function checkEnvironment(cwd?: string): Promise<EnvironmentDoctorResult>;
export declare function getEnvironmentFixPlans(result: EnvironmentDoctorResult, remixVersion: string | undefined): DoctorFixPlan[];
export {};
//# sourceMappingURL=environment.d.ts.map
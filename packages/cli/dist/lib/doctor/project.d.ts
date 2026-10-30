import { type LoadedRouteManifest } from '../route-map.ts';
import { type DoctorFixPlan, type DoctorSuiteResult } from './types.ts';
export interface ProjectDoctorResult {
    routesFile: string;
    routeManifest?: LoadedRouteManifest;
    suite: DoctorSuiteResult;
}
export declare function checkProject(projectRoot: string): Promise<ProjectDoctorResult>;
export declare function getProjectFixPlans(projectRoot: string): Promise<DoctorFixPlan[]>;
//# sourceMappingURL=project.d.ts.map
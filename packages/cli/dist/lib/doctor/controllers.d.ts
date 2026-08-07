import { type OwnershipRouteNode } from '../controller-ownership.ts';
import { type DoctorFixPlan, type DoctorSuiteResult } from './types.ts';
export interface ControllerDoctorResult {
    fixPlans: DoctorFixPlan[];
    suite: DoctorSuiteResult;
}
export declare function checkControllerConventions(appRoot: string, tree: OwnershipRouteNode[]): Promise<ControllerDoctorResult>;
//# sourceMappingURL=controllers.d.ts.map
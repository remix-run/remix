import { inspectControllerOwnership, type OwnershipRouteNode } from '../controller-ownership.ts'
import { getControllerFindings } from './controller-findings.ts'
import { getControllerFixPlans } from './controller-fix-plans.ts'
import { createDoctorSuite, type DoctorFixPlan, type DoctorSuiteResult } from './types.ts'

export interface ControllerDoctorResult {
  fixPlans: DoctorFixPlan[]
  suite: DoctorSuiteResult
}

export async function checkControllerConventions(
  appRoot: string,
  tree: OwnershipRouteNode[],
): Promise<ControllerDoctorResult> {
  let ownership = await inspectControllerOwnership(appRoot, tree)
  let fixPlans = await getControllerFixPlans(appRoot, tree, ownership)
  let findings = getControllerFindings(ownership, fixPlans)

  return {
    fixPlans,
    suite: createDoctorSuite('controllers', findings),
  }
}

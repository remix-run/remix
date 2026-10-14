import { inspectControllerOwnership, type OwnershipRouteNode } from '../controller-ownership.ts'
import { getControllerFindings } from './controller-findings.ts'
import { createDoctorSuite, type DoctorSuiteResult } from './types.ts'

export interface ControllerDoctorResult {
  suite: DoctorSuiteResult
}

export async function checkControllerConventions(
  appRoot: string,
  tree: OwnershipRouteNode[],
): Promise<ControllerDoctorResult> {
  let ownership = await inspectControllerOwnership(appRoot, tree)
  let findings = getControllerFindings(ownership)

  return {
    suite: createDoctorSuite('actions', findings),
  }
}

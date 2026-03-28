import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import type { DoctorAppliedFix, DoctorFixPlan } from './types.ts'

export async function applyDoctorFixPlans(
  appRoot: string,
  fixPlans: DoctorFixPlan[],
): Promise<DoctorAppliedFix[]> {
  let appliedFixes: DoctorAppliedFix[] = []

  for (let fixPlan of dedupeDoctorFixPlans(fixPlans)) {
    let absolutePath = path.join(appRoot, fixPlan.path)

    if (fixPlan.kind === 'create-directory') {
      await fs.mkdir(absolutePath, { recursive: true })
      appliedFixes.push(toAppliedDoctorFix(fixPlan))
      continue
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })

    if (fixPlan.kind === 'update-file') {
      await fs.writeFile(absolutePath, fixPlan.contents ?? '', { encoding: 'utf8' })
      appliedFixes.push(toAppliedDoctorFix(fixPlan))
      continue
    }

    try {
      await fs.writeFile(absolutePath, fixPlan.contents ?? '', { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      let nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'EEXIST') {
        throw error
      }
    }

    appliedFixes.push(toAppliedDoctorFix(fixPlan))
  }

  return appliedFixes
}

function dedupeDoctorFixPlans(fixPlans: DoctorFixPlan[]): DoctorFixPlan[] {
  let seen = new Set<string>()
  let uniqueFixPlans: DoctorFixPlan[] = []

  for (let fixPlan of fixPlans) {
    let key = `${fixPlan.kind}:${fixPlan.path}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    uniqueFixPlans.push(fixPlan)
  }

  return uniqueFixPlans
}

function toAppliedDoctorFix(fixPlan: DoctorFixPlan): DoctorAppliedFix {
  return {
    code: fixPlan.code,
    kind: fixPlan.kind,
    path: fixPlan.path,
    routeName: fixPlan.routeName,
    suite: fixPlan.suite,
  }
}

import { titleCase } from '#packages/shared/strings.ts'

export function summarizeFixture(featureCount: number): string {
  return titleCase(`large fixture graph with ${featureCount} feature slices`)
}

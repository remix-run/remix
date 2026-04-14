import { titleCase } from '#packages/shared/strings'

export function summarizeFixture(featureCount: number): string {
  return titleCase(`large fixture graph with ${featureCount} feature slices`)
}

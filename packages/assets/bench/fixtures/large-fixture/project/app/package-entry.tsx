import { renderMockPackage } from '@remix-run/__mock-package'

import { renderLargeFixture } from './entry.tsx'

export function renderLargeFixtureWithMockPackage(): string {
  return `${renderLargeFixture()}\n${renderMockPackage()}`
}

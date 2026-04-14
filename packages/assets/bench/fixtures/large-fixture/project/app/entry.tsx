import { Layout } from './layout.tsx'
import { summarizeFixture } from './summary.ts'
import { renderFeature00 } from './features/feature-00/card.tsx'
import { renderFeature01 } from './features/feature-01/card.tsx'
import { renderFeature02 } from './features/feature-02/card.tsx'
import { renderFeature03 } from './features/feature-03/card.tsx'
import { renderFeature04 } from './features/feature-04/card.tsx'
import { renderFeature05 } from './features/feature-05/card.tsx'
import { renderFeature06 } from './features/feature-06/card.tsx'
import { renderFeature07 } from './features/feature-07/card.tsx'
import { renderFeature08 } from './features/feature-08/card.tsx'
import { renderFeature09 } from './features/feature-09/card.tsx'
import { renderFeature10 } from './features/feature-10/card.tsx'
import { renderFeature11 } from './features/feature-11/card.tsx'
import { renderFeature12 } from './features/feature-12/card.tsx'
import { renderFeature13 } from './features/feature-13/card.tsx'
import { renderFeature14 } from './features/feature-14/card.tsx'
import { renderFeature15 } from './features/feature-15/card.tsx'
import { renderFeature16 } from './features/feature-16/card.tsx'
import { renderFeature17 } from './features/feature-17/card.tsx'

export function renderLargeFixture() {
  return Layout({
    title: summarizeFixture(18),
    children: [
      renderFeature00(),
      renderFeature01(),
      renderFeature02(),
      renderFeature03(),
      renderFeature04(),
      renderFeature05(),
      renderFeature06(),
      renderFeature07(),
      renderFeature08(),
      renderFeature09(),
      renderFeature10(),
      renderFeature11(),
      renderFeature12(),
      renderFeature13(),
      renderFeature14(),
      renderFeature15(),
      renderFeature16(),
      renderFeature17(),
    ],
  })
}

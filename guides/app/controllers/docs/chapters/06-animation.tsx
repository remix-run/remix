import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function animationHandler({ render, request }: AppContext) {
  return render(<AnimationPage requestUrl={request.url} />, docsResponseInit)
}

function AnimationPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 6"
      title="Animation"
      description="The CSS-first animation model and Remix UI helpers for motion that respects rendering state."
      previous={{
        href: routes.docs.interactivity.href(),
        title: 'Interactivity',
      }}
      next={{
        href: routes.docs.dataAndValidation.href(),
        title: 'Data and Validation',
      }}
    >
      <DocsSection id="css-first-visual-states" title="CSS-first visual states">
        <p>Placeholder for CSS-first visual states.</p>
      </DocsSection>

      <DocsSection id="entrance-and-exit-animations" title="Entrance and exit animations">
        <p>Placeholder for Entrance and exit animations.</p>
      </DocsSection>

      <DocsSection id="layout-animations" title="Layout animations">
        <p>Placeholder for Layout animations.</p>
      </DocsSection>

      <DocsSection id="springs-tweens-and-easing" title="Springs, tweens, and easing">
        <p>Placeholder for Springs, tweens, and easing.</p>
      </DocsSection>

      <DocsSection id="interruptible-interactions" title="Interruptible interactions">
        <p>Placeholder for Interruptible interactions.</p>
      </DocsSection>

      <DocsSection id="reduced-motion-behavior" title="Reduced-motion behavior">
        <p>Placeholder for Reduced-motion behavior.</p>
      </DocsSection>
    </DocsChapter>
  )
}

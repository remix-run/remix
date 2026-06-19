import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function interactivityHandler({ render, request }: AppContext) {
  return render(<InteractivityPage requestUrl={request.url} />, docsResponseInit)
}

function InteractivityPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 5"
      title="Interactivity"
      description="How browser behavior layers onto server-rendered Remix UI without replacing the server path."
      previous={{ href: routes.docs.renderingUi.href(), title: 'Rendering UI' }}
      next={{ href: routes.docs.animation.href(), title: 'Animation' }}
    >
      <DocsSection id="progressive-enhancement" title="Progressive enhancement">
        <p>Placeholder for Progressive enhancement.</p>
      </DocsSection>

      <DocsSection id="cliententry" title="clientEntry">
        <p>Placeholder for clientEntry.</p>
      </DocsSection>

      <DocsSection id="browser-entry-with-run" title="Browser entry with run">
        <p>Placeholder for Browser entry with run.</p>
      </DocsSection>

      <DocsSection id="events-with-on" title="Events with on">
        <p>Placeholder for Events with on.</p>
      </DocsSection>

      <DocsSection id="refs-attrs-and-dom-lifecycle" title="Refs, attrs, and DOM lifecycle">
        <p>Placeholder for Refs, attrs, and DOM lifecycle.</p>
      </DocsSection>

      <DocsSection id="the-mix-prop" title="The mix prop">
        <p>Placeholder for The mix prop.</p>
      </DocsSection>

      <DocsSection id="built-in-mixins" title="Built-in mixins">
        <p>Placeholder for Built-in mixins.</p>
      </DocsSection>

      <DocsSection id="creating-custom-mixins" title="Creating custom mixins">
        <p>Placeholder for Creating custom mixins.</p>
      </DocsSection>

      <DocsSection id="client-navigation" title="Client navigation">
        <p>Placeholder for Client navigation.</p>
      </DocsSection>

      <DocsSection
        id="frames-and-partial-server-rendered-ui"
        title="Frames and partial server-rendered UI"
      >
        <p>Placeholder for Frames and partial server-rendered UI.</p>
      </DocsSection>

      <DocsSection
        id="coordinating-forms-fetches-frame-reloads-and-navigation"
        title="Coordinating forms, fetches, frame reloads, and navigation"
      >
        <p>Placeholder for Coordinating forms, fetches, frame reloads, and navigation.</p>
      </DocsSection>
    </DocsChapter>
  )
}

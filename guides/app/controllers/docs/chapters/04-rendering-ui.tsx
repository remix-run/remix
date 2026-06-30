import type { Handle } from 'remix/ui'

import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../middleware/render.ts'
import type { DocsPageProps } from '../shared.tsx'
import { DocsChapter, DocsSection, docsResponseInit } from '../shared.tsx'

export async function renderingUiHandler({ render, request }: AppContext) {
  return render(<RenderingUiPage requestUrl={request.url} />, docsResponseInit)
}

function RenderingUiPage(handle: Handle<DocsPageProps>) {
  return () => (
    <DocsChapter
      requestUrl={handle.props.requestUrl}
      chapter="Chapter 4"
      title="Rendering UI"
      description="How Remix components render on the server, collect styles, and form the document shell."
      previous={{
        href: routes.docs.serverRuntime.href(),
        title: 'Server Runtime',
      }}
      next={{ href: routes.docs.interactivity.href(), title: 'Interactivity' }}
    >
      <DocsSection id="the-remix-component-model" title="The Remix component model">
        <p>Placeholder for The Remix component model.</p>
      </DocsSection>

      <DocsSection
        id="handle-props-setup-render-and-updates"
        title="Handle, props, setup, render, and updates"
      >
        <p>Placeholder for Handle, props, setup, render, and updates.</p>
      </DocsSection>

      <DocsSection
        id="server-rendering-with-rendertostream-and-rendertostring"
        title="Server rendering with renderToStream and renderToString"
      >
        <p>Placeholder for Server rendering with renderToStream and renderToString.</p>
      </DocsSection>

      <DocsSection id="document-shells-and-head-content" title="Document shells and head content">
        <p>Placeholder for Document shells and head content.</p>
      </DocsSection>

      <DocsSection id="styling-with-css" title="Styling with css">
        <p>Placeholder for Styling with css.</p>
      </DocsSection>

      <DocsSection id="theme-tokens-and-createtheme" title="Theme tokens and createTheme">
        <p>Placeholder for Theme tokens and createTheme.</p>
      </DocsSection>

      <DocsSection
        id="first-party-ui-components-buttons-menus-popovers-listboxes-selects-comboboxes"
        title="First-party UI components: buttons, menus, popovers, listboxes, selects, comboboxes"
      >
        <p>
          Placeholder for First-party UI components: buttons, menus, popovers, listboxes, selects,
          comboboxes.
        </p>
      </DocsSection>
    </DocsChapter>
  )
}

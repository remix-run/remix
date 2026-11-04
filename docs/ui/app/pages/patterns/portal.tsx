import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Portal',
  slug: 'portal',
  category: 'patterns',
  description:
    'Render content outside its authored DOM ancestors while retaining component context.',
  importPath: '@remix-run/ui/portal',
} satisfies PageMeta

const basic = await loadExample('popover/basic')
const anatomyCode = await highlightSource(`
  import { Portal } from '@remix-run/ui/portal'

  <Portal>
    {children}
  </Portal>
`)

const propsCode = await highlightSource(`type PortalProps = {
  children?: RemixNode
  container?: HTMLElement | null
}`)

export default function PortalPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="placement" title="Placement and lifecycle">
        <p>
          The filter popover above uses a portal to escape its preview's clipping and stacking
          context. Children render under the document body by default. Pass an element from the same
          document as <code>container</code> to choose another destination.
        </p>
        <p>
          Component context, frame and child state survive parent updates and container changes.
          Removing the portal disposes its children and removes its host. Server rendering emits
          only an inert marker; children mount in the browser.
        </p>
      </Section>
      <Section id="styling" title="Styles and events">
        <p>
          Portals use ordinary elements and do not enter the browser's top layer. Their host does
          not create a stacking context. Inherited CSS and DOM events follow the destination DOM, so
          apply local theme variables and typography to the content and attach DOM listeners within
          the portal. Component context is retained independently of DOM ancestry.
        </p>
      </Section>
      <Section id="accessibility" title="Accessibility">
        <p>
          Portal only changes where content renders. Use dialog, popover, menu or another behavior
          mixin for semantics, focus and dismissal. Moving unrelated content into a portal does not
          make it part of an open modal dialog's focus scope.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="portal-reference">Portal</h3>
        <ApiTable id="portal-options" label="Prop" defaults>
          <ApiEntry name="children" type="RemixNode">
            Content rendered at the destination.
          </ApiEntry>
          <ApiEntry name="container" type="HTMLElement | null" defaultValue="document.body">
            Destination in the same document. Omitted or null uses the marker's document body.
            Changing it preserves child state.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">PortalProps</h3>
        <ApiTable id="portal-types">
          <ApiEntry id="type-PortalProps" name="PortalProps" type="type">
            <p>The optional children and container props accepted by Portal.</p>
            <CodeBlock html={propsCode} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}

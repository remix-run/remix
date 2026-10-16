import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Anchor',
  slug: 'anchor',
  category: 'patterns',
  description: 'Position floating elements against elements or viewport coordinates.',
  importPath: '@remix-run/ui/anchor',
} satisfies PageMeta

const example0 = await loadExample('anchor/chart')

const anatomyCode = await highlightSource(`
  import { anchor } from '@remix-run/ui/anchor'

  let cleanup = anchor(surface, target, {
    placement: 'top',
    offset: 10,
  })

  cleanup()
`)

const placementCode = await highlightSource(`
  anchor(surface, target, { placement: 'right-start', offset: 8 })

  css({
    '&[data-anchor-placement^="right"]': {
      transformOrigin: 'left center',
    },
    '&[data-anchor-placement^="left"]': {
      transformOrigin: 'right center',
    },
  })
`)

const offsetsCode = await highlightSource(`
  anchor(surface, target, {
    placement: 'top',
    offset: 10,
    offsetX: 4,
    offsetY: (floating) => floating.offsetHeight / 20,
  })
`)

const coordinatesCode = await highlightSource(`
  let bounds = event.currentTarget.getBoundingClientRect()
  let point = event.detail === 0
    ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    : { x: event.clientX, y: event.clientY }

  anchor(surface, point, { placement: 'top', offset: 12 })
`)

const relativeCode = await highlightSource(`
  anchor(surface, target, {
    placement: 'top-start',
    inset: true,
    relativeTo: '[data-alignment]',
  })
`)

const lifetimeCode = await highlightSource(`
  ref((surface, signal) => {
    let cleanup = anchor(surface, target, { placement: 'top', offset: 10 })
    signal.addEventListener('abort', cleanup, { once: true })
  })
`)

const typeDefinitions = {
  AnchorTarget: await highlightSource(`export type AnchorTarget = HTMLElement | AnchorPoint`),
  AnchorPoint: await highlightSource(
    `export interface AnchorPoint {
  height?: number
  width?: number
  x: number
  y: number
}`,
  ),
  AnchorOptions: await highlightSource(
    `export type AnchorOptions = {
  placement?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end'
  inset?: boolean
  relativeTo?: string
  offset?: number | ((floating: HTMLElement) => number)
  offsetX?: number | ((floating: HTMLElement) => number)
  offsetY?: number | ((floating: HTMLElement) => number)
}`,
  ),
  AnchorPlacement: await highlightSource(
    `export type AnchorPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'`,
  ),
}

export default function AnchorPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={example0} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="placement" title="Placement and viewport fit">
        <p>
          Choose a side and optional start or end alignment. Anchor flips to the opposite side when
          it improves fit, constrains oversized surfaces and keeps a 16 pixel viewport margin.{' '}
          <code>data-anchor-placement</code> reports the resolved placement.
        </p>
        <CodeBlock html={placementCode} />
      </Section>
      <Section id="offsets" title="Offsets">
        <p>
          <code>offset</code> changes distance along the placement axis. <code>offsetX</code> and{' '}
          <code>offsetY</code> adjust the resolved coordinates. Each accepts a pixel value or a
          callback that reads the floating element.
        </p>
        <CodeBlock html={offsetsCode} />
      </Section>
      <Section id="coordinates" title="Coordinate targets">
        <p>
          An <code>AnchorPoint</code> uses viewport coordinates. Optional width and height turn the
          point into a rectangle. Pointer <code>clientX</code> and <code>clientY</code> use the same
          coordinate system.
        </p>
        <CodeBlock html={coordinatesCode} />
      </Section>
      <Section id="relative" title="Inset and relative alignment">
        <p>
          <code>inset</code> aligns inside the target’s edge. <code>relativeTo</code> aligns a
          matching descendant of the floating element instead of its outer box. Oversized surfaces
          scroll an inner container when possible to preserve that alignment.
        </p>
        <CodeBlock html={relativeCode} />
      </Section>
      <Section id="lifetime" title="Tracking and cleanup">
        <p>
          Anchor tracks geometry on animation frames and repositions during scroll or resize. The
          returned function stops tracking. It leaves the last inline styles and placement attribute
          in place. Call it before positioning again and when the surface closes or unmounts.
        </p>
        <CodeBlock html={lifetimeCode} />
      </Section>
      <Section id="accessibility" title="Interaction and accessibility">
        <p>
          Positioning does not move focus or assign accessibility semantics. When a visual callout
          repeats its target’s accessible text, use <code>aria-hidden</code> and <code>inert</code>{' '}
          to keep it from being announced or focused separately.
        </p>
        <p>
          For interactive floating panels, use <a href="/patterns/popover/">Popover</a> to
          coordinate opening, dismissal and focus targets.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="anchor-reference">anchor(floating, target, options?)</h3>
        <ApiTable id="anchor-parameters" label="Parameter">
          <ApiEntry name="floating" type="HTMLElement" required>
            Element to position.
          </ApiEntry>
          <ApiEntry name="target" type="AnchorTarget" required>
            Element or viewport point/rectangle.
          </ApiEntry>
          <ApiEntry name="options" type="AnchorOptions">
            Optional placement and geometry configuration.
          </ApiEntry>
        </ApiTable>
        <p>
          Returns a cleanup function. Writes inline positioning and size constraints plus{' '}
          <code>data-anchor-placement</code>. Popover hosts and coordinate targets use fixed
          positioning. Ordinary element targets use document positioning unless the target itself is
          fixed.
        </p>
        <h3 id="options-reference">AnchorOptions</h3>
        <ApiTable id="options-options" label="Option" defaults>
          <ApiEntry
            name="placement"
            type="'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end'"
            defaultValue="'bottom'"
          >
            All four sides accept aligned variants.
          </ApiEntry>
          <ApiEntry name="inset" type="boolean" defaultValue="false">
            Aligns inside the target edge.
          </ApiEntry>
          <ApiEntry name="relativeTo" type="string">
            Selector for the first matching descendant to align within the floating element. Falls
            back to the outer box when no element matches.
          </ApiEntry>
          <ApiEntry
            name="offset"
            type="number | ((floating: HTMLElement) => number)"
            defaultValue="0"
          >
            Axis distance in pixels.
          </ApiEntry>
          <ApiEntry
            name="offsetX"
            type="number | ((floating: HTMLElement) => number)"
            defaultValue="0"
          >
            Horizontal adjustment in pixels.
          </ApiEntry>
          <ApiEntry
            name="offsetY"
            type="number | ((floating: HTMLElement) => number)"
            defaultValue="0"
          >
            Vertical adjustment in pixels.
          </ApiEntry>
        </ApiTable>
        <h3 id="point-reference">AnchorPoint</h3>
        <ApiTable id="point-properties" label="Property" defaults>
          <ApiEntry name="x, y" type="number" required>
            Viewport coordinates in pixels.
          </ApiEntry>
          <ApiEntry name="width, height" type="number" defaultValue="0">
            Rectangle dimensions in pixels.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry id="type-AnchorTarget" name="AnchorTarget" type="HTMLElement | AnchorPoint">
            <p>An element or viewport point or rectangle.</p>
            <CodeBlock html={typeDefinitions.AnchorTarget} />
          </ApiEntry>
          <ApiEntry id="type-AnchorPoint" name="AnchorPoint" type="interface">
            <p>Viewport point or rectangle.</p>
            <CodeBlock html={typeDefinitions.AnchorPoint} />
          </ApiEntry>
          <ApiEntry id="type-AnchorOptions" name="AnchorOptions" type="object">
            <p>Placement, inset, relative alignment and offsets.</p>
            <CodeBlock html={typeDefinitions.AnchorOptions} />
          </ApiEntry>
          <ApiEntry
            id="type-AnchorPlacement"
            name="AnchorPlacement"
            type={
              "| 'top'\n | 'bottom'\n | 'left'\n | 'right'\n | 'top-start'\n | 'top-end'\n | 'bottom-start'\n | 'bottom-end'"
            }
          >
            <p>
              Main sides and top/bottom aligned variants. Left/right aligned variants are accepted
              by AnchorOptions but omitted from this exported alias.
            </p>
            <CodeBlock html={typeDefinitions.AnchorPlacement} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}

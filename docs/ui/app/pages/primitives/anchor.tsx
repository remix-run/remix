import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/page.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../../actions/docs/example.tsx'
import { CodeBlock, PageLayout, Section } from '../../actions/docs/page.tsx'
import { referenceTable } from '../../ui/reference-table.tsx'

export const meta = {
  title: 'Anchor',
  slug: 'anchor',
  category: 'primitives',
  description: 'Position floating elements against elements or viewport coordinates.',
  importPath: '@remix-run/ui/anchor',
} satisfies PageMeta

const basic = await loadExample('anchor/basic')
const coordinatesExample = await loadExample('anchor/coordinates')
const relativeExample = await loadExample('anchor/relative')

const anatomyCode = await highlightSource(`
  import { anchor } from '@remix-run/ui/anchor'

  let cleanup = anchor(surface, trigger, {
    placement: 'bottom-start',
    offset: 8,
  })

  cleanup()
`)

const placementCode = await highlightSource(`
  anchor(surface, trigger, { placement: 'right-start', offset: 8 })

  <div mix={css({
    '&[data-anchor-placement^="right"]': { transformOrigin: 'left center' },
    '&[data-anchor-placement^="left"]': { transformOrigin: 'right center' },
  })} />
`)

const offsetsCode = await highlightSource(`
  anchor(surface, trigger, {
    placement: 'bottom-start',
    offset: 8,
    offsetX: 4,
    offsetY: (floating) => floating.offsetHeight / 20,
  })
`)

const lifetimeCode = await highlightSource(`
  let cleanup = () => {}

  <div popover="auto" mix={[
    ref((node, signal) => {
      signal.addEventListener('abort', () => cleanup(), { once: true })
    }),
    on('beforetoggle', (event) => {
      cleanup()
      if (event.newState === 'open') {
        cleanup = anchor(event.currentTarget, trigger, { offset: 8 })
      }
    }),
  ]} />
`)

const accessibilityCode = await highlightSource(`
  <button type="button" popovertarget="project-details">Project details</button>
  <div id="project-details" popover="auto">
    {/* Positioned content */}
  </div>
`)

export default function AnchorPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="basic" example={basic} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>
          Pass the floating element and its target to <code>anchor()</code> and clean up when
          positioning is no longer needed.
        </p>
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
        <Example id="coordinates-example" example={coordinatesExample} compact />
      </Section>
      <Section id="relative" title="Inset and relative alignment">
        <p>
          <code>inset</code> aligns inside the target’s edge. <code>relativeTo</code> aligns a
          matching descendant of the floating element instead of its outer box. Together they can
          keep a heading aligned with its trigger as a detail card expands around it. Oversized
          surfaces scroll an inner container when possible to preserve that alignment.
        </p>
        <Example id="relative-example" example={relativeExample} compact />
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
          Anchor only positions elements. It does not open or dismiss them, move focus, lock
          scrolling or add accessibility semantics. Use native popovers or the Popover primitive
          when those behaviors are needed. Use a native button for keyboard activation. For
          coordinate targets, derive a point from its bounds when activation has no pointer
          coordinates.
        </p>
        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="anchor-reference">anchor(floating, target, options?)</h3>
        {referenceTable(
          ['Parameter', 'Type', 'Meaning'],
          [
            ['floating', 'HTMLElement', 'Required element to position.'],
            ['target', 'AnchorTarget', 'Required element or viewport point/rectangle.'],
            ['options', 'AnchorOptions', 'Optional placement and geometry configuration.'],
          ],
        )}
        <p>
          Returns a cleanup function. Writes inline positioning and size constraints plus{' '}
          <code>data-anchor-placement</code>. Popover hosts and coordinate targets use fixed
          positioning. Ordinary element targets use document positioning unless the target itself is
          fixed.
        </p>
        <h3 id="options-reference">AnchorOptions</h3>
        {referenceTable(
          ['Option', 'Type', 'Behavior'],
          [
            [
              'placement',
              "'top' | 'bottom' | 'left' | 'right' plus -start or -end",
              'Defaults to bottom. All four sides accept aligned variants.',
            ],
            ['inset', 'boolean', 'Defaults to false. Aligns inside the target edge.'],
            [
              'relativeTo',
              'string',
              'Selector for a descendant to align within the floating element.',
            ],
            [
              'offset',
              'number | ((floating: HTMLElement) => number)',
              'Axis distance in pixels. Defaults to 0.',
            ],
            [
              'offsetX',
              'number | ((floating: HTMLElement) => number)',
              'Horizontal adjustment in pixels. Defaults to 0.',
            ],
            [
              'offsetY',
              'number | ((floating: HTMLElement) => number)',
              'Vertical adjustment in pixels. Defaults to 0.',
            ],
          ],
        )}
        <h3 id="point-reference">AnchorPoint</h3>
        {referenceTable(
          ['Property', 'Type', 'Meaning'],
          [
            ['x, y', 'number', 'Required viewport coordinates in pixels.'],
            ['width, height', 'number', 'Rectangle dimensions in pixels. Default to 0.'],
          ],
        )}
        <h3 id="types-reference">Exported types</h3>
        {referenceTable(
          ['Type', 'Purpose'],
          [
            ['AnchorTarget', 'HTMLElement | AnchorPoint.'],
            ['AnchorPoint', 'Viewport point or rectangle.'],
            ['AnchorOptions', 'Placement, inset, relative alignment and offsets.'],
            [
              'AnchorPlacement',
              'Main sides and top/bottom aligned variants. Left/right aligned variants are accepted by AnchorOptions but omitted from this exported alias.',
            ],
          ],
        )}
      </Section>
    </PageLayout>
  )
}

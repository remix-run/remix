import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'

export const meta = {
  title: 'Layout',
  slug: 'layout',
  category: 'animation',
  description: 'Animate position and size changes between renders.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const reordering = await loadExample('animation/layout/reordering')
const selection = await loadExample('animation/layout/selection')

const anatomyCode = await highlightSource(`
  import { animateLayout } from '@remix-run/ui/animation'

  {items.map((item) => (
    <div key={item.id} mix={animateLayout()}>{item.title}</div>
  ))}
`)

const optionsCode = await highlightSource(`
  <div mix={animateLayout({ ...spring('snappy'), size: false })}>Revenue</div>
`)

const transformsCode = await highlightSource(`
  <div mix={animateLayout()}>
    <div mix={css({ transform: 'rotate(-2deg)' })}>Preview</div>
  </div>
`)

const reducedMotionCode = await highlightSource(
  `
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    animateLayout(reducedMotion ? false : { ...spring('smooth') })
  `,
  'ts',
)

export default function LayoutPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="reordering" example={reordering} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Apply the mixin to each element and use stable keys for collections.</p>

        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="options" title="Position-only animation">
        <p>
          Set <code>size: false</code> to animate position while dimensions update immediately. This
          avoids stretching text and icons when the element resizes.
        </p>

        <CodeBlock html={optionsCode} />
      </Section>
      <Section id="size-animation" title="Animating size">
        <p>
          Size animation scales the element and its contents. Animate a separate background or
          indicator to change size without stretching foreground text.
        </p>

        <Example id="selection" example={selection} compact />
      </Section>
      <Section id="transforms" title="Composing transforms">
        <p>
          The mixin animates <code>transform</code> and sets <code>transform-origin</code>. Use a
          wrapper when the content needs its own transform.
        </p>

        <CodeBlock html={transformsCode} />
      </Section>
      <Section id="reduced-motion" title="Reduced motion">
        <p>
          Disable the mixin when the user prefers reduced motion. Layout changes then take effect
          immediately.
        </p>

        <CodeBlock html={reducedMotionCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="layout-reference">animateLayout(config?)</h3>
        <p>
          Measures an element before and after a render and animates the difference using
          transforms. Returns an element mixin. Interrupted animations resume from the current
          visual position. An unchanged target keeps its current animation.
        </p>
        <table>
          <thead>
            <tr>
              <th>Configuration</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Omitted, <code>true</code> or <code>{'{}'}</code>
              </td>
              <td>Uses the default timing and animates position and size.</td>
            </tr>
            <tr>
              <td>Options object</td>
              <td>Overrides timing or size animation.</td>
            </tr>
            <tr>
              <td>
                <code>false</code> or <code>null</code>
              </td>
              <td>Disables animation and clears any active layout transform.</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Default and behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>duration</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>200 ms. Playback duration.</td>
            </tr>
            <tr>
              <td>
                <code>easing</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                <code>'ease-out'</code>. CSS easing function. Spread <code>spring()</code> for
                spring timing.
              </td>
            </tr>
            <tr>
              <td>
                <code>size</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>
                True. Scales the element when its dimensions change. False animates position only.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Uses the Web Animations API. Reduced-motion preferences are not read automatically. The
          mixin clears its temporary transforms when playback finishes or the element is removed.
        </p>
      </Section>
    </PageLayout>
  )
}

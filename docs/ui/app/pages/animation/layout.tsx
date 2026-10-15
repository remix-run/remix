import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiTable } from '../api-table.tsx'

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
          Pass <code>false</code> to skip layout animation when motion is reduced. See{' '}
          <a href="/animation/reduced-motion/">Reduced motion</a>.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="layout-reference">animateLayout(config?)</h3>
        <p>
          Measures an element before and after a render and animates the difference using
          transforms. Returns an element mixin. Interrupted animations resume from the current
          visual position. An unchanged target keeps its current animation.
        </p>
        <ApiTable
          label="Configuration"
          typeLabel="Value"
          entries={[
            {
              name: 'Omitted, true or {}',
              type: <code>{'undefined | true | {}'}</code>,
              description: <>Uses the default timing and animates position and size.</>,
            },
            {
              name: 'Options object',
              type: <code>{'LayoutAnimationConfig'}</code>,
              description: <>Overrides timing or size animation.</>,
            },
            {
              name: 'false or null',
              type: <code>{'false | null'}</code>,
              description: <>Disables animation and clears any active layout transform.</>,
            },
          ]}
        />
        <ApiTable
          label="Option"
          defaults
          entries={[
            {
              name: 'duration',
              type: <code>{'number'}</code>,
              description: <>Playback duration in milliseconds.</>,
              defaultValue: <code>{'200'}</code>,
            },
            {
              name: 'easing',
              type: <code>{'string'}</code>,
              description: (
                <>
                  CSS easing function. Spread <code>spring()</code> for spring timing.
                </>
              ),
              defaultValue: <code>{"'ease-out'"}</code>,
            },
            {
              name: 'size',
              type: <code>{'boolean'}</code>,
              description: (
                <>Scales the element when its dimensions change. False animates position only.</>
              ),
              defaultValue: <code>{'true'}</code>,
            },
          ]}
        />
        <p>
          Uses the Web Animations API. Reduced-motion preferences are not read automatically. The
          mixin clears its temporary transforms when playback finishes or the element is removed.
        </p>
      </Section>
    </PageLayout>
  )
}

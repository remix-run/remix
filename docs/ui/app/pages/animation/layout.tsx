import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

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
    <div key={item.id} mix={animateLayout()}>Item content</div>
  ))}
`)

const optionsCode = await highlightSource(`
  <div
    mix={animateLayout({
      ...spring('snappy'),
      size: false,
    })}
  >
    Revenue
  </div>
`)

const transformsCode = await highlightSource(`
  <div mix={animateLayout()}>
    <div mix={css({
      transform: 'rotate(-2deg)',
    })}>Preview</div>
  </div>
`)

export default function LayoutPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout
      page={meta}
      pages={handle.props.pages}
      intro={
        <p>
          The examples use{' '}
          <a href="/animation/spring/">
            <code>spring('snappy')</code>
          </a>{' '}
          for timing.
        </p>
      }
    >
      <Example id="reordering" example={reordering} hero />
      <Section id="anatomy" title="Anatomy">
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

        <Example id="selection" example={selection} />
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
        <ApiTable id="layout-config" label="Configuration" typeLabel="Value">
          <ApiEntry name="Omitted, true or {}" type="undefined | true | {}">
            Uses the default timing and animates position and size.
          </ApiEntry>
          <ApiEntry
            name="Options object"
            type="{ duration?: number, easing?: string, size?: boolean }"
          >
            Overrides timing or size animation.
          </ApiEntry>
          <ApiEntry name="false or null" type="false | null">
            Disables animation and clears any active layout transform.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="layout-options" label="Option" defaults>
          <ApiEntry name="duration" type="number" defaultValue="200">
            Playback duration in milliseconds.
          </ApiEntry>
          <ApiEntry name="easing" type="string" defaultValue="'ease-out'">
            CSS easing function. Spread <code>spring()</code> for spring timing.
          </ApiEntry>
          <ApiEntry name="size" type="boolean" defaultValue="true">
            Scales the element when its dimensions change. False animates position only.
          </ApiEntry>
        </ApiTable>
        <p>
          Uses the Web Animations API. Reduced-motion preferences are not read automatically. The
          mixin clears its temporary transforms when playback finishes or the element is removed.
        </p>
      </Section>
    </PageLayout>
  )
}

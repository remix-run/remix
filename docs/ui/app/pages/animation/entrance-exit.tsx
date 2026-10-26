import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

export const meta = {
  title: 'Entrance and exit',
  slug: 'entrance-exit',
  category: 'animation',
  description: 'Animate elements as they enter and leave the rendered tree.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const presence = await loadExample('animation/entrance-exit/presence')

export const preview = presence

const anatomyCode = await highlightSource(`
  import { animateEntrance, animateExit } from '@remix-run/ui/animation'

  const element = visible && (
    <div key="content" mix={[animateEntrance(), animateExit()]}>
      Animated content
    </div>
  )
`)

const timingCode = await highlightSource(`
  <div
    mix={[
      animateEntrance({
        opacity: 0,
        transform: 'translateY(12px)',
        ...spring('snappy'),
      }),
      animateExit({
        opacity: 0,
        transform: 'translateY(-12px)',
        duration: 200,
        easing: 'ease-in',
      }),
    ]}
  >
    Changes saved
  </div>
`)

const identityCode = await highlightSource(`
  const element = visible && (
    <div key="notification" mix={[animateEntrance(), animateExit()]}>
      Changes saved
    </div>
  )
`)

const initialEntranceCode = await highlightSource(
  `
    animateEntrance({ opacity: 0, ...spring('snappy'), initial: false })
  `,
  'ts',
)

export default function EntranceExitPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="presence" example={presence} hero />
      <Section id="anatomy" title="Anatomy">
        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="timing" title="Customizing motion">
        <p>
          Style values define the entrance's starting keyframe and the exit's destination. The
          element's normal styles define the other end. Spread{' '}
          <a href="/animation/spring/">
            <code>spring('snappy')</code>
          </a>{' '}
          into the options for spring timing. Use <code>transition</code> to override timing for
          individual properties. Each property inherits settings you haven't overridden.
        </p>

        <CodeBlock html={timingCode} />
      </Section>
      <Section id="identity" title="Keys and interrupted animations">
        <p>
          The same element type and key under the same parent let an element return during exit.
          Entrance resumes from its current appearance, and removal waits until exit finishes.
          Removing an element during entrance starts the configured exit from its current animated
          appearance. Returning during exit animates back to normal styles using the exit
          configuration’s timing. Retargeting preserves current values without carrying spring
          velocity.
        </p>

        <CodeBlock html={identityCode} />
      </Section>
      <Section id="initial-entrance" title="Skipping the first entrance">
        <p>
          Set <code>initial: false</code> to skip the first entrance for a key within its parent.
          Later insertions of that key still animate. This tracks each key’s first insertion, even
          if it first appears after the initial render.
        </p>

        <CodeBlock html={initialEntranceCode} />
      </Section>
      <Section id="reduced-motion" title="Reduced motion">
        <p>
          Use zero-duration timing when motion is reduced. See{' '}
          <a href="/animation/reduced-motion/">Reduced motion</a> for preference checks during
          render.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="entrance-reference">animateEntrance(config?)</h3>
        <p>
          Runs when the element is inserted, from the supplied style values to its normal styles.
          Returns an element mixin.
        </p>
        <ApiTable id="entrance-config" label="Configuration" typeLabel="Value">
          <ApiEntry name="Omitted or true" type="undefined | true">
            150 ms opacity fade from zero with ease-out.
          </ApiEntry>
          <ApiEntry name="Options object" type="AnimateMixinConfig">
            Uses the supplied style values and optional transition settings.
          </ApiEntry>
          <ApiEntry name="false or null" type="false | null">
            Disables entrance animation.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="entrance-options" label="Option" defaults>
          <ApiEntry name="transition" type="AnimationTransition" defaultValue="{}">
            Per-property timing and compositing overrides. Each property inherits the animation's
            settings, replacing only the fields you supply. Accepts a spring for each property.
          </ApiEntry>
          <ApiEntry name="Style properties" type="string | number">
            Starting values for entrance or destination values for exit. Accepts CSS properties and
            custom properties.
          </ApiEntry>
          <ApiEntry name="duration" type="number" defaultValue="150">
            Playback time in milliseconds. Zero-duration exit properties apply immediately unless
            delayed.
          </ApiEntry>
          <ApiEntry name="easing" type="string" defaultValue="'linear'">
            CSS easing function.
          </ApiEntry>
          <ApiEntry name="delay" type="number" defaultValue="0">
            Delay before playback in milliseconds.
          </ApiEntry>
          <ApiEntry name="composite" type="CompositeOperation" defaultValue="'replace'">
            How the keyframe combines with underlying styles. Accepts <code>'replace'</code>,{' '}
            <code>'add'</code> or <code>'accumulate'</code>.
          </ApiEntry>
        </ApiTable>
        <ApiTable id="entrance-entrance-options" label="Entrance option" defaults>
          <ApiEntry name="initial" type="boolean" defaultValue="true">
            False skips the first entrance for each key within its parent. Requires a key.
          </ApiEntry>
        </ApiTable>
        <h3 id="exit-reference">animateExit(config?)</h3>
        <p>
          Runs when the element is removed, from its current styles to the supplied values. Keeps
          the element in the DOM until all property transitions finish. Retained elements are inert.
          Returns an element mixin.
        </p>
        <ApiTable id="exit-config" label="Configuration" typeLabel="Value">
          <ApiEntry name="Omitted or true" type="undefined | true">
            150 ms opacity fade to zero with ease-in.
          </ApiEntry>
          <ApiEntry name="Options object" type="AnimateMixinConfig">
            Accepts the same timing and style options as <code>animateEntrance()</code>. The style
            values are the destination keyframe. <code>initial</code> has no effect.
          </ApiEntry>
          <ApiEntry name="false or null" type="false | null">
            Removes the element without an exit animation.
          </ApiEntry>
        </ApiTable>
        <p>
          Both mixins use the Web Animations API and do not automatically read reduced-motion
          preferences.
        </p>
      </Section>
    </PageLayout>
  )
}

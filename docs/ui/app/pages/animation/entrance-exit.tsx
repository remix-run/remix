import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'

export const meta = {
  title: 'Entrance and exit',
  slug: 'entrance-exit',
  category: 'animation',
  description: 'Animate elements as they enter and leave the rendered tree.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const presence = await loadExample('animation/entrance-exit/presence')

const anatomyCode = await highlightSource(`
  import { animateEntrance, animateExit } from '@remix-run/ui/animation'

  {visible && (
    <div key="notification" mix={[animateEntrance(), animateExit()]}>
      Changes saved
    </div>
  )}
`)

const timingCode = await highlightSource(`
  <div mix={[
    animateEntrance({ opacity: 0, transform: 'translateY(12px)', ...spring('snappy') }),
    animateExit({ opacity: 0, transform: 'translateY(-12px)', duration: 200, easing: 'ease-in' }),
  ]}>Changes saved</div>
`)

const identityCode = await highlightSource(`
  {visible && (
    <div key="notification" mix={[animateEntrance(), animateExit()]}>
      Changes saved
    </div>
  )}
`)

const initialEntranceCode = await highlightSource(
  `
    animateEntrance({ opacity: 0, ...spring('snappy'), initial: false })
  `,
  'ts',
)

const reducedMotionCode = await highlightSource(
  `
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timing = reducedMotion ? { duration: 0 } : { ...spring('snappy') }

    animateEntrance({ opacity: 0, ...timing })
    animateExit({ opacity: 0, ...timing })
  `,
  'ts',
)

export default function EntranceExitPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="presence" example={presence} hero />
      <Section id="anatomy" title="Anatomy">
        <p>Apply entrance and exit mixins to the element being inserted or removed.</p>

        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="timing" title="Customizing motion">
        <p>
          Style values define the entrance's starting keyframe and the exit's destination. The
          element's normal styles define the other end. Spread a spring to use spring timing.
        </p>

        <CodeBlock html={timingCode} />
      </Section>
      <Section id="identity" title="Keys and interrupted animations">
        <p>
          A stable key lets an element return during its exit animation. Entrance resumes from its
          current appearance, and removal waits until exit finishes.
        </p>

        <CodeBlock html={identityCode} />
      </Section>
      <Section id="initial-entrance" title="Skipping the first entrance">
        <p>
          Set <code>initial: false</code> to skip the first entrance for a key within its parent.
          Later insertions still animate.
        </p>

        <CodeBlock html={initialEntranceCode} />
      </Section>
      <Section id="reduced-motion" title="Reduced motion">
        <p>
          Check the preference in browser code and set <code>duration</code> to zero to complete
          insertion and removal immediately.
        </p>

        <CodeBlock html={reducedMotionCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="entrance-reference">animateEntrance(config?)</h3>
        <p>
          Runs when the element is inserted, from the supplied style values to its normal styles.
          Returns an element mixin.
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
                Omitted or <code>true</code>
              </td>
              <td>150 ms opacity fade from zero with ease-out.</td>
            </tr>
            <tr>
              <td>Options object</td>
              <td>
                Uses the supplied keyframe and timing. Requires <code>duration</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>false</code> or <code>null</code>
              </td>
              <td>Disables entrance animation.</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Behavior</th>
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
              <td>Required in an options object. Playback time in milliseconds.</td>
            </tr>
            <tr>
              <td>
                <code>easing</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                CSS easing function. Defaults to the browser's linear easing when omitted from an
                options object.
              </td>
            </tr>
            <tr>
              <td>
                <code>delay</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>Delay before playback in milliseconds. Defaults to zero.</td>
            </tr>
            <tr>
              <td>
                <code>composite</code>
              </td>
              <td>
                <code>CompositeOperation</code>
              </td>
              <td>
                How the keyframe combines with underlying styles. Accepts <code>'replace'</code>,{' '}
                <code>'add'</code> or <code>'accumulate'</code>. Defaults to <code>'replace'</code>.
              </td>
            </tr>
            <tr>
              <td>Style properties</td>
              <td>
                <code>string | number</code>
              </td>
              <td>
                Starting values for entrance or destination values for exit. Other value types are
                ignored.
              </td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Entrance option</th>
              <th>Type</th>
              <th>Default and behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>initial</code>
              </td>
              <td>
                <code>boolean</code>
              </td>
              <td>Defaults to true. False skips the first entrance for a key within its parent.</td>
            </tr>
          </tbody>
        </table>
        <h3 id="exit-reference">animateExit(config?)</h3>
        <p>
          Runs when the element is removed, from its current styles to the supplied values. Keeps
          the element in the DOM until playback finishes. Returns an element mixin.
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
                Omitted or <code>true</code>
              </td>
              <td>150 ms opacity fade to zero with ease-in.</td>
            </tr>
            <tr>
              <td>Options object</td>
              <td>
                Accepts the same timing and style options as <code>animateEntrance()</code>. The
                style values are the destination keyframe. <code>initial</code> has no effect.
              </td>
            </tr>
            <tr>
              <td>
                <code>false</code> or <code>null</code>
              </td>
              <td>Removes the element without an exit animation.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Both mixins use the Web Animations API and do not automatically read reduced-motion
          preferences.
        </p>
      </Section>
    </PageLayout>
  )
}

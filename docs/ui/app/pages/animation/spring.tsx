import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ReferenceTable } from '../reference-table.tsx'

export const meta = {
  title: 'Spring',
  slug: 'spring',
  category: 'animation',
  description: 'Spring timing for transitions and animation.',
  importPath: '@remix-run/ui/animation',
} satisfies PageMeta

const billing = await loadExample('animation/spring/billing')
const presets = await loadExample('animation/spring/presets')
const custom = await loadExample('animation/spring/custom')
const webAnimationsExample = await loadExample('animation/spring/web-animations')
const iteratorExample = await loadExample('animation/spring/iterator')

const anatomyCode = await highlightSource(`
  import { css } from 'remix/component'
  import { spring } from '@remix-run/ui/animation'

  <div mix={css({
    transform: moved ? 'translateX(200px)' : 'translateX(0)',
    transition: spring.transition('transform', 'snappy'),
  })} />
`)

const cssCode = await highlightSource(`
  <div mix={css({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: spring.transition(['transform', 'opacity'], 'snappy'),
  })} />
`)

const mixinsCode = await highlightSource(`
  <div mix={[
    animateEntrance({ opacity: 0, ...spring('snappy') }),
    animateExit({ opacity: 0, ...spring('snappy') }),
  ]}>Saved</div>
`)

const accessibilityCode = await highlightSource(`
  <div mix={css({
    transform: moved ? 'translateX(200px)' : 'translateX(0)',
    transition: spring.transition('transform', 'snappy'),
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })} />
`)

export const preview = billing

export default function SpringPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="billing" example={billing} hero compact />
      <Section id="anatomy" title="Anatomy">
        <p>
          Use <code>spring.transition()</code> in the <code>css()</code> mixin to animate between
          style values.
        </p>

        <CodeBlock html={anatomyCode} />
      </Section>
      <Section id="presets-reference" title="Presets">
        <p>
          Choose <code>smooth</code> for gradual motion, <code>snappy</code> for a quick response or{' '}
          <code>bouncy</code> for overshoot. Calling <code>spring()</code> without arguments uses{' '}
          <code>snappy</code>.
        </p>

        <Example id="presets" example={presets} />
      </Section>
      <Section id="options" title="Customizing motion">
        <p>
          Perceptual duration shapes how quickly a spring moves. Bounce controls overshoot, and
          velocity sets its initial speed. The calculated settling duration determines when playback
          ends.
        </p>

        <Example id="custom" example={custom} compact />
      </Section>
      <Section id="css" title="Multiple properties">
        <p>
          Pass an array to use the same timing for several CSS properties. Keep the transition
          applied in both states to animate in both directions.
        </p>

        <CodeBlock html={cssCode} />
      </Section>
      <Section id="web-animations" title="Web Animations">
        <p>
          A spring provides timing options for <code>element.animate()</code>. Keyframes define the
          animated properties. Interrupted playback can resume from the current visual value.
        </p>

        <Example id="web-animations-example" example={webAnimationsExample} compact />
      </Section>
      <Section id="mixins" title="Animation mixins">
        <p>
          Spread spring timing into <a href="/animation/entrance-exit/">entrance and exit</a> or{' '}
          <a href="/animation/layout/">layout</a> mixins.
        </p>

        <CodeBlock html={mixinsCode} />
      </Section>
      <Section id="javascript" title="JavaScript progress samples">
        <p>
          A spring iterator yields numeric progress samples, including overshoot. Iteration is
          synchronous, with samples calculated at approximately 60 per second. Taking one sample per
          animation frame ties playback speed to the display's refresh rate. For timestamp-based
          playback, use <a href="/animation/tween/">Tween</a> or browser animation APIs.
        </p>

        <Example id="iterator-example" example={iteratorExample} compact />
      </Section>
      <Section id="accessibility" title="Reduced motion">
        <p>
          Remove CSS transitions with a media query. For JavaScript playback, check{' '}
          <code>prefersReducedMotion()</code> before starting and apply the final value immediately.
        </p>

        <CodeBlock html={accessibilityCode} />
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="spring-reference">spring(presetOrOptions?, overrides?)</h3>
        <p>
          Computes a motion profile and returns a <code>SpringIterator</code>. Playback is handled
          by CSS, the browser or your code.
        </p>
        <ReferenceTable>
          <thead>
            <tr>
              <th>Argument</th>
              <th>Type</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>presetOrOptions</code>
              </td>
              <td>
                <code>SpringPreset | SpringOptions</code>
              </td>
              <td>
                Defaults to <code>'snappy'</code>. An options object uses its own field defaults.
              </td>
            </tr>
            <tr>
              <td>
                <code>overrides</code>
              </td>
              <td>
                <code>Omit&lt;SpringOptions, 'bounce'&gt;</code>
              </td>
              <td>
                Overrides duration or velocity when using a named preset. To change bounce, use an
                options object.
              </td>
            </tr>
          </tbody>
        </ReferenceTable>
        <h4>SpringOptions</h4>
        <ReferenceTable>
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
              <td>
                300 ms. Perceptual duration used to derive stiffness. The returned settling duration
                may be longer.
              </td>
            </tr>
            <tr>
              <td>
                <code>bounce</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>
                Zero. Negative values produce overdamped motion, zero is critically damped and
                positive values oscillate around the target. Clamped between -1 and 0.95.
              </td>
            </tr>
            <tr>
              <td>
                <code>velocity</code>
              </td>
              <td>
                <code>number</code>
              </td>
              <td>
                Zero. Initial velocity in progress units per second. Does not track an element's
                existing velocity.
              </td>
            </tr>
          </tbody>
        </ReferenceTable>
        <p>
          <code>spring()</code> uses the snappy preset's 200 ms perceptual duration.{' '}
          <code>{'spring({})'}</code> uses the options default of 300 ms.
        </p>
        <h4>SpringIterator</h4>
        <ReferenceTable>
          <thead>
            <tr>
              <th>Member</th>
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
              <td>Calculated settling time in milliseconds. Enumerable.</td>
            </tr>
            <tr>
              <td>
                <code>easing</code>
              </td>
              <td>
                <code>string</code>
              </td>
              <td>
                CSS <code>linear()</code> easing. Enumerable. Spreading the iterator supplies
                duration and easing.
              </td>
            </tr>
            <tr>
              <td>
                <code>toString()</code>
              </td>
              <td>
                <code>() =&gt; string</code>
              </td>
              <td>Duration and easing pair suitable for CSS transition timing.</td>
            </tr>
            <tr>
              <td>Iteration</td>
              <td>
                <code>IterableIterator&lt;number&gt;</code>
              </td>
              <td>
                Finite sequence of progress samples ending at exactly 1. Values can overshoot and
                are not clamped to zero through one. Iteration consumes the sequence.
              </td>
            </tr>
          </tbody>
        </ReferenceTable>
        <h3 id="transition-reference">spring.transition(property, presetOrOptions?, overrides?)</h3>
        <p>
          Returns a CSS transition string. Timing arguments follow <code>spring()</code>. Requires
          browser support for <code>linear()</code> easing.
        </p>
        <ReferenceTable>
          <thead>
            <tr>
              <th>Argument</th>
              <th>Type</th>
              <th>Behavior</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>property</code>
              </td>
              <td>
                <code>string | string[]</code>
              </td>
              <td>Required. One or several CSS property names.</td>
            </tr>
            <tr>
              <td>
                <code>presetOrOptions</code>
              </td>
              <td>
                <code>SpringPreset | SpringOptions</code>
              </td>
              <td>
                Defaults to <code>'snappy'</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>overrides</code>
              </td>
              <td>
                <code>Omit&lt;SpringOptions, 'bounce'&gt;</code>
              </td>
              <td>Duration and velocity overrides for a preset.</td>
            </tr>
          </tbody>
        </ReferenceTable>
        <p>
          A spring can also be interpolated directly into a timing string, such as{' '}
          <code>{'`transform ${spring("bouncy")}`'}</code>.
        </p>
        <h3 id="presets-api-reference">spring.presets</h3>
        <p>Exposes the parameters for each named preset.</p>
        <ReferenceTable>
          <thead>
            <tr>
              <th>Preset</th>
              <th>Perceptual duration</th>
              <th>Bounce</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>smooth</code>
              </td>
              <td>400 ms</td>
              <td>-0.3</td>
            </tr>
            <tr>
              <td>
                <code>snappy</code>
              </td>
              <td>200 ms</td>
              <td>0</td>
            </tr>
            <tr>
              <td>
                <code>bouncy</code>
              </td>
              <td>400 ms</td>
              <td>0.3</td>
            </tr>
          </tbody>
        </ReferenceTable>
        <h3 id="reduced-motion-reference">prefersReducedMotion()</h3>
        <p>
          Returns whether the browser currently matches <code>prefers-reduced-motion: reduce</code>.
          Returns false during server rendering or when <code>matchMedia</code> is unavailable. Each
          call reads the current preference; it does not subscribe to changes or trigger renders.
        </p>
        <h3 id="types-reference">Exported types</h3>
        <ReferenceTable>
          <thead>
            <tr>
              <th>Type</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>SpringPreset</code>
              </td>
              <td>
                <code>'smooth' | 'snappy' | 'bouncy'</code>.
              </td>
            </tr>
            <tr>
              <td>
                <code>SpringOptions</code>
              </td>
              <td>Perceptual duration, bounce and initial velocity.</td>
            </tr>
            <tr>
              <td>
                <code>SpringIterator</code>
              </td>
              <td>Progress iterator with duration, easing and string conversion.</td>
            </tr>
          </tbody>
        </ReferenceTable>
      </Section>
    </PageLayout>
  )
}

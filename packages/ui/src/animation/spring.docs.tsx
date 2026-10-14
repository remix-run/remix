import type { UiDocs } from '../docs/types.ts'

export default {
  title: 'Spring',
  slug: 'spring',
  category: 'animation',
  description: 'Spring timing for transitions and animation.',
  importPath: '@remix-run/ui/animation',
  examples: [
    {
      id: 'billing',
      previewSize: 'compact',
      title: 'Spring transitions',
      description: '',
      module: new URL('./spring/billing.example.tsx', import.meta.url),
    },
    {
      id: 'presets',
      title: 'Spring presets',
      description: '',
      module: new URL('./spring/presets.example.tsx', import.meta.url),
      section: 'presets-reference',
    },
    {
      id: 'custom',
      previewSize: 'compact',
      title: 'Custom spring parameters',
      description: '',
      module: new URL('./spring/custom.example.tsx', import.meta.url),
      section: 'options',
    },
    {
      id: 'web-animations-example',
      previewSize: 'compact',
      title: 'Web Animations',
      description: '',
      module: new URL('./spring/web-animations.example.tsx', import.meta.url),
      section: 'web-animations',
    },
    {
      id: 'iterator-example',
      previewSize: 'compact',
      title: 'JavaScript progress samples',
      description: '',
      module: new URL('./spring/iterator.example.tsx', import.meta.url),
      section: 'javascript',
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <>
            <p>
              Use <code>spring.transition()</code> in the <code>css()</code> mixin to animate
              between style values.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "import { css } from 'remix/component'\nimport { spring } from '@remix-run/ui/animation'\n\n<div mix={css({\n  transform: moved ? 'translateX(200px)' : 'translateX(0)',\n  transition: spring.transition('transform', 'snappy'),\n})} />",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'presets-reference',
      title: 'Presets',
      content() {
        return (
          <>
            <p>
              Choose <code>smooth</code> for gradual motion, <code>snappy</code> for a quick
              response or <code>bouncy</code> for overshoot. Calling <code>spring()</code> without
              arguments uses <code>snappy</code>.
            </p>
          </>
        )
      },
    },
    {
      id: 'options',
      title: 'Customizing motion',
      content() {
        return (
          <>
            <p>
              Perceptual duration shapes how quickly a spring moves. Bounce controls overshoot, and
              velocity sets its initial speed. The calculated settling duration determines when
              playback ends.
            </p>
          </>
        )
      },
    },
    {
      id: 'css',
      title: 'Multiple properties',
      content() {
        return (
          <>
            <p>
              Pass an array to use the same timing for several CSS properties. Keep the transition
              applied in both states to animate in both directions.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "<div mix={css({\n  opacity: visible ? 1 : 0,\n  transform: visible ? 'translateY(0)' : 'translateY(8px)',\n  transition: spring.transition(['transform', 'opacity'], 'snappy'),\n})} />",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'web-animations',
      title: 'Web Animations',
      content() {
        return (
          <>
            <p>
              A spring provides timing options for <code>element.animate()</code>. Keyframes define
              the animated properties. Interrupted playback can resume from the current visual
              value.
            </p>
          </>
        )
      },
    },
    {
      id: 'mixins',
      title: 'Animation mixins',
      content() {
        return (
          <>
            <p>
              Spread spring timing into <a href="/animation/entrance-exit/">entrance and exit</a> or{' '}
              <a href="/animation/layout/">layout</a> mixins.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "<div mix={[\n  animateEntrance({ opacity: 0, ...spring('snappy') }),\n  animateExit({ opacity: 0, ...spring('snappy') }),\n]}>Saved</div>",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'javascript',
      title: 'JavaScript progress samples',
      content() {
        return (
          <>
            <p>
              A spring iterator yields numeric progress samples, including overshoot. Iteration is
              synchronous, with samples calculated at approximately 60 per second. Taking one sample
              per animation frame ties playback speed to the display's refresh rate. For
              timestamp-based playback, use <a href="/animation/tween/">Tween</a> or browser
              animation APIs.
            </p>
          </>
        )
      },
    },
    {
      id: 'accessibility',
      title: 'Reduced motion',
      content() {
        return (
          <>
            <p>
              Remove CSS transitions with a media query. For JavaScript playback, check the
              preference before starting and apply the final value immediately.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "<div mix={css({\n  transform: moved ? 'translateX(200px)' : 'translateX(0)',\n  transition: spring.transition('transform', 'snappy'),\n  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },\n})} />",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="spring-reference">spring(presetOrOptions?, overrides?)</h3>
            <p>
              Computes a motion profile and returns a <code>SpringIterator</code>. Playback is
              handled by CSS, the browser or your code.
            </p>
            <table>
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
                    Defaults to <code>'snappy'</code>. An options object uses its own field
                    defaults.
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
                    Overrides duration or velocity when using a named preset. To change bounce, use
                    an options object.
                  </td>
                </tr>
              </tbody>
            </table>
            <h4>SpringOptions</h4>
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
                  <td>
                    300 ms. Perceptual duration used to derive stiffness. The returned settling
                    duration may be longer.
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
            </table>
            <p>
              <code>spring()</code> uses the snappy preset's 200 ms perceptual duration.{' '}
              <code>{'spring({})'}</code> uses the options default of 300 ms.
            </p>
            <h4>SpringIterator</h4>
            <table>
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
                    Finite sequence of progress samples ending at exactly 1. Values can overshoot
                    and are not clamped to zero through one. Iteration consumes the sequence.
                  </td>
                </tr>
              </tbody>
            </table>
            <h3 id="transition-reference">
              spring.transition(property, presetOrOptions?, overrides?)
            </h3>
            <p>
              Returns a CSS transition string. Timing arguments follow <code>spring()</code>.
              Requires browser support for <code>linear()</code> easing.
            </p>
            <table>
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
            </table>
            <p>
              A spring can also be interpolated directly into a timing string, such as{' '}
              <code>{'`transform ${spring("bouncy")}`'}</code>.
            </p>
            <h3 id="presets-api-reference">spring.presets</h3>
            <p>Exposes the parameters for each named preset.</p>
            <table>
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
            </table>
            <h3 id="types-reference">Exported types</h3>
            <table>
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
            </table>
          </>
        )
      },
    },
  ],
} satisfies UiDocs

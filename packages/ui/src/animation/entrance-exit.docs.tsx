import type { UiDocs } from '../docs/types.ts'

export default {
  title: 'Entrance and exit',
  slug: 'entrance-exit',
  category: 'animation',
  description: 'Animate elements as they enter and leave the rendered tree.',
  importPath: '@remix-run/ui/animation',
  examples: [
    {
      id: 'presence',
      title: 'Entrance and exit animation',
      description: '',
      module: new URL('./entrance-exit/presence.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <>
            <p>Apply entrance and exit mixins to the element being inserted or removed.</p>
          </>
        )
      },
      code: [
        {
          source:
            'import { animateEntrance, animateExit } from \'@remix-run/ui/animation\'\n\n{visible && (\n  <div key="notification" mix={[animateEntrance(), animateExit()]}>\n    Changes saved\n  </div>\n)}',
          language: 'tsx',
        },
      ],
    },
    {
      id: 'timing',
      title: 'Customizing motion',
      content() {
        return (
          <>
            <p>
              Style values define the entrance's starting keyframe and the exit's destination. The
              element's normal styles define the other end. Spread a spring to use spring timing.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "<div mix={[\n  animateEntrance({ opacity: 0, transform: 'translateY(12px)', ...spring('snappy') }),\n  animateExit({ opacity: 0, transform: 'translateY(-12px)', duration: 200, easing: 'ease-in' }),\n]}>Changes saved</div>",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'identity',
      title: 'Keys and interrupted animations',
      content() {
        return (
          <>
            <p>
              A stable key lets an element return during its exit animation. Entrance resumes from
              its current appearance, and removal waits until exit finishes.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            '{visible && (\n  <div key="notification" mix={[animateEntrance(), animateExit()]}>\n    Changes saved\n  </div>\n)}',
          language: 'tsx',
        },
      ],
    },
    {
      id: 'initial-entrance',
      title: 'Skipping the first entrance',
      content() {
        return (
          <>
            <p>
              Set <code>initial: false</code> to skip the first entrance for a key within its
              parent. Later insertions still animate.
            </p>
          </>
        )
      },
      code: [
        {
          source: "animateEntrance({ opacity: 0, ...spring('snappy'), initial: false })",
          language: 'ts',
        },
      ],
    },
    {
      id: 'reduced-motion',
      title: 'Reduced motion',
      content() {
        return (
          <>
            <p>
              Check the preference in browser code and set <code>duration</code> to zero to complete
              insertion and removal immediately.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches\nlet timing = reducedMotion ? { duration: 0 } : { ...spring('snappy') }\n\nanimateEntrance({ opacity: 0, ...timing })\nanimateExit({ opacity: 0, ...timing })",
          language: 'ts',
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API reference',
      content() {
        return (
          <>
            <h3 id="entrance-reference">animateEntrance(config?)</h3>
            <p>
              Runs when the element is inserted, from the supplied style values to its normal
              styles. Returns an element mixin.
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
                    CSS easing function. Defaults to the browser's linear easing when omitted from
                    an options object.
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
                    How the keyframe combines with underlying styles. Accepts <code>'replace'</code>
                    , <code>'add'</code> or <code>'accumulate'</code>. Defaults to{' '}
                    <code>'replace'</code>.
                  </td>
                </tr>
                <tr>
                  <td>Style properties</td>
                  <td>
                    <code>string | number</code>
                  </td>
                  <td>
                    Starting values for entrance or destination values for exit. Other value types
                    are ignored.
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
                  <td>
                    Defaults to true. False skips the first entrance for a key within its parent.
                  </td>
                </tr>
              </tbody>
            </table>
            <h3 id="exit-reference">animateExit(config?)</h3>
            <p>
              Runs when the element is removed, from its current styles to the supplied values.
              Keeps the element in the DOM until playback finishes. Returns an element mixin.
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
          </>
        )
      },
    },
  ],
} satisfies UiDocs

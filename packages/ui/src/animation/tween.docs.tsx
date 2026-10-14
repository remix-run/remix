import type { UiDocs } from '../docs/types.ts'

export default {
  title: 'Tween',
  slug: 'tween',
  category: 'animation',
  description: 'Interpolate numeric values over time with a cubic B\u00e9zier easing curve.',
  importPath: '@remix-run/ui/animation',
  examples: [
    {
      id: 'timing',
      previewSize: 'compact',
      title: 'Tween timing',
      description: '',
      module: new URL('./tween/timing.example.tsx', import.meta.url),
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <>
            <p>Create a generator, prime it, then supply timestamps to advance playback.</p>
          </>
        )
      },
      code: [
        {
          source:
            "import { easings, tween } from '@remix-run/ui/animation'\n\nlet animation = tween({ from: 0, to: 200, duration: 600, curve: easings.easeOut })\nanimation.next()\nlet next = animation.next(timestamp)",
          language: 'ts',
        },
      ],
    },
    {
      id: 'frames',
      title: 'Scheduling animation frames',
      content() {
        return (
          <>
            <p>
              Pass <code>requestAnimationFrame</code> timestamps to <code>next()</code>. Apply each
              returned value, including the final value when <code>done</code> is true.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            'let animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })\nanimation.next()\nlet frame = requestAnimationFrame(tick)\n\nfunction tick(timestamp: number) {\n  let next = animation.next(timestamp)\n  position = next.value\n  handle.update()\n  if (!next.done) frame = requestAnimationFrame(tick)\n}\n\n<div mix={css({ transform: `translateX(${position}px)` })} />',
          language: 'tsx',
        },
      ],
    },
    {
      id: 'curves',
      title: 'Custom easing',
      content() {
        return (
          <>
            <p>
              A cubic Bézier curve controls the rate of change. Y control points outside zero to one
              allow overshoot.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            'tween({\n  from: 0,\n  to: 1,\n  duration: 400,\n  curve: { x1: 0.2, y1: 0, x2: 0.3, y2: 1.4 },\n})',
          language: 'ts',
        },
      ],
    },
    {
      id: 'retargeting',
      title: 'Interruption',
      content() {
        return (
          <>
            <p>
              Cancel the previous frame and start a new tween from the last applied value. Cancel
              outstanding frames when the component is removed.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            'cancelAnimationFrame(frame)\nlet animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })\nanimation.next()\nframe = requestAnimationFrame(tick)',
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
            <p>Skip playback and apply the destination immediately when motion is reduced.</p>
          </>
        )
      },
      code: [
        {
          source:
            "cancelAnimationFrame(frame)\nif (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {\n  position = target\n  handle.update()\n} else {\n  animation = tween({ from: position, to: target, duration: 600, curve: easings.easeOut })\n  animation.next()\n  frame = requestAnimationFrame(tick)\n}",
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
            <h3 id="tween-reference">tween(options)</h3>
            <p>
              Returns <code>Generator&lt;number, number, number&gt;</code>. The first{' '}
              <code>next()</code> yields <code>from</code>. The first supplied timestamp establishes
              the start time. Subsequent timestamps use the same clock and are measured in
              milliseconds. Completion returns <code>to</code> with <code>done: true</code>.
            </p>
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
                    <code>from</code>
                  </td>
                  <td>
                    <code>number</code>
                  </td>
                  <td>Required. Starting value.</td>
                </tr>
                <tr>
                  <td>
                    <code>to</code>
                  </td>
                  <td>
                    <code>number</code>
                  </td>
                  <td>Required. Destination value.</td>
                </tr>
                <tr>
                  <td>
                    <code>duration</code>
                  </td>
                  <td>
                    <code>number</code>
                  </td>
                  <td>Required. Playback time in milliseconds.</td>
                </tr>
                <tr>
                  <td>
                    <code>curve</code>
                  </td>
                  <td>
                    <code>BezierCurve</code>
                  </td>
                  <td>Required. Cubic Bézier control points.</td>
                </tr>
              </tbody>
            </table>
            <h3 id="easings-reference">easings</h3>
            <p>Built-in curves matching the corresponding CSS easing functions.</p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Control points</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>linear</code>
                  </td>
                  <td>0, 0, 1, 1</td>
                </tr>
                <tr>
                  <td>
                    <code>ease</code>
                  </td>
                  <td>0.25, 0.1, 0.25, 1</td>
                </tr>
                <tr>
                  <td>
                    <code>easeIn</code>
                  </td>
                  <td>0.42, 0, 1, 1</td>
                </tr>
                <tr>
                  <td>
                    <code>easeOut</code>
                  </td>
                  <td>0, 0, 0.58, 1</td>
                </tr>
                <tr>
                  <td>
                    <code>easeInOut</code>
                  </td>
                  <td>0.42, 0, 0.58, 1</td>
                </tr>
              </tbody>
            </table>
            <h3 id="curve-reference">BezierCurve</h3>
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>x1</code>, <code>y1</code>
                  </td>
                  <td>
                    <code>number</code>
                  </td>
                  <td>First control point.</td>
                </tr>
                <tr>
                  <td>
                    <code>x2</code>, <code>y2</code>
                  </td>
                  <td>
                    <code>number</code>
                  </td>
                  <td>Second control point.</td>
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
                    <code>TweenOptions</code>
                  </td>
                  <td>
                    Options accepted by <code>tween()</code>.
                  </td>
                </tr>
                <tr>
                  <td>
                    <code>BezierCurve</code>
                  </td>
                  <td>
                    Control points accepted by <code>curve</code> and used by <code>easings</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )
      },
    },
  ],
} satisfies UiDocs

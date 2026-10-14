import type { UiDocs } from '../docs/types.ts'

export default {
  title: 'Layout',
  slug: 'layout',
  category: 'animation',
  description: 'Animate position and size changes between renders.',
  importPath: '@remix-run/ui/animation',
  examples: [
    {
      id: 'reordering',
      title: 'Layout animation',
      description: '',
      module: new URL('./layout/reordering.example.tsx', import.meta.url),
    },
    {
      id: 'selection',
      previewSize: 'compact',
      title: 'Size animation',
      description: '',
      module: new URL('./layout/selection.example.tsx', import.meta.url),
      section: 'size-animation',
    },
  ],
  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy',
      content() {
        return (
          <>
            <p>Apply the mixin to each element and use stable keys for collections.</p>
          </>
        )
      },
      code: [
        {
          source:
            "import { animateLayout } from '@remix-run/ui/animation'\n\n{items.map((item) => (\n  <div key={item.id} mix={animateLayout()}>{item.title}</div>\n))}",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'options',
      title: 'Position-only animation',
      content() {
        return (
          <>
            <p>
              Set <code>size: false</code> to animate position while dimensions update immediately.
              This avoids stretching text and icons when the element resizes.
            </p>
          </>
        )
      },
      code: [
        {
          source: "<div mix={animateLayout({ ...spring('snappy'), size: false })}>Revenue</div>",
          language: 'tsx',
        },
      ],
    },
    {
      id: 'size-animation',
      title: 'Animating size',
      content() {
        return (
          <>
            <p>
              Size animation scales the element and its contents. Animate a separate background or
              indicator to change size without stretching foreground text.
            </p>
          </>
        )
      },
    },
    {
      id: 'transforms',
      title: 'Composing transforms',
      content() {
        return (
          <>
            <p>
              The mixin animates <code>transform</code> and sets <code>transform-origin</code>. Use
              a wrapper when the content needs its own transform.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "<div mix={animateLayout()}>\n  <div mix={css({ transform: 'rotate(-2deg)' })}>Preview</div>\n</div>",
          language: 'tsx',
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
              Disable the mixin when the user prefers reduced motion. Layout changes then take
              effect immediately.
            </p>
          </>
        )
      },
      code: [
        {
          source:
            "let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches\n\nanimateLayout(reducedMotion ? false : { ...spring('smooth') })",
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
                    True. Scales the element when its dimensions change. False animates position
                    only.
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Uses the Web Animations API. Reduced-motion preferences are not read automatically.
              The mixin clears its temporary transforms when playback finishes or the element is
              removed.
            </p>
          </>
        )
      },
    },
  ],
} satisfies UiDocs

import type { Handle } from 'remix/component'
import type { PageMeta, PageProps } from '../../data/pages.ts'
import { highlightSource, loadExample } from '../../data/examples.tsx'
import { Example } from '../example.tsx'
import { CodeBlock, PageLayout, Section } from '../page.tsx'
import { ApiEntry, ApiTable } from '../api-table.tsx'

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
  import { spring } from '@remix-run/ui/animation'
  import { css } from 'remix/component'

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
  <div
    mix={[
      animateEntrance({
        opacity: 0,
        ...spring('snappy'),
      }),
      animateExit({
        opacity: 0,
        ...spring('snappy'),
      }),
    ]}
  >
    Saved
  </div>
`)

const typeDefinitions = {
  SpringPreset: await highlightSource(`export type SpringPreset = 'smooth' | 'snappy' | 'bouncy'`),
  SpringOptions: await highlightSource(
    `export interface SpringOptions {
  duration?: number
  bounce?: number
  velocity?: number
}`,
  ),
  SpringIterator: await highlightSource(
    `export interface SpringIterator extends IterableIterator<number> {
  duration: number
  easing: string
  toString(): string
}`,
  ),
}

export default function SpringPage(handle: Handle<PageProps>) {
  return () => (
    <PageLayout page={meta} pages={handle.props.pages}>
      <Example id="billing" example={billing} hero />
      <Section id="anatomy" title="Anatomy">
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
          <code>duration</code> sets the perceptual duration, <code>bounce</code> controls overshoot
          and <code>velocity</code> sets the initial speed. The calculated settling duration
          determines when playback ends.
        </p>

        <Example id="custom" example={custom} />
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
          Spread a spring into the timing options for <code>element.animate()</code>.
        </p>

        <Example id="web-animations-example" example={webAnimationsExample} />
      </Section>
      <Section id="mixins" title="Animation mixins">
        <p>
          Spread spring timing into <a href="/animation/entrance-exit/">entrance and exit</a> or{' '}
          <a href="/animation/layout/">layout</a> mixins.
        </p>

        <CodeBlock html={mixinsCode} />
      </Section>
      <Section id="javascript" title="Progress iterator">
        <p>
          A spring iterator yields numeric progress samples, including overshoot. Iteration is
          synchronous, with samples calculated at approximately 60 per second. Taking one sample per
          animation frame ties playback speed to the display's refresh rate. For timestamp-based
          playback, use <a href="/animation/tween/">Tween</a> or browser animation APIs.
        </p>

        <Example id="iterator-example" example={iteratorExample} />
      </Section>
      <Section id="accessibility" title="Reduced motion">
        <p>
          See <a href="/animation/reduced-motion/">Reduced motion</a> for CSS media queries and
          JavaScript preference checks.
        </p>
      </Section>
      <Section id="api-reference" title="API reference">
        <h3 id="spring-reference">spring(presetOrOptions?, overrides?)</h3>
        <p>
          Computes a motion profile and returns a <code>SpringIterator</code>. Playback is handled
          by CSS, the browser or your code.
        </p>
        <ApiTable id="spring-parameters" label="Argument" defaults>
          <ApiEntry
            name="presetOrOptions"
            type="SpringPreset | SpringOptions"
            defaultValue="'snappy'"
          >
            A preset name or an options object with its own field defaults.
          </ApiEntry>
          <ApiEntry name="overrides" type="Omit<SpringOptions, 'bounce'>">
            Overrides duration or velocity when using a named preset. To change bounce, use an
            options object.
          </ApiEntry>
        </ApiTable>
        <h4>SpringOptions</h4>
        <ApiTable id="springoptions-options" label="Option" defaults>
          <ApiEntry name="duration" type="number" defaultValue="300">
            Perceptual duration in milliseconds used to derive stiffness. The returned settling
            duration may be longer.
          </ApiEntry>
          <ApiEntry name="bounce" type="number" defaultValue="0">
            Negative values produce overdamped motion, zero is critically damped and positive values
            oscillate around the target. Clamped between -1 and 0.95.
          </ApiEntry>
          <ApiEntry name="velocity" type="number" defaultValue="0">
            Initial velocity in progress units per second.
          </ApiEntry>
        </ApiTable>
        <p>
          <code>spring()</code> uses the snappy preset's 200 ms perceptual duration.{' '}
          <code>{'spring({})'}</code> uses the options default of 300 ms.
        </p>
        <h4>SpringIterator</h4>
        <ApiTable id="springiterator-members" label="Member">
          <ApiEntry name="duration" type="number">
            Calculated settling time in milliseconds. Enumerable.
          </ApiEntry>
          <ApiEntry name="easing" type="string">
            CSS <code>linear()</code> easing. Enumerable. Spreading the iterator supplies duration
            and easing.
          </ApiEntry>
          <ApiEntry name="toString()" type="() => string">
            Duration and easing pair suitable for CSS transition timing.
          </ApiEntry>
          <ApiEntry name="Iteration" type="IterableIterator<number>">
            Finite sequence of progress samples ending at exactly 1. Values can overshoot and are
            not clamped to zero through one. Iteration consumes the sequence.
          </ApiEntry>
        </ApiTable>
        <h3 id="transition-reference">spring.transition(property, presetOrOptions?, overrides?)</h3>
        <p>
          Returns a CSS transition string. Timing arguments follow <code>spring()</code>. Requires
          browser support for <code>linear()</code> easing.
        </p>
        <ApiTable id="transition-parameters" label="Argument" defaults>
          <ApiEntry name="property" type="string | string[]" required>
            One or several CSS property names.
          </ApiEntry>
          <ApiEntry
            name="presetOrOptions"
            type="SpringPreset | SpringOptions"
            defaultValue="'snappy'"
          >
            A preset name or custom spring options.
          </ApiEntry>
          <ApiEntry name="overrides" type="Omit<SpringOptions, 'bounce'>">
            Duration and velocity overrides for a preset.
          </ApiEntry>
        </ApiTable>
        <p>
          A spring can also be interpolated directly into a timing string, such as{' '}
          <code>{'`transform ${spring("bouncy")}`'}</code>.
        </p>
        <h3 id="presets-api-reference">spring.presets</h3>
        <p>Exposes the parameters for each named preset.</p>
        <ApiTable id="presets-api-presets" label="Preset" typeLabel="Configuration">
          <ApiEntry name="smooth" type="{ duration: 400, bounce: -0.3 }">
            Overdamped motion without overshoot.
          </ApiEntry>
          <ApiEntry name="snappy" type="{ duration: 200, bounce: 0 }">
            Critically damped motion without overshoot.
          </ApiEntry>
          <ApiEntry name="bouncy" type="{ duration: 400, bounce: 0.3 }">
            Underdamped motion with overshoot.
          </ApiEntry>
        </ApiTable>
        <h3 id="types-reference">Exported types</h3>
        <ApiTable id="types-types">
          <ApiEntry
            id="type-SpringPreset"
            name="SpringPreset"
            type="'smooth' | 'snappy' | 'bouncy'"
          >
            <p>A named spring motion profile.</p>
            <CodeBlock html={typeDefinitions.SpringPreset} />
          </ApiEntry>
          <ApiEntry id="type-SpringOptions" name="SpringOptions" type="interface">
            <p>Perceptual duration, bounce and initial velocity.</p>
            <CodeBlock html={typeDefinitions.SpringOptions} />
          </ApiEntry>
          <ApiEntry id="type-SpringIterator" name="SpringIterator" type="interface">
            <p>Progress iterator with duration, easing and string conversion.</p>
            <CodeBlock html={typeDefinitions.SpringIterator} />
          </ApiEntry>
        </ApiTable>
      </Section>
    </PageLayout>
  )
}

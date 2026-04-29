import type { RemixTestConfig } from '@remix-run/test'
import { glob } from 'fs/promises'

// All converted-to-remix-test files. Listed individually so `remix-test` only
// runs the migrated suites; the rest still run under vitest. Add a file here
// when you swap its imports from `vitest` to `@remix-run/test`/`@remix-run/assert`.
//
// All entries also appear in `browser` because every test in this package runs
// in the browser.
const testFiles = [
  'src/animation/animate-layout-mixin.test.tsx',
  'src/animation/animate-mixins.test.tsx',
  'src/components/accordion/accordion.test.tsx',
  'src/components/anchor/anchor.test.ts',
  'src/components/breadcrumbs/breadcrumbs.test.tsx',
  'src/components/button/button.test.tsx',
  'src/components/combobox/combobox.test.tsx',
  'src/components/glyph/glyph.test.tsx',
  'src/components/listbox/listbox.test.tsx',
  'src/components/menu/hover-aim.test.ts',
  'src/components/menu/menu.test.tsx',
  'src/components/popover/popover.test.tsx',
  'src/components/select/select.test.tsx',
  'src/components/tabs/tabs.test.tsx',
  'src/interactions/typeahead/typeahead-mixin.test.tsx',
  'src/runtime/mixins/attrs-mixin.test.tsx',
  'src/runtime/mixins/link-mixin.test.tsx',
  'src/runtime/mixins/on-mixin.test.tsx',
  'src/runtime/mixins/ref-mixin.test.tsx',
  'src/style/css-mixin.test.tsx',
  'src/test/client-entry.test.tsx',
  'src/test/create-element.test.ts',
  'src/test/diff-dom.test.tsx',
  'src/test/document-state.test.ts',
  'src/test/event-listeners.test.tsx',
  'src/test/frame.test.tsx',
  'src/test/hydration.attributes.test.tsx',
  'src/test/hydration.boolean-attrs.test.tsx',
  'src/test/hydration.components.test.tsx',
  'src/test/hydration.css.test.tsx',
  'src/test/hydration.extra-nodes.test.tsx',
  'src/test/hydration.forms.test.tsx',
  'src/test/hydration.mismatch.test.tsx',
  'src/test/hydration.text.test.tsx',
  'src/test/hydration.void-elements.test.tsx',
  'src/test/jsx.test.tsx',
  'src/test/spring.test.ts',
  'src/test/stream.test.tsx',
  'src/test/style.test.ts',
  'src/test/stylesheet.test.ts',
  'src/test/vdom.components.test.tsx',
  'src/test/vdom.connect.test.tsx',
  'src/test/vdom.context.test.tsx',
  'src/test/vdom.dom-order.test.tsx',
  'src/test/vdom.elements-fragments.test.tsx',
  'src/test/vdom.errors.test.tsx',
  'src/test/vdom.events.test.tsx',
  'src/test/vdom.insert-remove.test.tsx',
  'src/test/vdom.keys.test.tsx',
  'src/test/vdom.mixins.test.tsx',
  'src/test/vdom.props.test.tsx',
  'src/test/vdom.range-root.test.tsx',
  'src/test/vdom.replacements.test.tsx',
  'src/test/vdom.scheduler.test.tsx',
  'src/test/vdom.signals.test.tsx',
  'src/test/vdom.svg.test.tsx',
  'src/test/vdom.tasks.test.tsx',
  'src/theme/theme.test.ts',
  'src/utils/scroll-lock.test.tsx',
  'src/utils/wait-for-css-transition.test.ts',
]

export default {
  glob: {
    test: testFiles,
    browser: testFiles,
  },
} satisfies RemixTestConfig

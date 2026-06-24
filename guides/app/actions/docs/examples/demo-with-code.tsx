import { readFile } from 'node:fs/promises'

import { codeToHtml } from 'shiki'
import { clientEntry, css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

import type { AppContext } from '../../../router.ts'

type DemoComponent = (handle: Handle) => () => RemixNode

export type DemoProps = {
  sourceHtml: string
  children: RemixNode
}

// Reads a `.demo.tsx` module from disk and highlights it for display beside the
// live preview. Highlighting is async (shiki), so this runs in the frame handler
// and the resulting HTML is passed to <Demo> as `sourceHtml`.
export async function loadDemoSource(moduleUrl: URL): Promise<string> {
  let source = await readFile(moduleUrl, 'utf8')
  return codeToHtml(source, {
    lang: 'tsx',
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  })
}

// Renders a demo: the live, hydrated component in a preview pane above its own
// highlighted source code.
export function Demo(handle: Handle<DemoProps>) {
  return () => (
    <section data-demo-frame mix={frameStyles}>
      <div data-demo-preview mix={previewStyles}>
        {handle.props.children}
      </div>
      <div data-demo-source mix={sourceCodeStyles} innerHTML={handle.props.sourceHtml} />
    </section>
  )
}

// Builds a frame handler for a "demo with code": hydrates `component`, highlights
// the source at `demoModuleUrl`, and renders both in the shared <Demo> shell.
//
// `component` must be a named export of the `.demo.tsx` module whose name matches
// the function name, so `clientEntry` can resolve the export via `component.name`.
export function demoWithCode(
  demoModuleUrl: URL,
  component: DemoComponent,
): (context: AppContext) => Promise<Response> {
  return async function handler(context) {
    let sourceHtml = await loadDemoSource(demoModuleUrl)
    let DemoComponent = clientEntry(demoModuleUrl.href, component)

    return context.render(
      <Demo sourceHtml={sourceHtml}>
        <DemoComponent />
      </Demo>,
    )
  }
}

const frameStyles = css({
  overflow: 'hidden',
  margin: '1.5rem 0',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  background: 'var(--bg)',
})

const previewStyles = css({
  position: 'relative',
  isolation: 'isolate',
  contain: 'layout paint',
  transform: 'translateZ(0)',
  display: 'grid',
  maxHeight: '36rem',
  minHeight: '12rem',
  overflow: 'auto',
  overscrollBehavior: 'contain',
  padding: '3rem 1.5rem',
  placeItems: 'center',
  background: 'var(--bg)',
})

const sourceCodeStyles = css({
  maxHeight: '32rem',
  overflow: 'auto',
  overscrollBehavior: 'contain',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  '& pre': {
    margin: '0',
    padding: '1.5rem',
    border: '0',
    borderRadius: '0',
  },
})

import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { RMX_01, RMX_01_GLYPHS, theme } from '@remix-run/ui/theme'

import type { DemoFile } from './discovery.ts'

export function DemoIndexDocument(handle: Handle<{ demos: DemoFile[] }>) {
  return () => {
    let { demos } = handle.props
    let demoGroups = groupDemosByModule(demos)

    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Remix UI Demos</title>
          <RMX_01 />
        </head>
        <body mix={bodyCss}>
          <RMX_01_GLYPHS />
          <main mix={indexShellCss}>
            <header mix={indexHeaderCss}>
              <p mix={eyebrowCss}>Remix UI</p>
              <h1 mix={titleCss}>Demos</h1>
              <p mix={descriptionCss}>{demos.length} demo files found in packages/ui.</p>
            </header>
            <div mix={demoGroupsCss}>
              {demoGroups.map((group) => (
                <section key={group.moduleName} mix={demoGroupCss}>
                  <h2 mix={demoGroupTitleCss}>{group.moduleName}</h2>
                  <ol mix={demoListCss}>
                    {group.demos.map((demo) => (
                      <li key={demo.relativePath} mix={demoItemCss}>
                        <a href={demo.href} mix={demoLinkCss}>
                          {demo.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </main>
        </body>
      </html>
    )
  }
}

export function DemoDocument(handle: Handle<{ DemoComponent: any; demo: DemoFile }>) {
  return () => {
    let { DemoComponent, demo } = handle.props
    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <script async type="module" src="/assets/entry.js" />
          <title>{`${demo.title} | Remix UI Demo`}</title>
          <RMX_01 />
        </head>
        <body mix={bodyCss}>
          <RMX_01_GLYPHS />
          <main mix={getDemoStageMix(demo)}>
            {demo.layout === 'center' ? (
              <div mix={centerDemoCanvasCss}>
                <DemoComponent />
              </div>
            ) : (
              <DemoComponent />
            )}
          </main>
        </body>
      </html>
    )
  }
}

const bodyCss = css({
  margin: 0,
  minHeight: '100vh',
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  fontFamily: theme.fontFamily.sans,
})

const indexShellCss = css({
  width: 'min(100% - 32px, 720px)',
  marginInline: 'auto',
  paddingBlock: theme.space.xl,
})

const indexHeaderCss = css({
  display: 'grid',
  gap: theme.space.xs,
  marginBottom: theme.space.lg,
})

const eyebrowCss = css({
  margin: 0,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  textTransform: 'uppercase',
})

const titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxl,
  lineHeight: theme.lineHeight.tight,
})

const descriptionCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const demoGroupsCss = css({
  display: 'grid',
  gap: theme.space.lg,
})

const demoGroupCss = css({
  display: 'grid',
  gap: theme.space.xs,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
})

const demoGroupTitleCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const demoListCss = css({
  display: 'grid',
  gap: theme.space.px,
  padding: 0,
  margin: 0,
  listStyle: 'none',
})

const demoItemCss = css({
  display: 'flex',
  minWidth: 0,
})

const demoLinkCss = css({
  width: '100%',
  paddingBlock: theme.space.xs,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.normal,
  lineHeight: theme.lineHeight.normal,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  '&:hover': {
    color: theme.colors.text.link,
  },
})

const demoStageCss = css({
  width: '100%',
  minHeight: '100vh',
  minWidth: 0,
  boxSizing: 'border-box',
})

const centerDemoStageCss = css({
  display: 'grid',
  placeItems: 'center',
  padding: theme.space.xxl,
  backgroundColor: 'color-mix(in oklab, rgb(246 246 246) 72%, white)',
})

const centerDemoCanvasCss = css({
  width: 'fit-content',
  maxWidth: 'min(100%, 44rem)',
  minHeight: '18rem',
  display: 'grid',
  placeItems: 'center',
})

function getDemoStageMix(demo: DemoFile) {
  return demo.layout === 'center' ? [demoStageCss, centerDemoStageCss] : demoStageCss
}

type DemoGroup = {
  demos: DemoFile[]
  moduleName: string
}

function groupDemosByModule(demos: DemoFile[]): DemoGroup[] {
  let groups = new Map<string, DemoFile[]>()

  for (let demo of demos) {
    let moduleName = getDemoModuleName(demo)
    let group = groups.get(moduleName)

    if (group) {
      group.push(demo)
    } else {
      groups.set(moduleName, [demo])
    }
  }

  return [...groups]
    .map(([moduleName, groupDemos]) => ({ demos: groupDemos, moduleName }))
    .sort((a, b) => a.moduleName.localeCompare(b.moduleName))
}

function getDemoModuleName(demo: DemoFile) {
  let segments = demo.relativePath.split('/')

  if (segments[0] === 'src') {
    if (segments[1] === 'components' && segments[2]) return humanizeModuleName(segments[2])
    if (segments[1]) return humanizeModuleName(segments[1])
  }

  if (segments[0] === 'demo' && segments[1] === 'cases' && segments[2]) {
    return humanizeModuleName(segments[2])
  }

  return 'Other'
}

function humanizeModuleName(name: string) {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

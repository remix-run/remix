import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { theme } from './design.ts'

import type { DemoFile } from './discovery.ts'

export function DemoIndexDocument(handle: Handle<{ demos: DemoFile[] }>) {
  return () => {
    let { demos } = handle.props
    let demoSections = groupDemosBySection(demos)

    return (
      <html>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Remix Interface Demos</title>
        </head>
        <body mix={bodyCss}>
          <main mix={indexShellCss}>
            <header mix={indexHeaderCss}>
              <p mix={eyebrowCss}>Remix interface</p>
              <h1 mix={titleCss}>Demos</h1>
              <p mix={descriptionCss}>{demos.length} demo files found across the UI package.</p>
            </header>
            <div mix={demoSectionsCss}>
              {demoSections.map((section) => (
                <section key={section.title} mix={demoSectionCss}>
                  <header mix={demoSectionHeaderCss}>
                    <h2 mix={demoSectionTitleCss}>{section.title}</h2>
                    <p mix={demoSectionDescriptionCss}>{section.description}</p>
                  </header>
                  <div mix={demoGroupsCss}>
                    {section.groups.map((group) => (
                      <section key={group.moduleName} mix={demoGroupCss}>
                        <h3 mix={demoGroupTitleCss}>{group.moduleName}</h3>
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
          <title>{`${demo.title} | Remix Interface Demo`}</title>
        </head>
        <body mix={bodyCss}>
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
  width: 'min(100% - 48px, 1040px)',
  marginInline: 'auto',
  paddingBlock: theme.space.xxl,
})

const indexHeaderCss = css({
  display: 'grid',
  gap: theme.space.xs,
  marginBottom: theme.space.xxl,
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
  maxWidth: '44rem',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

const demoSectionsCss = css({
  display: 'grid',
  gap: '40px',
})

const demoSectionCss = css({
  display: 'grid',
  gap: theme.space.lg,
})

const demoSectionHeaderCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

const demoSectionTitleCss = css({
  margin: 0,
  fontSize: '24px',
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const demoSectionDescriptionCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

const demoGroupsCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  alignItems: 'start',
  columnGap: theme.space.xxl,
  rowGap: theme.space.xxl,
})

const demoGroupCss = css({
  display: 'grid',
  gap: theme.space.xs,
  minWidth: 0,
})

const demoGroupTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const demoListCss = css({
  display: 'grid',
  gap: '2px',
  padding: 0,
  margin: 0,
  listStyle: 'none',
})

const demoItemCss = css({
  display: 'flex',
  minWidth: 0,
})

const demoLinkCss = css({
  display: 'block',
  width: '100%',
  paddingBlock: '1px',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
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

type DemoSection = {
  description: string
  groups: DemoGroup[]
  title: string
}

function groupDemosBySection(demos: DemoFile[]): DemoSection[] {
  let componentDemos = demos.filter(isComponentDemo)
  let generalDemos = demos.filter((demo) => !isComponentDemo(demo))

  return [
    {
      title: 'Built-in components',
      description: 'Styled and primitive demos for the first-party UI component modules.',
      groups: groupDemosByModule(componentDemos),
    },
    {
      title: 'General demos',
      description: 'Broader interaction, runtime, and playground demos.',
      groups: groupDemosByModule(generalDemos),
    },
  ].filter((section) => section.groups.length > 0)
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
    let sourceRoot = segments[1]
    let moduleName = getSourceDemoModuleName(sourceRoot, segments[2], segments[3])
    if (moduleName) return moduleName
  }

  if (segments[0] === 'cases' && segments[1]) {
    return humanizeModuleName(segments[1])
  }

  return 'Other'
}

function isComponentDemo(demo: DemoFile) {
  return demo.relativePath.startsWith('src/components/')
}

function getSourceDemoModuleName(
  sourceRoot: string | undefined,
  moduleName: string | undefined,
  submoduleName: string | undefined,
) {
  if (!sourceRoot || !moduleName) {
    return undefined
  }

  if (moduleName === 'demos' && submoduleName) {
    return humanizeModuleName(sourceRoot)
  }

  return humanizeModuleName(moduleName)
}

function humanizeModuleName(name: string) {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

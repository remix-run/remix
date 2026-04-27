import { ExplorerExampleCard } from '../example-card.tsx'
import {
  exampleGridCss,
  featureGridCss,
  PageSection,
  pageStackCss,
  ShowcaseLinkCard,
} from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const componentLinks = [
  {
    description:
      'The thin button wrapper and slot-level styles for ordinary actions and custom structure.',
    eyebrow: 'Component',
    href: '/components/button',
    title: 'Button',
  },
  {
    description:
      'The first behavior-heavy proof point for the theme/style-namespace/component split.',
    eyebrow: 'Component',
    href: '/components/accordion',
    title: 'Accordion',
  },
  {
    description: 'A thin convenience component that should stay easy to decompose.',
    eyebrow: 'Component',
    href: '/components/breadcrumbs',
    title: 'Breadcrumbs',
  },
  {
    description:
      'The input-first popup control for filtering draft text down to one committed value.',
    eyebrow: 'Component',
    href: '/components/combobox',
    title: 'Combobox',
  },
  {
    description: 'The low-level anchored surface primitive behind popup-backed controls.',
    eyebrow: 'Primitive',
    href: '/components/popover',
    title: 'Popover',
  },
  {
    description:
      'The headless value-picker primitive that owns highlight, focus, and selection mechanics.',
    eyebrow: 'Component',
    href: '/components/listbox',
    title: 'Listbox',
  },
  {
    description:
      'The ordinary single-select popup control with built-in focus choreography and form support.',
    eyebrow: 'Component',
    href: '/components/select',
    title: 'Select',
  },
  {
    description:
      'Action-oriented popup menus with component-owned styling contracts and bubbling select events.',
    eyebrow: 'Component',
    href: '/components/menu',
    title: 'Menu',
  },
] as const

const representativeExamples = [
  EXAMPLES.buttonAliases,
  EXAMPLES.accordionOverview,
  EXAMPLES.breadcrumbsBasic,
  EXAMPLES.comboboxOverview,
  EXAMPLES.listboxOverview,
  EXAMPLES.popoverOverview,
  EXAMPLES.selectOverview,
  EXAMPLES.selectDeconstructed,
  EXAMPLES.menuButtonOverview,
]

export function renderComponentsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Current component surface"
        description="These are the first components worth judging as a public library surface today."
      >
        <div mix={featureGridCss}>
          {componentLinks.map((link) => (
            <ShowcaseLinkCard
              key={link.href}
              description={link.description}
              eyebrow={link.eyebrow}
              href={link.href}
              title={link.title}
            />
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Representative examples"
        description="The default examples should read like the product surface a future user would actually browse."
      >
        <div mix={exampleGridCss}>
          {representativeExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}

interface ExhibitBase {
  id: string
  title: string
  description: string
}

export interface HtmlExhibit extends ExhibitBase {
  kind: 'html'
}

export interface UiExhibit extends ExhibitBase {
  kind: 'ui'
  metric: string
  metricLabel: string
  trend: string
  details: string[]
}

export interface InteractiveExhibit extends ExhibitBase {
  kind: 'interactive'
  initialCount: number
  actionLabel: string
  prompt: string
  accent: 'coral' | 'violet' | 'teal'
}

export type Exhibit = HtmlExhibit | UiExhibit | InteractiveExhibit

export const motionArtifact = {
  id: 'edition-orbit',
  title: 'Edition orbit',
} as const

export const exhibits: Exhibit[] = [
  {
    kind: 'html',
    id: 'field-notes',
    title: 'Stream a checked-in fragment',
    description: 'A file response supplies Frame content without invoking the Remix UI renderer.',
  },
  {
    kind: 'ui',
    id: 'signal-board',
    title: 'Three kinds of Frame response',
    description:
      'A server-rendered component returns Remix UI, generated CSS, and request-time data.',
    metric: '3',
    metricLabel: 'Response types in this demo',
    trend: 'All three use the same LazyFrame boundary.',
    details: ['HTML streamed from disk', 'Server-rendered Remix UI', 'Remix UI + client entry'],
  },
  {
    kind: 'interactive',
    id: 'idea-counter',
    title: 'Hydrate a client component',
    description: 'The Frame response contains a client entry that hydrates after insertion.',
    initialCount: 12,
    actionLabel: 'Increment local count',
    prompt: 'This counter is a client component inside the Frame response.',
    accent: 'violet',
  },
  {
    kind: 'html',
    id: 'packing-list',
    title: 'Keep the file route explicit',
    description: 'Known route IDs map to checked-in files; unknown IDs return a 404 response.',
  },
  {
    kind: 'ui',
    id: 'studio-schedule',
    title: 'Load before the viewport arrives',
    description: 'The preload distance is configurable without changing the Frame response.',
    metric: '320 px',
    metricLabel: 'Default vertical preload margin',
    trend: 'Applied above and below the viewport.',
    details: [
      'One-shot load observer',
      'Configurable rootMargin',
      'No request before intersection',
    ],
  },
  {
    kind: 'interactive',
    id: 'theme-state',
    title: 'Keep state through a theme change',
    description: 'Local client state arrives only after this Frame approaches the viewport.',
    initialCount: 31,
    actionLabel: 'Increment local count',
    prompt: 'Document theme changes do not remount this client component.',
    accent: 'coral',
  },
  {
    kind: 'html',
    id: 'reading-list',
    title: 'Frame content joins the document',
    description:
      'Static HTML can inherit parent styles and theme tokens without a component runtime.',
  },
  {
    kind: 'ui',
    id: 'release-health',
    title: 'Load once, keep the Frame',
    description:
      'The Frame response contains server-rendered components and their generated styles.',
    metric: '1×',
    metricLabel: 'Frame mount per section',
    trend: 'Leaving the viewport does not unmount it.',
    details: [
      'Loaded DOM stays in place',
      'Scrolling back makes no request',
      'Local client state stays intact',
    ],
  },
  {
    kind: 'interactive',
    id: 'retained-counter',
    title: 'Scroll away and come back',
    description: 'The last Frame inserts and hydrates a client component near the end of the page.',
    initialCount: 24,
    actionLabel: 'Increment local count',
    prompt: 'Leaving the viewport does not unmount this client component.',
    accent: 'teal',
  },
]

export function getExhibit(id: string): Exhibit | undefined {
  return exhibits.find((exhibit) => exhibit.id === id)
}

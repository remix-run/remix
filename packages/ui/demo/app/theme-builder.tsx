import { css, on, type Handle, type RemixNode } from 'remix/component'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@remix-run/ui/accordion'
import { Breadcrumbs } from '@remix-run/ui/breadcrumbs'
import { Button } from '@remix-run/ui/button'
import { Combobox, ComboboxOption, onComboboxChange } from '@remix-run/ui/combobox'
import { Glyph } from '@remix-run/ui/glyph'
import * as listbox from '@remix-run/ui/listbox'
import type { ListboxValue } from '@remix-run/ui/listbox'
import * as menu from '@remix-run/ui/menu'
import * as popover from '@remix-run/ui/popover'
import { Option, Select } from '@remix-run/ui/select'
import { createTheme, RMX_01, theme, type ThemeValues } from '@remix-run/ui/theme'

type ThemeLeafValue = string | number
type ThemeLeafPath = string[]
type ThemeLeafInput = 'color' | 'range' | 'text'

type ThemeToken = {
  group: string
  input: ThemeLeafInput
  label: string
  path: ThemeLeafPath
  range?: {
    max: number
    min: number
    step: number
    unit: string
    value: number
  }
}

type ThemeTokenGroup = {
  id: string
  label: string
  tokens: ThemeToken[]
}

const DEFAULT_THEME_VALUES = RMX_01.values
const THEME_TOKEN_GROUPS = createThemeTokenGroups(DEFAULT_THEME_VALUES)
const DEFAULT_OPEN_TOKEN_GROUPS = THEME_TOKEN_GROUPS.slice(0, 1).map((group) => group.id)
const THEME_TOKEN_COUNT = THEME_TOKEN_GROUPS.reduce(
  (count, group) => count + group.tokens.length,
  0,
)

const AIRPORT_OPTIONS = [
  { label: 'Austin Bergstrom', searchValue: ['aus', 'austin'], value: 'aus' },
  { label: 'Chicago O Hare', searchValue: ['ord', 'chicago'], value: 'ord' },
  { label: 'Los Angeles', searchValue: ['lax', 'los angeles'], value: 'lax' },
  { label: 'New York JFK', searchValue: ['jfk', 'new york'], value: 'jfk' },
  { label: 'San Francisco', searchValue: ['sfo', 'san francisco'], value: 'sfo' },
]

const LISTBOX_OPTIONS = [
  { label: 'Planning', value: 'planning' },
  { label: 'Design', value: 'design' },
  { label: 'Build', value: 'build' },
  { label: 'Review', value: 'review' },
]

export function ThemeBuilder(handle: Handle) {
  let values = cloneThemeValues(DEFAULT_THEME_VALUES)

  function setToken(path: ThemeLeafPath, value: ThemeLeafValue) {
    values = updateThemeValue(values, path, value)
    void handle.update()
  }

  function resetTheme() {
    values = cloneThemeValues(DEFAULT_THEME_VALUES)
    void handle.update()
  }

  function downloadTheme() {
    let file = new Blob([createThemeFile(values)], { type: 'text/typescript;charset=utf-8' })
    let href = URL.createObjectURL(file)
    let link = document.createElement('a')
    link.href = href
    link.download = 'theme.ts'
    link.click()
    URL.revokeObjectURL(href)
  }

  return () => {
    let PreviewTheme = createTheme(values, {
      reset: false,
      selector: '[data-theme-preview]',
    })

    return (
      <div mix={pageCss}>
        <aside mix={editorPanelCss} aria-label="Theme token controls">
          <div mix={editorHeaderCss}>
            <div>
              <p mix={eyebrowCss}>Remix UI (WIP)</p>
              <h2 mix={sectionTitleCss}>Theme Builder</h2>
              <p mix={mutedTextCss}>
                This is a work in progress but gives you an idea of what we're working on for Remix
                UI.
              </p>
            </div>
            <div mix={editorActionsCss}>
              <Button mix={on('click', resetTheme)} tone="secondary">
                Reset
              </Button>
              <Button mix={on('click', downloadTheme)} tone="primary">
                Download
              </Button>
            </div>
          </div>

          <Accordion type="multiple" mix={tokenGroupListCss}>
            {THEME_TOKEN_GROUPS.map((group) => (
              <AccordionItem key={group.id} value={group.id} mix={tokenGroupCss}>
                <AccordionTrigger>{group.label}</AccordionTrigger>
                <AccordionContent>
                  <div mix={tokenListCss}>
                    {group.tokens.map((token) => (
                      <TokenControl
                        key={token.label}
                        token={token}
                        value={readThemeValue(values, token.path)}
                        onChange={(value) => setToken(token.path, value)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </aside>

        <main data-theme-preview="" mix={previewPanelCss}>
          <PreviewTheme />
          <ComponentGallery />
        </main>
      </div>
    )
  }
}

function TokenControl() {
  return ({
    onChange,
    token,
    value,
  }: {
    onChange: (value: ThemeLeafValue) => void
    token: ThemeToken
    value: ThemeLeafValue
  }) => {
    let range = getRangeInput(value, token.path)

    return (
      <label mix={tokenControlCss}>
        <span mix={tokenLabelCss}>{token.label}</span>
        <span mix={tokenInputsCss}>
          {token.input === 'color' && typeof value === 'string' ? (
            <input
              aria-label={`${token.label} color`}
              mix={[
                colorInputCss,
                on('input', (event) => {
                  onChange(event.currentTarget.value)
                }),
              ]}
              type="color"
              value={value}
            />
          ) : null}
          {range ? (
            <input
              aria-label={`${token.label} range`}
              max={range.max}
              min={range.min}
              mix={[
                rangeInputCss,
                on('input', (event) => {
                  onChange(`${event.currentTarget.value}${range.unit}`)
                }),
              ]}
              step={range.step}
              type="range"
              value={range.value}
            />
          ) : null}
          <input
            aria-label={`${token.label} value`}
            mix={[
              textInputCss,
              on('input', (event) => {
                onChange(event.currentTarget.value)
              }),
            ]}
            type="text"
            value={String(value)}
          />
        </span>
      </label>
    )
  }
}

function ComponentGallery() {
  return () => (
    <div mix={previewStackCss}>
      <div mix={componentGridCss}>
        <PreviewCard
          title="Button"
          description="Primary, secondary, ghost, danger, and icon slots."
        >
          <div mix={buttonClusterCss}>
            <Button startIcon={<Glyph name="add" />} tone="primary">
              Create
            </Button>
            <Button tone="secondary">Preview</Button>
            <Button tone="ghost">Ghost</Button>
            <Button tone="danger">Delete</Button>
          </div>
        </PreviewCard>

        <PreviewCard
          title="Breadcrumbs"
          description="Navigation text, separators, and current item."
        >
          <Breadcrumbs
            items={[
              { href: '#workspace', label: 'Workspace' },
              { href: '#projects', label: 'Projects' },
              { current: true, label: 'Theme Builder' },
            ]}
          />
        </PreviewCard>

        <PreviewCard title="Accordion" description="Disclosure rhythm, panel copy, and indicators.">
          <Accordion defaultValue="tokens">
            <AccordionItem value="tokens">
              <AccordionTrigger>Token changes</AccordionTrigger>
              <AccordionContent>
                Changing a token updates every consumer below this scoped preview.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="exports">
              <AccordionTrigger>Download output</AccordionTrigger>
              <AccordionContent>
                The generated file exports a `createTheme(...)` call with the current values.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </PreviewCard>

        <PreviewCard title="Select" description="Trigger, popup, option, and selected states.">
          <Field label="Density" htmlFor="theme-builder-density">
            <Select
              defaultLabel="Comfortable"
              defaultValue="comfortable"
              id="theme-builder-density"
              name="density"
              mix={controlWidthCss}
            >
              <Option label="Compact" value="compact" />
              <Option label="Comfortable" value="comfortable" />
              <Option label="Roomy" value="roomy" />
            </Select>
          </Field>
        </PreviewCard>

        <PreviewCard title="Combobox" description="Input, filtered popup, active option, and text.">
          <ComboboxPreview />
        </PreviewCard>

        <PreviewCard
          title="Listbox"
          description="Headless option styling, highlight, and selection."
        >
          <ListboxPreview />
        </PreviewCard>

        <PreviewCard title="Menu" description="Action menu, checkboxes, radios, and submenus.">
          <MenuPreview />
        </PreviewCard>

        <PreviewCard
          title="Popover"
          description="Anchored surface, nested controls, and focus ring."
        >
          <PopoverPreview />
        </PreviewCard>
      </div>
    </div>
  )
}

function PreviewCard() {
  return ({
    children,
    description,
    title,
  }: {
    children: RemixNode
    description: string
    title: string
  }) => (
    <article mix={previewCardCss}>
      <div mix={previewCardHeaderCss}>
        <h3 mix={cardTitleCss}>{title}</h3>
        <p mix={cardDescriptionCss}>{description}</p>
      </div>
      <div mix={previewCardBodyCss}>{children}</div>
    </article>
  )
}

function Field() {
  return ({
    children,
    htmlFor,
    label,
  }: {
    children: RemixNode
    htmlFor: string
    label: string
  }) => (
    <div mix={fieldCss}>
      <label for={htmlFor} mix={fieldLabelCss}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ComboboxPreview(handle: Handle) {
  let value: string | null = null

  return () => (
    <div mix={stackCss}>
      <Field htmlFor={`${handle.id}-airport`} label="Airport">
        <Combobox
          inputId={`${handle.id}-airport`}
          mix={[
            controlWidthCss,
            onComboboxChange((event) => {
              value = event.value
              void handle.update()
            }),
          ]}
          name="airport"
          placeholder="Search airport"
        >
          {AIRPORT_OPTIONS.map((airport) => (
            <ComboboxOption
              key={airport.value}
              label={airport.label}
              searchValue={airport.searchValue}
              value={airport.value}
            />
          ))}
        </Combobox>
      </Field>
      <p mix={monoValueCss}>{`value=${value ?? 'null'}`}</p>
    </div>
  )
}

function ListboxPreview(handle: Handle) {
  let value: ListboxValue = LISTBOX_OPTIONS[1]!.value
  let activeValue: ListboxValue = LISTBOX_OPTIONS[1]!.value

  return () => (
    <listbox.Context
      value={value}
      activeValue={activeValue}
      flashSelection={true}
      onSelect={(nextValue) => {
        value = nextValue
        void handle.update()
      }}
      onHighlight={(nextActiveValue) => {
        activeValue = nextActiveValue
        void handle.update()
      }}
    >
      <div tabIndex={0} mix={[listbox.listStyle, listbox.list(), listboxSurfaceCss]}>
        {LISTBOX_OPTIONS.map((option) => (
          <div key={option.value} mix={[listbox.optionStyle, listbox.option(option)]}>
            <Glyph mix={listbox.glyphStyle} name="check" />
            <span mix={listbox.labelStyle}>{option.label}</span>
          </div>
        ))}
      </div>
    </listbox.Context>
  )
}

function MenuPreview() {
  return () => (
    <div aria-hidden="true" mix={staticMenuPreviewCss}>
      <div mix={[menu.listStyle, staticMenuSurfaceCss]} role="menu">
        <div aria-checked="true" mix={menu.itemStyle} role="menuitemcheckbox">
          <span mix={menu.itemSlotStyle}>
            <Glyph mix={menu.itemGlyphStyle} name="check" />
          </span>
          <span mix={menu.itemLabelStyle}>Word wrap</span>
        </div>
        <div aria-checked="false" mix={menu.itemStyle} role="menuitemcheckbox">
          <span mix={menu.itemSlotStyle}>
            <Glyph mix={menu.itemGlyphStyle} name="check" />
          </span>
          <span mix={menu.itemLabelStyle}>Minimap</span>
        </div>
        <div
          aria-controls="theme-builder-static-density-menu"
          aria-expanded="true"
          aria-haspopup="menu"
          id="theme-builder-static-density-trigger"
          mix={menu.itemStyle}
          role="menuitem"
          tabIndex={-1}
        >
          <span mix={menu.itemSlotStyle}>
            <Glyph mix={menu.itemGlyphStyle} name="check" />
          </span>
          <span mix={menu.itemLabelStyle}>Density</span>
          <Glyph mix={menu.triggerGlyphStyle} name="chevronRight" />
        </div>
      </div>
      <div
        data-anchor-placement="right-start"
        data-menu-submenu="true"
        mix={[menu.listStyle, menu.popoverStyle, staticMenuSurfaceCss, staticSubmenuSurfaceCss]}
        role="menu"
        id="theme-builder-static-density-menu"
      >
        <div aria-checked="true" mix={menu.itemStyle} role="menuitemradio">
          <span mix={menu.itemSlotStyle}>
            <Glyph mix={menu.itemGlyphStyle} name="check" />
          </span>
          <span mix={menu.itemLabelStyle}>Comfortable</span>
        </div>
        <div aria-checked="false" mix={menu.itemStyle} role="menuitemradio">
          <span mix={menu.itemSlotStyle}>
            <Glyph mix={menu.itemGlyphStyle} name="check" />
          </span>
          <span mix={menu.itemLabelStyle}>Compact</span>
        </div>
      </div>
    </div>
  )
}

function PopoverPreview(handle: Handle) {
  let open = false

  function closePopover() {
    open = false
    void handle.update()
  }

  return () => (
    <popover.Context>
      <Button
        endIcon={<Glyph name="chevronDown" />}
        mix={[
          popover.anchor({ placement: 'bottom' }),
          popover.focusOnHide(),
          on('click', () => {
            open = !open
            void handle.update()
          }),
        ]}
        tone="secondary"
      >
        Filters
      </Button>

      <div
        mix={[
          popover.surfaceStyle,
          popover.surface({
            closeOnAnchorClick: false,
            open,
            onHide() {
              closePopover()
            },
          }),
        ]}
      >
        <div mix={[popover.contentStyle, popoverPanelCss]}>
          <Field htmlFor={`${handle.id}-status`} label="Status">
            <Select
              defaultLabel="Any status"
              defaultValue="any"
              id={`${handle.id}-status`}
              mix={[controlWidthCss, popover.focusOnShow()]}
              name="status"
            >
              <Option label="Any status" value="any" />
              <Option label="Open" value="open" />
              <Option label="Closed" value="closed" />
            </Select>
          </Field>
          <Button mix={on('click', closePopover)} tone="ghost">
            Done
          </Button>
        </div>
      </div>
    </popover.Context>
  )
}

function createThemeTokenGroups(values: ThemeValues): ThemeTokenGroup[] {
  let groups = new Map<string, ThemeToken[]>()

  for (let token of flattenThemeTokens(values)) {
    let tokens = groups.get(token.group) ?? []
    tokens.push(token)
    groups.set(token.group, tokens)
  }

  return Array.from(groups, ([id, tokens]) => ({
    id,
    label: formatGroupLabel(id),
    tokens,
  })).sort((a, b) => a.label.localeCompare(b.label))
}

function flattenThemeTokens(value: unknown, path: ThemeLeafPath = []): ThemeToken[] {
  if (isThemeLeaf(value)) {
    let label = path.join('.')
    return [
      {
        group: path[0] ?? 'theme',
        input: getTokenInput(value),
        label,
        path,
        range: getRangeInput(value, path),
      },
    ]
  }

  if (!isThemeObject(value)) {
    return []
  }

  let tokens: ThemeToken[] = []
  for (let [key, childValue] of Object.entries(value)) {
    tokens.push(...flattenThemeTokens(childValue, [...path, key]))
  }
  return tokens
}

function getTokenInput(value: ThemeLeafValue): ThemeLeafInput {
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return 'color'
  }

  if (getRangeInput(value)) {
    return 'range'
  }

  return 'text'
}

function getRangeInput(value: ThemeLeafValue, path: ThemeLeafPath = []) {
  if (typeof value === 'number') {
    return { min: 0, max: 100, step: 1, unit: '', value }
  }

  let match = /^(-?\d+(?:\.\d+)?)(px|em)?$/.exec(value)
  if (!match) return undefined

  let numericValue = Number(match[1])
  let unit = match[2] ?? ''
  let group = path[0]
  let tokenName = path.join('.')

  if (unit === 'px' && numericValue <= 96) {
    return {
      min: 0,
      max: group === 'fontSize' || group === 'control' ? 72 : 64,
      step: 1,
      unit,
      value: numericValue,
    }
  }

  if (unit === 'em') {
    return { min: -0.12, max: 0.2, step: 0.005, unit, value: numericValue }
  }

  if (tokenName.startsWith('lineHeight.')) {
    return { min: 0.8, max: 2.4, step: 0.05, unit, value: numericValue }
  }

  if (tokenName.startsWith('fontWeight.')) {
    return { min: 100, max: 900, step: 50, unit, value: numericValue }
  }

  return undefined
}

function cloneThemeValues(values: ThemeValues): ThemeValues {
  return JSON.parse(JSON.stringify(values)) as ThemeValues
}

function readThemeValue(values: ThemeValues, path: ThemeLeafPath): ThemeLeafValue {
  let current: unknown = values
  for (let key of path) {
    current = (current as Record<string, unknown>)[key]
  }

  if (!isThemeLeaf(current)) {
    throw new TypeError(`Expected theme leaf at "${path.join('.')}"`)
  }

  return current
}

function updateThemeValue(
  values: ThemeValues,
  path: ThemeLeafPath,
  value: ThemeLeafValue,
): ThemeValues {
  let nextValues = cloneThemeValues(values)
  let current: Record<string, unknown> = nextValues

  for (let key of path.slice(0, -1)) {
    current = current[key] as Record<string, unknown>
  }

  current[path[path.length - 1]!] = value
  return nextValues
}

function createThemeFile(values: ThemeValues) {
  return `import { createTheme } from '@remix-run/ui/theme'

export const AppTheme = createTheme(${formatThemeValues(values)})
`
}

function formatThemeValues(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (!isThemeObject(value)) {
    return 'undefined'
  }

  let entries = Object.entries(value)
  let nextIndent = '  '.repeat(depth + 1)
  let currentIndent = '  '.repeat(depth)
  let lines = entries.map(
    ([key, childValue]) => `${nextIndent}${key}: ${formatThemeValues(childValue, depth + 1)},`,
  )

  return `{\n${lines.join('\n')}\n${currentIndent}}`
}

function formatGroupLabel(group: string) {
  return group.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function isThemeLeaf(value: unknown): value is ThemeLeafValue {
  return typeof value === 'string' || typeof value === 'number'
}

function isThemeObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const pageCss = css({
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  minHeight: '100vh',
  color: theme.colors.text.primary,
  backgroundColor: theme.surface.lvl0,
  fontFamily: theme.fontFamily.sans,
  '@media (max-width: 1100px)': {
    gridTemplateColumns: '1fr',
  },
})

const editorPanelCss = css({
  position: 'sticky',
  top: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
  height: '100vh',
  minWidth: 0,
  padding: theme.space.lg,
  boxSizing: 'border-box',
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: theme.surface.lvl0,
  overflow: 'hidden visible',
  '@media (max-width: 1100px)': {
    position: 'static',
    height: 'auto',
    maxHeight: '32rem',
    borderRight: 'none',
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
})

const editorHeaderCss = css({
  position: 'sticky',
  top: `calc(${theme.space.lg} * -1)`,
  zIndex: 1,
  display: 'grid',
  gap: theme.space.sm,
  margin: `calc(${theme.space.lg} * -1) calc(${theme.space.lg} * -1) 0`,
  padding: theme.space.lg,
  backgroundColor: theme.surface.lvl0,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const editorActionsCss = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.space.sm,
})

const tokenGroupListCss = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})

const tokenGroupCss = css({
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  '&:first-child': {
    borderTop: 0,
  },
})

const tokenListCss = css({
  display: 'grid',
  gap: theme.space.sm,
})

const tokenControlCss = css({
  display: 'grid',
  gap: theme.space.xs,
  minWidth: 0,
})

const tokenLabelCss = css({
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xxs,
})

const tokenInputsCss = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: theme.space.xs,
  alignItems: 'center',
  minWidth: 0,
  '& input[type="range"]': {
    gridColumn: '1 / -1',
  },
})

const colorInputCss = css({
  width: theme.control.height.md,
  height: theme.control.height.md,
  padding: '2px',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl0,
  '&::-webkit-color-swatch-wrapper': {
    padding: 0,
  },
  '&::-webkit-color-swatch': {
    border: 0,
    borderRadius: `calc(${theme.radius.md} - 3px)`,
  },
})

const rangeInputCss = css({
  minWidth: 0,
  width: '100%',
  accentColor: theme.colors.action.primary.background,
})

const textInputCss = css({
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  minHeight: theme.control.height.md,
  paddingInline: theme.space.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: 0,
  },
})

const previewPanelCss = css({
  minWidth: 0,
  padding: theme.space.xxl,
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl1,
  color: theme.colors.text.primary,
  '@media (max-width: 760px)': {
    padding: theme.space.lg,
  },
})

const previewHeaderCss = css({
  display: 'grid',
  gap: theme.space.xs,
  marginBottom: theme.space.xl,
})

const previewPageTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: 'clamp(24px, 3vw, 36px)',
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.tight,
  lineHeight: theme.lineHeight.tight,
})

const previewPageDescriptionCss = css({
  margin: 0,
  maxWidth: '56ch',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

const previewStackCss = css({
  display: 'grid',
  gap: theme.space.xl,
})

const componentGridCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 28rem))',
  gap: theme.space.lg,
})

const previewCardCss = css({
  display: 'grid',
  alignContent: 'start',
  gap: theme.space.lg,
  minHeight: '15rem',
  padding: theme.space.lg,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
})

const previewCardHeaderCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

const previewCardBodyCss = css({
  minWidth: 0,
  padding: theme.space.xs,
  margin: `calc(${theme.space.xs} * -1)`,
})

const cardTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const cardDescriptionCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

const eyebrowCss = css({
  margin: 0,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  lineHeight: theme.lineHeight.normal,
  textTransform: 'uppercase',
})

const sectionTitleCss = css({
  margin: 0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: theme.lineHeight.tight,
})

const mutedTextCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
})

const buttonClusterCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})

const fieldCss = css({
  display: 'grid',
  gap: theme.space.xs,
})

const fieldLabelCss = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

const controlWidthCss = css({
  width: 'min(100%, 18rem)',
})

const stackCss = css({
  display: 'grid',
  gap: theme.space.sm,
})

const monoValueCss = css({
  margin: 0,
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
})

const listboxSurfaceCss = css({
  padding: theme.space.xs,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
})

const staticMenuPreviewCss = css({
  display: 'flex',
  alignItems: 'start',
  gap: theme.space.xs,
  minWidth: 0,
})

const staticMenuSurfaceCss = css({
  minWidth: '10rem',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: `${theme.shadow.xs}, ${theme.shadow.md}`,
})

const staticSubmenuSurfaceCss = css({
  marginTop: `calc(${theme.control.height.md} * 2)`,
})

const popoverPanelCss = css({
  display: 'grid',
  gap: theme.space.md,
  width: '18rem',
  padding: theme.space.lg,
})

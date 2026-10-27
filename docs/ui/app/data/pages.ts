import type { Handle, RemixNode } from 'remix/component'
import type { LoadedExample } from './examples.tsx'
import { categories } from './categories.ts'
import type { Category } from './categories.ts'
import AccordionPage, {
  meta as accordion,
  preview as accordionPreview,
} from '../pages/patterns/accordion.tsx'
import AnchorPage, { meta as anchor } from '../pages/patterns/anchor.tsx'
import EntranceExitPage, {
  meta as entranceExit,
  preview as entranceExitPreview,
} from '../pages/animation/entrance-exit.tsx'
import LayoutPage, { meta as layout } from '../pages/animation/layout.tsx'
import ReducedMotionPage, { meta as reducedMotion } from '../pages/animation/reduced-motion.tsx'
import SpringPage, { meta as spring } from '../pages/animation/spring.tsx'
import TweenPage, { meta as tween } from '../pages/animation/tween.tsx'
import ComboboxPage, { meta as combobox } from '../pages/patterns/combobox.tsx'
import ListboxPage, { meta as listbox } from '../pages/patterns/listbox.tsx'
import MenuPage, { meta as menu } from '../pages/patterns/menu.tsx'
import PopoverPage, { meta as popover } from '../pages/patterns/popover.tsx'
import SelectPage, { meta as select } from '../pages/patterns/select.tsx'
import TabsPage, { meta as tabs } from '../pages/patterns/tabs.tsx'
import TogglePage, { meta as toggle } from '../pages/patterns/toggle.tsx'

export interface PageMeta {
  title: string
  slug: string
  category: Category
  description: string
  importPath: string
}

export interface PageProps {
  pages: UiPage[]
}

export interface UiPage extends PageMeta {
  Component: (handle: Handle<PageProps>) => () => RemixNode
  preview?: LoadedExample
}

export const pages: UiPage[] = [
  { ...accordion, Component: AccordionPage, preview: accordionPreview },
  { ...anchor, Component: AnchorPage },
  { ...entranceExit, Component: EntranceExitPage, preview: entranceExitPreview },
  { ...layout, Component: LayoutPage },
  { ...reducedMotion, Component: ReducedMotionPage },
  { ...spring, Component: SpringPage },
  { ...tween, Component: TweenPage },
  { ...combobox, Component: ComboboxPage },
  { ...listbox, Component: ListboxPage },
  { ...menu, Component: MenuPage },
  { ...popover, Component: PopoverPage },
  { ...select, Component: SelectPage },
  { ...tabs, Component: TabsPage },
  { ...toggle, Component: TogglePage },
].sort(
  (a, b) =>
    categories.findIndex((category) => category.id === a.category) -
      categories.findIndex((category) => category.id === b.category) ||
    a.title.localeCompare(b.title),
)

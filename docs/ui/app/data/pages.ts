import type { Handle, RemixNode } from 'remix/component'
import type { LoadedExample } from './examples.tsx'
import AccordionPage, {
  meta as accordion,
  preview as accordionPreview,
} from '../pages/behaviors/accordion.tsx'
import AnchorPage, { meta as anchor } from '../pages/behaviors/anchor.tsx'
import EntranceExitPage, { meta as entranceExit } from '../pages/animation/entrance-exit.tsx'
import LayoutPage, { meta as layout } from '../pages/animation/layout.tsx'
import SpringPage, { meta as spring, preview as springPreview } from '../pages/animation/spring.tsx'
import TweenPage, { meta as tween } from '../pages/animation/tween.tsx'
import ComboboxPage, { meta as combobox } from '../pages/behaviors/combobox.tsx'
import ListboxPage, { meta as listbox } from '../pages/behaviors/listbox.tsx'
import MenuPage, { meta as menu } from '../pages/behaviors/menu.tsx'
import PopoverPage, { meta as popover } from '../pages/behaviors/popover.tsx'
import SelectPage, { meta as select } from '../pages/behaviors/select.tsx'
import TabsPage, { meta as tabs } from '../pages/behaviors/tabs.tsx'
import TogglePage, { meta as toggle } from '../pages/behaviors/toggle.tsx'

export interface PageMeta {
  title: string
  slug: string
  category: 'behaviors' | 'animation'
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
  { ...entranceExit, Component: EntranceExitPage },
  { ...layout, Component: LayoutPage },
  { ...spring, Component: SpringPage, preview: springPreview },
  { ...tween, Component: TweenPage },
  { ...combobox, Component: ComboboxPage },
  { ...listbox, Component: ListboxPage },
  { ...menu, Component: MenuPage },
  { ...popover, Component: PopoverPage },
  { ...select, Component: SelectPage },
  { ...tabs, Component: TabsPage },
  { ...toggle, Component: TogglePage },
].sort((a, b) => a.title.localeCompare(b.title))

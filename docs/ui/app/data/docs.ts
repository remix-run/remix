import type { UiPage } from './page.ts'
import AccordionPage, {
  meta as accordion,
  preview as accordionPreview,
} from '../pages/primitives/accordion.tsx'
import AnchorPage, { meta as anchor } from '../pages/primitives/anchor.tsx'
import EntranceExitPage, { meta as entranceExit } from '../pages/animation/entrance-exit.tsx'
import LayoutPage, { meta as layout } from '../pages/animation/layout.tsx'
import SpringPage, { meta as spring, preview as springPreview } from '../pages/animation/spring.tsx'
import TweenPage, { meta as tween } from '../pages/animation/tween.tsx'
import ComboboxPage, { meta as combobox } from '../pages/primitives/combobox.tsx'
import ListboxPage, { meta as listbox } from '../pages/primitives/listbox.tsx'
import MenuPage, { meta as menu } from '../pages/primitives/menu.tsx'
import PopoverPage, { meta as popover } from '../pages/primitives/popover.tsx'
import SelectPage, { meta as select } from '../pages/primitives/select.tsx'
import TabsPage, { meta as tabs } from '../pages/primitives/tabs.tsx'
import TogglePage, { meta as toggle } from '../pages/primitives/toggle.tsx'

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

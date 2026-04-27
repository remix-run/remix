import { ExplorerExampleCard } from '../example-card.tsx'
import {
  exampleGridCss,
  eyebrowTextCss,
  featureGridCss,
  noteCardCss,
  noteListCss,
  PageSection,
  panelCss,
  panelHeaderCss,
  panelTitleTextCss,
  pageStackCss,
  tokenGroupGridCss,
} from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderStartHerePage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Start with two ideas"
        description="Remix UI is easiest to learn when you separate theme decisions from component decisions."
      >
        <div mix={featureGridCss}>
          <ExplorerExampleCard
            example={EXAMPLES.startHereTheme}
            title="Theme"
            description="Theme gives you the shared values for spacing, color, typography, surfaces, and control sizing."
          />
          <ExplorerExampleCard
            example={EXAMPLES.startHereUi}
            title="Components"
            description="Component modules give you behavior first, plus the building blocks to either use a wrapper or compose your own markup."
          />
        </div>
      </PageSection>

      <PageSection
        title="What a component module gives you"
        description="Most component modules follow the same shape, so once you learn one, the others should feel familiar."
      >
        <div mix={tokenGroupGridCss}>
          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Context</p>
              <h3 mix={panelTitleTextCss}>One scoped component instance</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                `Context` scopes shared state for one instance of a component, like the open
                popover, the active listbox option, or the selected tab.
              </li>
              <li>
                You will usually reach for it when composing the component yourself, not when using
                a ready-made wrapper.
              </li>
            </ul>
          </article>

          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Mixins</p>
              <h3 mix={panelTitleTextCss}>Behavior for normal elements</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                Mixins turn ordinary elements into component roles like `select.trigger()`,
                `listbox.option()`, or `popover.surface()`.
              </li>
              <li>
                They carry behavior, semantics, refs, keyboard handling, and ARIA without taking
                away control of your markup.
              </li>
            </ul>
          </article>

          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Styles</p>
              <h3 mix={panelTitleTextCss}>Visual building blocks</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                Flat `*Style` exports give you slot-level visuals like `button.baseStyle`,
                `popover.surfaceStyle`, and `listbox.optionStyle`.
              </li>
              <li>
                Use them when you want the library look and feel but still need to own the structure
                around it.
              </li>
            </ul>
          </article>

          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Convenience Wrappers</p>
              <h3 mix={panelTitleTextCss}>The fast path for common UI</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                Wrappers like `Button`, `Select`, `Menu`, and `Combobox` package the common markup
                and behavior for the usual case.
              </li>
              <li>
                Start here when the default shape fits, then drop down to `Context`, mixins, and
                styles only when you need more control.
              </li>
            </ul>
          </article>
        </div>
      </PageSection>

      <PageSection
        title="How to use the layers"
        description="Start with the highest-level thing that fits your UI, then move lower only when you need more control."
      >
        <div mix={tokenGroupGridCss}>
          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Use `theme.*` directly</p>
              <h3 mix={panelTitleTextCss}>For app-specific styling</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                Reach for theme tokens when you just need values like spacing, surfaces, borders, or
                typography in your own app code.
              </li>
              <li>
                Theme is the shared value contract, not a grab bag of component-specific helpers.
              </li>
            </ul>
          </article>

          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Use wrappers first</p>
              <h3 mix={panelTitleTextCss}>For common, ready-to-ship patterns</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                If the built-in structure already matches what you want, wrappers are the fastest
                way to ship accessible, on-system UI.
              </li>
              <li>
                That is the default path for things like ordinary buttons, selects, menus, and
                comboboxes.
              </li>
            </ul>
          </article>

          <article mix={[panelCss, noteCardCss]}>
            <div mix={panelHeaderCss}>
              <p mix={eyebrowTextCss}>Compose the pieces</p>
              <h3 mix={panelTitleTextCss}>When markup and behavior need to separate</h3>
            </div>
            <ul mix={noteListCss}>
              <li>
                If you need custom structure, keep the library behavior by composing `Context`,
                mixins, and `*Style` exports yourself.
              </li>
              <li>
                That is the main reason these lower-level APIs exist: customization without
                rebuilding the behavior from scratch.
              </li>
            </ul>
          </article>
        </div>
      </PageSection>

      <PageSection
        title="Two common paths"
        description="These examples show the two most common ways consumers will use Remix UI."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard
            example={EXAMPLES.buttonAliases}
            title="Fast path: use a wrapper"
            description="Use a convenience component like `Button` when the default structure already fits."
          />
          <ExplorerExampleCard
            example={EXAMPLES.selectDeconstructed}
            title="Custom path: compose the pieces"
            description="When you need custom markup, combine `Context`, mixins, and `*Style` exports instead of fighting a wrapper."
          />
        </div>
      </PageSection>
    </div>
  )
}

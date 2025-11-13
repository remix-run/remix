import type { RemixNode } from './remix-types.d.ts'

declare global {
  namespace JSX {
    interface IntrinsicElements extends HTMLElements {
      // TODO: support web x-comp style components
    }
  }
}

/**
 * HTML Props for JSX Elements
 *
 * Based on standard HTML props but excludes event handlers since
 * we use the `on` prop with the @/events package for event handling.
 */

export type Booleanish = boolean | 'true' | 'false'

// WAI-ARIA 1.1 props
export interface AriaProps {
  /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
  'aria-activedescendant'?: string | undefined
  /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
  'aria-atomic'?: Booleanish | undefined
  /**
   * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
   * presented if they are made.
   */
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | undefined
  /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
  'aria-busy'?: Booleanish | undefined
  /**
   * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
   * @see aria-pressed
   * @see aria-selected
   */
  'aria-checked'?: Booleanish | 'mixed' | undefined
  /**
   * Defines the total number of columns in a table, grid, or treegrid.
   * @see aria-colindex
   */
  'aria-colcount'?: number | undefined
  /**
   * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
   * @see aria-colcount
   * @see aria-colspan
   */
  'aria-colindex'?: number | undefined
  /**
   * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-colindex
   * @see aria-rowspan
   */
  'aria-colspan'?: number | undefined
  /**
   * Identifies the element (or elements) whose contents or presence are controlled by the current element.
   * @see aria-owns
   */
  'aria-controls'?: string | undefined
  /** Indicates the element that represents the current item within a container or set of related elements. */
  'aria-current'?: Booleanish | 'page' | 'step' | 'location' | 'date' | 'time' | undefined
  /**
   * Identifies the element (or elements) that describes the object.
   * @see aria-labelledby
   */
  'aria-describedby'?: string | undefined
  /**
   * Identifies the element that provides a detailed, extended description for the object.
   * @see aria-describedby
   */
  'aria-details'?: string | undefined
  /**
   * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
   * @see aria-hidden
   * @see aria-readonly
   */
  'aria-disabled'?: Booleanish | undefined
  /**
   * Identifies the element that provides an error message for the object.
   * @see aria-invalid
   * @see aria-describedby
   */
  'aria-errormessage'?: string | undefined
  /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
  'aria-expanded'?: Booleanish | undefined
  /**
   * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
   * allows assistive technology to override the general default of reading in document source order.
   */
  'aria-flowto'?: string | undefined
  /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
  'aria-haspopup'?: Booleanish | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined
  /**
   * Indicates whether the element is exposed to an accessibility API.
   * @see aria-disabled
   */
  'aria-hidden'?: Booleanish | undefined
  /**
   * Indicates the entered value does not conform to the format expected by the application.
   * @see aria-errormessage
   */
  'aria-invalid'?: Booleanish | 'grammar' | 'spelling' | undefined
  /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
  'aria-keyshortcuts'?: string | undefined
  /**
   * Defines a string value that labels the current element.
   * @see aria-labelledby
   */
  'aria-label'?: string | undefined
  /**
   * Identifies the element (or elements) that labels the current element.
   * @see aria-describedby
   */
  'aria-labelledby'?: string | undefined
  /** Defines the hierarchical level of an element within a structure. */
  'aria-level'?: number | undefined
  /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
  'aria-live'?: 'off' | 'assertive' | 'polite' | undefined
  /** Indicates whether an element is modal when displayed. */
  'aria-modal'?: Booleanish | undefined
  /** Indicates whether a text box accepts multiple lines of input or only a single line. */
  'aria-multiline'?: Booleanish | undefined
  /** Indicates that the user may select more than one item from the current selectable descendants. */
  'aria-multiselectable'?: Booleanish | undefined
  /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
  'aria-orientation'?: 'horizontal' | 'vertical' | undefined
  /**
   * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
   * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
   * @see aria-controls
   */
  'aria-owns'?: string | undefined
  /**
   * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
   * A hint could be a sample value or a brief description of the expected format.
   */
  'aria-placeholder'?: string | undefined
  /**
   * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-setsize
   */
  'aria-posinset'?: number | undefined
  /**
   * Indicates the current "pressed" state of toggle buttons.
   * @see aria-checked
   * @see aria-selected
   */
  'aria-pressed'?: Booleanish | 'mixed' | undefined
  /**
   * Indicates that the element is not editable, but is otherwise operable.
   * @see aria-disabled
   */
  'aria-readonly'?: Booleanish | undefined
  /**
   * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
   * @see aria-atomic
   */
  'aria-relevant'?:
    | 'additions'
    | 'additions removals'
    | 'additions text'
    | 'all'
    | 'removals'
    | 'removals additions'
    | 'removals text'
    | 'text'
    | 'text additions'
    | 'text removals'
    | undefined
  /** Indicates that user input is required on the element before a form may be submitted. */
  'aria-required'?: Booleanish | undefined
  /** Defines a human-readable, author-localized description for the role of an element. */
  'aria-roledescription'?: string | undefined
  /**
   * Defines the total number of rows in a table, grid, or treegrid.
   * @see aria-rowindex
   */
  'aria-rowcount'?: number | undefined
  /**
   * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
   * @see aria-rowcount
   * @see aria-rowspan
   */
  'aria-rowindex'?: number | undefined
  /**
   * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-rowindex
   * @see aria-colspan
   */
  'aria-rowspan'?: number | undefined
  /**
   * Indicates the current "selected" state of various widgets.
   * @see aria-checked
   * @see aria-pressed
   */
  'aria-selected'?: Booleanish | undefined
  /**
   * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-posinset
   */
  'aria-setsize'?: number | undefined
  /** Indicates if items in a table or grid are sorted in ascending or descending order. */
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | undefined
  /** Defines the maximum allowed value for a range widget. */
  'aria-valuemax'?: number | undefined
  /** Defines the minimum allowed value for a range widget. */
  'aria-valuemin'?: number | undefined
  /**
   * Defines the current value for a range widget.
   * @see aria-valuetext
   */
  'aria-valuenow'?: number | undefined
  /** Defines the human readable text alternative of aria-valuenow for a range widget. */
  'aria-valuetext'?: string | undefined
}

// WAI-ARIA 1.2 role prop values
export type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'blockquote'
  | 'button'
  | 'caption'
  | 'cell'
  | 'checkbox'
  | 'code'
  | 'columnheader'
  | 'combobox'
  | 'command'
  | 'complementary'
  | 'composite'
  | 'contentinfo'
  | 'definition'
  | 'deletion'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'emphasis'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'input'
  | 'insertion'
  | 'landmark'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'meter'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'paragraph'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'range'
  | 'region'
  | 'roletype'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'section'
  | 'sectionhead'
  | 'select'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'strong'
  | 'structure'
  | 'subscript'
  | 'superscript'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'time'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem'
  | 'widget'
  | 'window'
  | 'none presentation'

/**
 * Base props that all HTML elements have
 */
export interface HTMLProps<eventTarget extends EventTarget = EventTarget> extends AriaProps {
  key?: string | undefined
  accessKey?: string | undefined
  children?: RemixNode | RemixNode[] | undefined
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  class?: string | undefined
  autoCorrect?: string | undefined
  for?: string | undefined
  autoFocus?: boolean | undefined
  className?: string | undefined
  contentEditable?: Booleanish | '' | 'plaintext-only' | 'inherit' | undefined
  dir?: 'auto' | 'rtl' | 'ltr' | undefined
  draggable?: boolean | undefined
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  hidden?: boolean | 'hidden' | 'until-found' | 'true' | 'false' | string | undefined
  id?: string | undefined
  inert?: boolean | undefined
  innerHTML?: string | undefined
  inputMode?: string | undefined
  lang?: string | undefined
  nonce?: string | undefined
  role?: AriaRole | undefined
  spellCheck?: boolean | undefined
  tabIndex?: number | string | undefined
  title?: string | undefined
  translate?: boolean | undefined

  popover?: 'auto' | 'manual' | boolean | undefined
  popovertarget?: string | undefined

  // Data attributes
  [key: `data-${string}`]: string | number | boolean | undefined
}

/**
 * Props for <a> elements
 */
export interface HTMLAnchorProps<eventTarget extends EventTarget = HTMLAnchorElement>
  extends HTMLProps<eventTarget> {
  download?: any
  href?: string | undefined
  hrefLang?: string | undefined
  media?: string | undefined
  ping?: string | undefined
  rel?: string | undefined
  target?: '_self' | '_blank' | '_parent' | '_top' | (string & {}) | undefined
  type?: string | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
}

/**
 * Props for <area> elements
 */
export interface HTMLAreaProps<eventTarget extends EventTarget = HTMLAreaElement>
  extends HTMLProps<eventTarget> {
  alt?: string | undefined
  coords?: string | undefined
  download?: any
  href?: string | undefined
  hrefLang?: string | undefined
  media?: string | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  rel?: string | undefined
  shape?: string | undefined
  target?: '_self' | '_blank' | '_parent' | '_top' | (string & {}) | undefined
}

/**
 * Props for <audio> elements
 */
export interface HTMLAudioProps<eventTarget extends EventTarget = HTMLAudioElement>
  extends HTMLProps<eventTarget> {
  autoPlay?: boolean | undefined
  controls?: boolean | undefined
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined
  loop?: boolean | undefined
  muted?: boolean | undefined
  preload?: 'auto' | 'metadata' | 'none' | undefined
  src?: string | undefined
}

/**
 * Props for <base> elements
 */
export interface HTMLBaseProps<eventTarget extends EventTarget = HTMLBaseElement>
  extends HTMLProps<eventTarget> {
  href?: string | undefined
  target?: '_self' | '_blank' | '_parent' | '_top' | (string & {}) | undefined
}

/**
 * Props for <blockquote> elements
 */
export interface HTMLBlockquoteProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  cite?: string | undefined
}

/**
 * Props for <button> elements
 */
export interface HTMLButtonProps<eventTarget extends EventTarget = HTMLButtonElement>
  extends HTMLProps<eventTarget> {
  disabled?: boolean | undefined
  form?: string | undefined
  formAction?: string | undefined
  formEncType?: string | undefined
  formMethod?: string | undefined
  formNoValidate?: boolean | undefined
  formTarget?: string | undefined
  name?: string | undefined
  type?: 'submit' | 'reset' | 'button' | undefined
  value?: string | number | undefined
}

/**
 * Props for <canvas> elements
 */
export interface HTMLCanvasProps<eventTarget extends EventTarget = HTMLCanvasElement>
  extends HTMLProps<eventTarget> {
  height?: number | string | undefined
  width?: number | string | undefined
}

/**
 * Props for <col> elements
 */
export interface HTMLColProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  span?: number | undefined
  width?: number | string | undefined
}

/**
 * Props for <colgroup> elements
 */
export interface HTMLColgroupProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  span?: number | undefined
}

/**
 * Props for <data> elements
 */
export interface HTMLDataProps<eventTarget extends EventTarget = HTMLDataElement>
  extends HTMLProps<eventTarget> {
  value?: string | number | undefined
}

/**
 * Props for <del> elements
 */
export interface HTMLDelProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  cite?: string | undefined
  dateTime?: string | undefined
}

/**
 * Props for <details> elements
 */
export interface HTMLDetailsProps<eventTarget extends EventTarget = HTMLDetailsElement>
  extends HTMLProps<eventTarget> {
  open?: boolean | undefined
}

/**
 * Props for <dialog> elements
 */
export interface HTMLDialogProps<eventTarget extends EventTarget = HTMLDialogElement>
  extends HTMLProps<eventTarget> {
  open?: boolean | undefined
}

/**
 * Props for <embed> elements
 */
export interface HTMLEmbedProps<eventTarget extends EventTarget = HTMLEmbedElement>
  extends HTMLProps<eventTarget> {
  height?: number | string | undefined
  src?: string | undefined
  type?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <fieldset> elements
 */
export interface HTMLFieldsetProps<eventTarget extends EventTarget = HTMLFieldSetElement>
  extends HTMLProps<eventTarget> {
  disabled?: boolean | undefined
  form?: string | undefined
  name?: string | undefined
}

/**
 * Props for <form> elements
 */
export interface HTMLFormProps<eventTarget extends EventTarget = HTMLFormElement>
  extends HTMLProps<eventTarget> {
  acceptCharset?: string | undefined
  action?: string | undefined
  autoComplete?: string | undefined
  encType?: string | undefined
  method?: string | undefined
  name?: string | undefined
  noValidate?: boolean | undefined
  target?: string | undefined
}

/**
 * Props for <iframe> elements
 */
export interface HTMLIframeProps<eventTarget extends EventTarget = HTMLIFrameElement>
  extends HTMLProps<eventTarget> {
  allow?: string | undefined
  allowFullScreen?: boolean | undefined
  height?: number | string | undefined
  loading?: 'eager' | 'lazy' | undefined
  name?: string | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  sandbox?: string | undefined
  src?: string | undefined
  srcDoc?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <img> elements
 */
export interface HTMLImgProps<eventTarget extends EventTarget = HTMLImageElement>
  extends HTMLProps<eventTarget> {
  alt?: string | undefined
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined
  decoding?: 'async' | 'auto' | 'sync' | undefined
  height?: number | string | undefined
  loading?: 'eager' | 'lazy' | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  sizes?: string | undefined
  src?: string | undefined
  srcSet?: string | undefined
  useMap?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <input> elements
 */
export interface HTMLInputProps<eventTarget extends EventTarget = HTMLInputElement>
  extends HTMLProps<eventTarget> {
  accept?: string | undefined
  alt?: string | undefined
  autoComplete?: string | undefined
  capture?: 'user' | 'environment' | undefined
  checked?: boolean | 'checked' | 'true' | 'false' | string | undefined
  defaultChecked?: boolean | undefined
  defaultValue?: string | number | undefined
  disabled?: boolean | 'disabled' | 'true' | 'false' | string | undefined
  form?: string | undefined
  formAction?: string | undefined
  formEncType?: string | undefined
  formMethod?: string | undefined
  formNoValidate?: boolean | undefined
  formTarget?: string | undefined
  height?: number | string | undefined
  list?: string | undefined
  max?: number | string | undefined
  maxLength?: number | undefined
  min?: number | string | undefined
  minLength?: number | undefined
  multiple?: boolean | undefined
  name?: string | undefined
  pattern?: string | undefined
  placeholder?: string | undefined
  readOnly?: boolean | undefined
  required?: boolean | undefined
  size?: number | undefined
  src?: string | undefined
  step?: number | string | undefined
  type?:
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'submit'
    | 'tel'
    | 'text'
    | 'time'
    | 'url'
    | 'week'
    | undefined
  value?: string | number | undefined
  width?: number | string | undefined
}

/**
 * Props for <ins> elements
 */
export interface HTMLInsProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  cite?: string | undefined
  dateTime?: string | undefined
}

/**
 * Props for <label> elements
 */
export interface HTMLLabelProps<eventTarget extends EventTarget = HTMLLabelElement>
  extends HTMLProps<eventTarget> {
  form?: string | undefined
  htmlFor?: string | undefined
}

/**
 * Props for <li> elements
 */
export interface HTMLLiProps<eventTarget extends EventTarget = HTMLLIElement>
  extends HTMLProps<eventTarget> {
  value?: string | number | undefined
}

/**
 * Props for <link> elements
 */
export interface HTMLLinkProps<eventTarget extends EventTarget = HTMLLinkElement>
  extends HTMLProps<eventTarget> {
  as?: string | undefined
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined
  href?: string | undefined
  hrefLang?: string | undefined
  integrity?: string | undefined
  media?: string | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  rel?: string | undefined
  sizes?: string | undefined
  type?: string | undefined
}

/**
 * Props for <map> elements
 */
export interface HTMLMapProps<eventTarget extends EventTarget = HTMLMapElement>
  extends HTMLProps<eventTarget> {
  name?: string | undefined
}

/**
 * Props for <menu> elements
 */
export interface HTMLMenuProps<eventTarget extends EventTarget = HTMLMenuElement>
  extends HTMLProps<eventTarget> {
  type?: string | undefined
}

/**
 * Props for <meta> elements
 */
export interface HTMLMetaProps<eventTarget extends EventTarget = HTMLMetaElement>
  extends HTMLProps<eventTarget> {
  charSet?: string | undefined
  content?: string | undefined
  httpEquiv?: string | undefined
  name?: string | undefined
  media?: string | undefined
}

/**
 * Props for <meter> elements
 */
export interface HTMLMeterProps<eventTarget extends EventTarget = HTMLMeterElement>
  extends HTMLProps<eventTarget> {
  form?: string | undefined
  high?: number | undefined
  low?: number | undefined
  max?: number | string | undefined
  min?: number | string | undefined
  optimum?: number | undefined
  value?: string | number | undefined
}

/**
 * Props for <object> elements
 */
export interface HTMLObjectProps<eventTarget extends EventTarget = HTMLObjectElement>
  extends HTMLProps<eventTarget> {
  data?: string | undefined
  form?: string | undefined
  height?: number | string | undefined
  name?: string | undefined
  type?: string | undefined
  useMap?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <ol> elements
 */
export interface HTMLOlProps<eventTarget extends EventTarget = HTMLOListElement>
  extends HTMLProps<eventTarget> {
  reversed?: boolean | undefined
  start?: number | undefined
  type?: '1' | 'a' | 'A' | 'i' | 'I' | undefined
}

/**
 * Props for <optgroup> elements
 */
export interface HTMLOptgroupProps<eventTarget extends EventTarget = HTMLOptGroupElement>
  extends HTMLProps<eventTarget> {
  disabled?: boolean | undefined
  label?: string | undefined
}

/**
 * Props for <option> elements
 */
export interface HTMLOptionProps<eventTarget extends EventTarget = HTMLOptionElement>
  extends HTMLProps<eventTarget> {
  disabled?: boolean | undefined
  label?: string | undefined
  selected?: boolean | undefined
  value?: string | number | undefined
}

/**
 * Props for <output> elements
 */
export interface HTMLOutputProps<eventTarget extends EventTarget = HTMLOutputElement>
  extends HTMLProps<eventTarget> {
  form?: string | undefined
  htmlFor?: string | undefined
  name?: string | undefined
}

/**
 * Props for <param> elements
 */
export interface HTMLParamProps<eventTarget extends EventTarget = HTMLParamElement>
  extends HTMLProps<eventTarget> {
  name?: string | undefined
  value?: string | number | undefined
}

/**
 * Props for <progress> elements
 */
export interface HTMLProgressProps<eventTarget extends EventTarget = HTMLProgressElement>
  extends HTMLProps<eventTarget> {
  max?: number | string | undefined
  value?: string | number | undefined
}

/**
 * Props for <q> elements
 */
export interface HTMLQuoteProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  cite?: string | undefined
}

/**
 * Props for <script> elements
 */
export interface HTMLScriptProps<eventTarget extends EventTarget = HTMLScriptElement>
  extends HTMLProps<eventTarget> {
  async?: boolean | undefined
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined
  defer?: boolean | undefined
  integrity?: string | undefined
  noModule?: boolean | undefined
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  src?: string | undefined
  type?: string | undefined
}

/**
 * Props for <select> elements
 */
export interface HTMLSelectProps<eventTarget extends EventTarget = HTMLSelectElement>
  extends HTMLProps<eventTarget> {
  autoComplete?: string | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  multiple?: boolean | undefined
  name?: string | undefined
  required?: boolean | undefined
  selectedIndex?: number | undefined
  size?: number | undefined
  value?: string | number | undefined
}

/**
 * Props for <slot> elements
 */
export interface HTMLSlotProps<eventTarget extends EventTarget = HTMLSlotElement>
  extends HTMLProps<eventTarget> {
  name?: string | undefined
}

/**
 * Props for <source> elements
 */
export interface HTMLSourceProps<eventTarget extends EventTarget = HTMLSourceElement>
  extends HTMLProps<eventTarget> {
  height?: number | string | undefined
  media?: string | undefined
  sizes?: string | undefined
  src?: string | undefined
  srcSet?: string | undefined
  type?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <style> elements
 */
export interface HTMLStyleProps<eventTarget extends EventTarget = HTMLStyleElement>
  extends HTMLProps<eventTarget> {
  media?: string | undefined
  scoped?: boolean | undefined
  type?: string | undefined
}

/**
 * Props for <table> elements
 */
export interface HTMLTableProps<eventTarget extends EventTarget = HTMLTableElement>
  extends HTMLProps<eventTarget> {
  cellPadding?: string | undefined
  cellSpacing?: string | undefined
  summary?: string | undefined
  width?: number | string | undefined
}

/**
 * Props for <td> elements
 */
export interface HTMLTdProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined
  colSpan?: number | undefined
  headers?: string | undefined
  rowSpan?: number | undefined
  scope?: string | undefined
  abbr?: string | undefined
  height?: number | string | undefined
  width?: number | string | undefined
  valign?: 'top' | 'middle' | 'bottom' | 'baseline' | undefined
}

/**
 * Props for <textarea> elements
 */
export interface HTMLTextareaProps<eventTarget extends EventTarget = HTMLTextAreaElement>
  extends HTMLProps<eventTarget> {
  autoComplete?: string | undefined
  cols?: number | undefined
  disabled?: boolean | undefined
  form?: string | undefined
  maxLength?: number | undefined
  minLength?: number | undefined
  name?: string | undefined
  placeholder?: string | undefined
  readOnly?: boolean | undefined
  required?: boolean | undefined
  rows?: number | undefined
  value?: string | number | undefined
  wrap?: string | undefined
}

/**
 * Props for <th> elements
 */
export interface HTMLThProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char' | undefined
  colSpan?: number | undefined
  headers?: string | undefined
  rowSpan?: number | undefined
  scope?: string | undefined
  abbr?: string | undefined
}

/**
 * Props for <time> elements
 */
export interface HTMLTimeProps<eventTarget extends EventTarget = HTMLTimeElement>
  extends HTMLProps<eventTarget> {
  dateTime?: string | undefined
}

/**
 * Props for <track> elements
 */
export interface HTMLTrackProps<eventTarget extends EventTarget = HTMLTrackElement>
  extends HTMLProps<eventTarget> {
  default?: boolean | undefined
  kind?: string | undefined
  label?: string | undefined
  src?: string | undefined
  srcLang?: string | undefined
}

/**
 * Props for <video> elements
 */
export interface HTMLVideoProps<eventTarget extends EventTarget = HTMLVideoElement>
  extends HTMLProps<eventTarget> {
  autoPlay?: boolean | undefined
  controls?: boolean | undefined
  crossOrigin?: 'anonymous' | 'use-credentials' | undefined
  height?: number | string | undefined
  loop?: boolean | undefined
  muted?: boolean | undefined
  playsInline?: boolean | undefined
  poster?: string | undefined
  preload?: 'auto' | 'metadata' | 'none' | undefined
  src?: string | undefined
  width?: number | string | undefined
}

/**
 * Maps HTML element tag names to their corresponding props types
 */
export interface HTMLElements {
  a: HTMLAnchorProps<HTMLAnchorElement>
  abbr: HTMLProps<HTMLElement>
  address: HTMLProps<HTMLElement>
  area: HTMLAreaProps<HTMLAreaElement>
  article: HTMLProps<HTMLElement>
  aside: HTMLProps<HTMLElement>
  audio: HTMLAudioProps<HTMLAudioElement>
  b: HTMLProps<HTMLElement>
  base: HTMLBaseProps<HTMLBaseElement>
  bdi: HTMLProps<HTMLElement>
  bdo: HTMLProps<HTMLElement>
  big: HTMLProps<HTMLElement>
  blockquote: HTMLBlockquoteProps<HTMLQuoteElement>
  body: HTMLProps<HTMLBodyElement>
  br: HTMLProps<HTMLBRElement>
  button: HTMLButtonProps<HTMLButtonElement>
  canvas: HTMLCanvasProps<HTMLCanvasElement>
  caption: HTMLProps<HTMLTableCaptionElement>
  cite: HTMLProps<HTMLElement>
  code: HTMLProps<HTMLElement>
  col: HTMLColProps<HTMLTableColElement>
  colgroup: HTMLColgroupProps<HTMLTableColElement>
  data: HTMLDataProps<HTMLDataElement>
  datalist: HTMLProps<HTMLDataListElement>
  dd: HTMLProps<HTMLElement>
  del: HTMLDelProps<HTMLModElement>
  details: HTMLDetailsProps<HTMLDetailsElement>
  dfn: HTMLProps<HTMLElement>
  dialog: HTMLDialogProps<HTMLDialogElement>
  div: HTMLProps<HTMLDivElement>
  dl: HTMLProps<HTMLDListElement>
  dt: HTMLProps<HTMLElement>
  em: HTMLProps<HTMLElement>
  embed: HTMLEmbedProps<HTMLEmbedElement>
  fieldset: HTMLFieldsetProps<HTMLFieldSetElement>
  figcaption: HTMLProps<HTMLElement>
  figure: HTMLProps<HTMLElement>
  footer: HTMLProps<HTMLElement>
  form: HTMLFormProps<HTMLFormElement>
  h1: HTMLProps<HTMLHeadingElement>
  h2: HTMLProps<HTMLHeadingElement>
  h3: HTMLProps<HTMLHeadingElement>
  h4: HTMLProps<HTMLHeadingElement>
  h5: HTMLProps<HTMLHeadingElement>
  h6: HTMLProps<HTMLHeadingElement>
  head: HTMLProps<HTMLHeadElement>
  header: HTMLProps<HTMLElement>
  hgroup: HTMLProps<HTMLElement>
  hr: HTMLProps<HTMLHRElement>
  html: HTMLProps<HTMLHtmlElement>
  i: HTMLProps<HTMLElement>
  iframe: HTMLIframeProps<HTMLIFrameElement>
  img: HTMLImgProps<HTMLImageElement>
  input: HTMLInputProps<HTMLInputElement>
  ins: HTMLInsProps<HTMLModElement>
  kbd: HTMLProps<HTMLElement>
  label: HTMLLabelProps<HTMLLabelElement>
  legend: HTMLProps<HTMLLegendElement>
  li: HTMLLiProps<HTMLLIElement>
  link: HTMLLinkProps<HTMLLinkElement>
  main: HTMLProps<HTMLElement>
  map: HTMLMapProps<HTMLMapElement>
  mark: HTMLProps<HTMLElement>
  menu: HTMLMenuProps<HTMLMenuElement>
  meta: HTMLMetaProps<HTMLMetaElement>
  meter: HTMLMeterProps<HTMLMeterElement>
  nav: HTMLProps<HTMLElement>
  noscript: HTMLProps<HTMLElement>
  object: HTMLObjectProps<HTMLObjectElement>
  ol: HTMLOlProps<HTMLOListElement>
  optgroup: HTMLOptgroupProps<HTMLOptGroupElement>
  option: HTMLOptionProps<HTMLOptionElement>
  output: HTMLOutputProps<HTMLOutputElement>
  p: HTMLProps<HTMLParagraphElement>
  param: HTMLParamProps<HTMLParamElement>
  picture: HTMLProps<HTMLPictureElement>
  pre: HTMLProps<HTMLPreElement>
  progress: HTMLProgressProps<HTMLProgressElement>
  q: HTMLQuoteProps<HTMLQuoteElement>
  rp: HTMLProps<HTMLElement>
  rt: HTMLProps<HTMLElement>
  ruby: HTMLProps<HTMLElement>
  s: HTMLProps<HTMLElement>
  samp: HTMLProps<HTMLElement>
  script: HTMLScriptProps<HTMLScriptElement>
  section: HTMLProps<HTMLElement>
  select: HTMLSelectProps<HTMLSelectElement>
  slot: HTMLSlotProps<HTMLSlotElement>
  small: HTMLProps<HTMLElement>
  source: HTMLSourceProps<HTMLSourceElement>
  span: HTMLProps<HTMLSpanElement>
  strong: HTMLProps<HTMLElement>
  style: HTMLStyleProps<HTMLStyleElement>
  sub: HTMLProps<HTMLElement>
  summary: HTMLProps<HTMLElement>
  sup: HTMLProps<HTMLElement>
  table: HTMLTableProps<HTMLTableElement>
  tbody: HTMLProps<HTMLTableSectionElement>
  td: HTMLTdProps<HTMLTableCellElement>
  template: HTMLProps<HTMLTemplateElement>
  textarea: HTMLTextareaProps<HTMLTextAreaElement>
  tfoot: HTMLProps<HTMLTableSectionElement>
  th: HTMLThProps<HTMLTableCellElement>
  thead: HTMLProps<HTMLTableSectionElement>
  time: HTMLTimeProps<HTMLTimeElement>
  title: HTMLProps<HTMLTitleElement>
  tr: HTMLProps<HTMLTableRowElement>
  track: HTMLTrackProps<HTMLTrackElement>
  u: HTMLProps<HTMLElement>
  ul: HTMLProps<HTMLUListElement>
  var: HTMLProps<HTMLElement>
  video: HTMLVideoProps<HTMLVideoElement>
  wbr: HTMLProps<HTMLElement>
}

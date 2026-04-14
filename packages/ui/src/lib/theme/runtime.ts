import { createElement } from '@remix-run/component'

import {
  theme,
  themeVariableNames,
  type CreateThemeOptions,
  type ThemeComponent,
  type ThemeStyleProps,
  type ThemeValues,
  type ThemeVariableTree,
  type ThemeVars,
} from './contract.ts'

export function createTheme(values: ThemeValues, options: CreateThemeOptions = {}): ThemeComponent {
  let selector = options.selector ?? ':root'
  let reset = options.reset ?? true
  let vars = Object.freeze(collectThemeVars(themeVariableNames, values))
  let cssText = serializeThemeCss(selector, vars, { reset })

  function Theme() {
    return (props: ThemeStyleProps = {}) =>
      createElement('style', {
        nonce: props.nonce,
        'data-rmx-theme': '',
        'data-rmx-theme-selector': selector,
        innerHTML: escapeStyleText(cssText),
      })
  }

  return Object.assign(Theme, {
    Style: Theme,
    cssText,
    selector,
    values,
    vars,
  })
}

function collectThemeVars(
  tree: ThemeVariableTree,
  values: ThemeValues,
  path: string[] = [],
): Record<string, string> {
  let vars: Record<string, string> = {}

  for (let [key, value] of Object.entries(tree)) {
    let nextPath = [...path, key]
    let themeValue = (values as Record<string, unknown>)[key]

    if (typeof value === 'string') {
      if (typeof themeValue !== 'string' && typeof themeValue !== 'number') {
        throw new TypeError(
          `Expected theme value at "${nextPath.join('.')}" to be a string or number`,
        )
      }

      vars[value] = String(themeValue)
      continue
    }

    if (!isPlainObject(themeValue)) {
      throw new TypeError(`Expected theme group at "${nextPath.join('.')}" to be an object`)
    }

    Object.assign(vars, collectThemeVars(value, themeValue as ThemeValues, nextPath))
  }

  return vars
}

function serializeThemeCss(selector: string, vars: ThemeVars, options: { reset: boolean }): string {
  let lines = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  let blocks = [`${selector} {\n${lines}\n}`]

  if (options.reset) {
    blocks.push(serializeThemeResetCss(selector))
  }

  return blocks.join('\n\n')
}

function serializeThemeResetCss(selector: string): string {
  let fontFamily = theme.fontFamily.sans
  let fontSize = theme.fontSize.md
  let lineHeight = theme.lineHeight.normal
  let textColor = theme.colors.text.primary
  let backgroundColor = theme.surface.lvl0

  if (selector === ':root') {
    return [
      `*, *::before, *::after {\n  box-sizing: border-box;\n}`,
      `html, body {\n  margin: 0;\n}`,
      `body {\n  font-family: ${fontFamily};\n  font-size: ${fontSize};\n  line-height: ${lineHeight};\n  color: ${textColor};\n  background-color: ${backgroundColor};\n}`,
      `:where(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote) {\n  margin: 0;\n}`,
      `:where(img, svg) {\n  display: block;\n}`,
    ].join('\n\n')
  }

  return [
    `${selector}, ${selector} *, ${selector} *::before, ${selector} *::after {\n  box-sizing: border-box;\n}`,
    `${selector} {\n  font-family: ${fontFamily};\n  font-size: ${fontSize};\n  line-height: ${lineHeight};\n  color: ${textColor};\n  background-color: ${backgroundColor};\n}`,
    `${selector} :where(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote) {\n  margin: 0;\n}`,
    `${selector} :where(img, svg) {\n  display: block;\n}`,
  ].join('\n\n')
}

function escapeStyleText(cssText: string): string {
  return cssText.replace(/<\/style/gi, '<\\/style')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

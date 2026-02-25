import { defineStreamingPlugin } from '@remix-run/reconciler'
import type { StreamingPluginDefinition } from '@remix-run/reconciler'
import { normalizeDomProps, shouldNormalizeDomProps } from './plugins/normalize-dom-props.ts'
import { collectHtmlStreamingHeadHtml } from './html-streaming-contributions.ts'
import {
  appendClassName,
  compileCss,
  createCssClassName,
  createCssKey,
  CSS_MIXIN_STYLE_TAG_ATTR,
  CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR,
  isCssInput,
  isCssMixinDescriptor,
  type CssInput,
} from './mixins/css-shared.ts'

export function createHtmlStreamingPlugins(): StreamingPluginDefinition[] {
  return [
    cssMixStreamingPlugin,
    stylePropsStreamingPlugin,
    frameworkPropsStreamingPlugin,
    attributePropsStreamingPlugin,
  ]
}

let cssMixStreamingPlugin = defineStreamingPlugin({
  phase: 'special',
  priority: -20,
  keys: ['mix'],
  shouldActivate(context) {
    let mix = context.delta.nextProps.mix
    if (!Array.isArray(mix)) return false
    for (let index = 0; index < mix.length; index++) {
      if (isCssMixinDescriptor(mix[index])) return true
    }
    return false
  },
  setup() {
    return {
      commit(context) {
        let props = context.remainingPropsView()
        let mix = props.mix
        if (!Array.isArray(mix)) return
        let nonCssMix: unknown[] = []
        let nextClassName = props.className
        for (let index = 0; index < mix.length; index++) {
          let descriptor = mix[index]
          if (!isCssMixinDescriptor(descriptor)) {
            nonCssMix.push(descriptor)
            continue
          }
          let styleValue = descriptor.args[0]
          if (!isCssInput(styleValue)) continue
          let key = createCssKey(styleValue as CssInput)
          let className = createCssClassName(key)
          let cssText = compileCss(`.${className}`, styleValue as CssInput)
          collectHtmlStreamingHeadHtml(
            context.root,
            `css:${key}`,
            `<style ${CSS_MIXIN_STYLE_TAG_ATTR} ${CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR}="server">${cssText}</style>`,
          )
          nextClassName = appendClassName(nextClassName, className)
        }
        if (nextClassName !== props.className) {
          props.className = nextClassName
        }
        if (nonCssMix.length > 0) {
          props.mix = nonCssMix
        } else {
          delete props.mix
        }
        context.replaceProps(props)
      },
    }
  },
})

let frameworkPropsStreamingPlugin = defineStreamingPlugin({
  phase: 'special',
  priority: -10,
  keys: ['children', 'key', 'mix'],
  shouldActivate(context) {
    let props = context.delta.nextProps
    return 'mix' in props
  },
  setup() {
    return {
      commit(context) {
        let props = context.remainingPropsView()
        if ('mix' in props) delete props.mix
        context.replaceProps(props)
      },
    }
  },
})

let stylePropsStreamingPlugin = defineStreamingPlugin({
  phase: 'special',
  priority: 0,
  keys: ['style'],
  shouldActivate(context) {
    return 'style' in context.delta.nextProps
  },
  setup() {
    return {
      commit(context) {
        let props = context.remainingPropsView()
        let style = props.style
        if (style == null) return
        if (typeof style === 'string') return
        if (typeof style !== 'object' || Array.isArray(style)) {
          delete props.style
          context.replaceProps(props)
          return
        }
        props.style = serializeStyleObject(style as Record<string, unknown>)
        context.replaceProps(props)
      },
    }
  },
})

let attributePropsStreamingPlugin = defineStreamingPlugin({
  phase: 'special',
  priority: 10,
  shouldActivate(context) {
    return shouldNormalizeDomProps(context.delta.nextProps)
  },
  setup() {
    return {
      commit(context) {
        let props = context.remainingPropsView()
        let next = normalizeDomProps(props)
        if (next !== props) {
          context.replaceProps(next)
        }
      },
    }
  },
})

function serializeStyleObject(style: Record<string, unknown>) {
  let parts: string[] = []
  for (let key in style) {
    let value = style[key]
    if (value == null || value === false) continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    let cssName = key.startsWith('--')
      ? key
      : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    parts.push(`${cssName}:${String(value)}`)
  }
  return parts.join(';')
}

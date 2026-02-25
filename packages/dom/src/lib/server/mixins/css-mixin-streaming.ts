import { defineStreamingPlugin } from '@remix-run/reconciler'
import { collectHtmlStreamingCssChunk } from '../html-streaming-contributions.ts'
import {
  appendClassName,
  compileCss,
  createCssClassName,
  createCssKey,
  isCssInput,
  type CssInput,
} from '../../shared/css/css-compile.ts'
import { isCssMixinDescriptor } from '../../shared/css/css-mixin-tag.ts'

export let cssMixinStreamingPlugin = defineStreamingPlugin({
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
        let mix = props.mix as unknown[]
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
          collectHtmlStreamingCssChunk(context.root, key, cssText)
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

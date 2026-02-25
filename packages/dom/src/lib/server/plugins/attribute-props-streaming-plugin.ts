import { defineStreamingPlugin } from '@remix-run/reconciler'
import { normalizeDomProps, shouldNormalizeDomProps } from '../../shared/dom/normalize-dom-props.ts'

export let attributePropsStreamingPlugin = defineStreamingPlugin({
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

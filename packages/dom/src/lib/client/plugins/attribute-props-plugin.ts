import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { DomElementNode } from '../dom-node-policy.ts'
import { normalizeDomProps, shouldNormalizeDomProps } from '../../shared/dom/normalize-dom-props.ts'

export let attributePropsPlugin: Plugin<DomElementNode> = definePlugin({
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

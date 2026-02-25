import { defineStreamingPlugin } from '@remix-run/reconciler'

export let frameworkPropsStreamingPlugin = defineStreamingPlugin({
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

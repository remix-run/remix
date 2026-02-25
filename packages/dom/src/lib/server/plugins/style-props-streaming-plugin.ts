import { defineStreamingPlugin } from '@remix-run/reconciler'

export let stylePropsStreamingPlugin = defineStreamingPlugin({
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

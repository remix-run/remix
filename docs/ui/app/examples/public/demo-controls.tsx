import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

export type DemoControls = Record<string, readonly [string, ...string[]]>

export type DemoControlValues<controls extends DemoControls> = {
  [name in keyof controls]: controls[name][number]
}

/**
 * Wraps a docs example with a strip of controls styled as part of the docs frame, not the demo.
 * Each control is a set of string options; the first is the default. The example receives the
 * current selections as props, so its own source stays free of demo plumbing.
 *
 * The strip renders inside the example's client entry, because separately hydrated entries cannot
 * pass props to each other.
 */
export function withDemoControls<const controls extends DemoControls>(
  controls: controls,
  Example: (handle: Handle<DemoControlValues<controls>>) => () => RemixNode,
): (handle: Handle) => () => RemixNode {
  // The selections are only known to be complete at runtime, so render through an untyped view.
  let Component = Example as unknown as (handle: Handle<Record<string, string>>) => () => RemixNode

  return function DemoWithControls(handle: Handle) {
    let values: Record<string, string> = {}
    for (let name in controls) values[name] = controls[name][0]

    return () => (
      <>
        <Component {...values} />
        <div class="ui-demo-controls">
          {Object.entries(controls).map(([name, options]) => (
            <div key={name} role="radiogroup" aria-label={titleCase(name)}>
              <span aria-hidden="true">{titleCase(name)}</span>
              {options.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name={`${handle.id}-${name}`}
                    value={option}
                    checked={values[name] === option}
                    mix={on('change', () => {
                      values[name] = option
                      void handle.update()
                    })}
                  />
                  <span>{titleCase(option)}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </>
    )
  }
}

function titleCase(value: string) {
  let words = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')
  return words[0].toUpperCase() + words.slice(1).toLowerCase()
}

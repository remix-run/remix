// import { css, on, type Handle } from 'remix/component'
// import { Glyph, select, ui } from 'remix/ui'

// let selectExampleCss = css({
//   width: '16rem',
// })

// let environmentOptions = [
//   { label: 'Local', value: 'local' },
//   { label: 'Staging', value: 'staging' },
//   { label: 'Production', value: 'production' },
//   { disabled: true, label: 'Archived', value: 'archived' },
// ] as const

// export default function Example(handle: Handle) {
//   let label = 'Local'
//   let value = 'local'
//   let triggerId = `${handle.id}-trigger`

//   return () => (
//     <div mix={[ui.stack, ui.gap.sm]}>
//       <select.context defaultValue="local" name="environment">
//         <button id={triggerId} mix={[ui.button.select, selectExampleCss, select.button()]}>
//           <span mix={ui.button.label}>{label}</span>
//           <Glyph mix={ui.button.icon} name="chevronDown" />
//         </button>

//         <div
//           mix={[
//             select.popover(),
//             ui.popover.surface,
//             on(select.change, (event) => {
//               label = event.label
//               value = event.value
//               void handle.update()
//             }),
//           ]}
//         >
//           <div aria-labelledby={triggerId} mix={[select.list(), ui.listbox.surface]}>
//             {environmentOptions.map((option) => (
//               <div key={option.value} mix={[ui.listbox.option, select.option(option)]}>
//                 <Glyph mix={ui.listbox.glyph} name="check" />
//                 <span mix={ui.listbox.label}>{option.label}</span>
//               </div>
//             ))}
//           </div>
//         </div>

//         <input mix={select.hiddenInput()} />
//       </select.context>

//       <p>{`value=${value}`}</p>
//     </div>
//   )
// }
export default function Example() {
  return () => <div>Hi</div>
}

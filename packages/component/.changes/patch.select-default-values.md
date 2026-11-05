Align `<select>` initialization across server rendering, client mounting, and hydration with explicit precedence: `value`, then initial `defaultValue`, then option `selected`. This resolves previously ambiguous combinations of select and option selection props. Option `selected` remains supported when neither select value prop is provided.

Selections render on the server through components and optgroups, including implicit values from trusted option HTML. Single-select defaults and scalar controlled values select the first matching option. `defaultValue` initializes selection and native reset defaults; later changes or removal are ignored unless `multiple` changes. Hydration preserves reset defaults and edits to uncontrolled selects.

Controlled selections stay synchronized when nested option components, mixins, or separate client roots update.

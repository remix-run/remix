BREAKING CHANGE: `select`, `combobox` and `listbox` now commit a selection immediately. The `select` trigger label, the `combobox` input text, the hidden input value, and `SelectChangeEvent` / `ComboboxChangeEvent` update as soon as an option is selected, and the popup then closes with its exit transition, so there is no longer a delay before the selected value appears. The popup also starts closing immediately instead of holding open for a selection flash, so the `data-select-flash`, `data-combobox-flash` and `data-listbox-flash` option attributes are no longer set; style the selected option with `aria-selected` instead.

`listbox.Context` no longer accepts `flashSelection`, `selectionFlashAttribute` or `onSelectSettled`, and `select.Context` no longer accepts `labelSwapDelayMs`. `onSelect` is the only selection callback and runs synchronously, so move any work from `onSelectSettled` into it. `ListboxRef.select()` and `ListboxRef.selectActive()` now return `void` instead of a promise, and `listbox` no longer ignores highlight and selection requests after a selection, so consumers that close a popup after selecting should ignore requests themselves while it closes.

```diff
-<select.Context defaultLabel="Select a type" labelSwapDelayMs={100} name="issueType">
+<select.Context defaultLabel="Select a type" name="issueType">
```

```diff
 <listbox.Context
   value={value}
   activeValue={activeValue}
-  flashSelection
-  onSelect={onSelect}
-  onSelectSettled={(value, option) => saveSelection(value, option?.label)}
+  onSelect={(value, option) => {
+    onSelect(value, option)
+    saveSelection(value, option?.label)
+  }}
   onHighlight={onHighlight}
 >
```

`combobox` selects the input text as soon as an option is selected, rather than after the popup closes. `select`'s `defaultLabel` is the initial trigger label and is not derived from `defaultValue`, so pass the label of the `defaultValue` option when both are set.

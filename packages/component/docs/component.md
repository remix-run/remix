# component

## CSS Mixin

The syntax mirrors modern CSS nesting, but in object form. Use `&` to reference the current element in pseudo-selectors, pseudo-elements, and attribute selectors. Use class names directly for child selectors. Nested keys must start with `&`, `.`, `:`, `[`, or `@`, so write element selectors as `& h2`:

```css
.button {
  color: white;
  background-color: blue;

  &:hover {
    background-color: darkblue;
  }

  &::before {
    content: '';
    position: absolute;
  }

  &[aria-selected='true'] {
    border: 2px solid yellow;
  }

  .icon {
    width: 16px;
    height: 16px;
  }

  @media (max-width: 768px) {
    padding: 8px;
  }
}
```

```tsx
function Button(handle: Handle) {
  return () => (
    <button
      mix={[
        css({
          color: 'white',
          backgroundColor: 'blue',
          '&:hover': {
            backgroundColor: 'darkblue',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
          },
          '&[aria-selected="true"]': {
            border: '2px solid yellow',
          },
          '.icon': {
            width: '16px',
            height: '16px',
          },
          '@media (max-width: 768px)': {
            padding: '8px',
          },
        }),
      ]}
    >
      <span class="icon">★</span>
      Click me
    </button>
  )
}
```

# Styling

The `css` prop provides inline styling with support for pseudo-selectors, pseudo-elements, attribute selectors, descendant selectors, and media queries. It follows modern CSS nesting selector rules.

## Basic CSS Prop

```tsx
function Button() {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Click me
    </button>
  )
}
```

## CSS Prop vs Style Prop

The `css` prop produces static styles that are inserted into the document as CSS rules, while the `style` prop applies styles directly to the element. For **dynamic styles** that change frequently, use the `style` prop for better performance:

```tsx
// ❌ Avoid: Using css prop for dynamic styles
function ProgressBar(handle: Handle) {
  let progress = 0

  return () => (
    <div
      css={{
        width: `${progress}%`, // Creates new CSS rule on every update
        backgroundColor: 'blue',
      }}
    >
      {progress}%
    </div>
  )
}

// ✅ Prefer: Using style prop for dynamic styles
function ProgressBar(handle: Handle) {
  let progress = 0

  return () => (
    <div
      css={{
        backgroundColor: 'blue', // Static styles in css prop
      }}
      style={{
        width: `${progress}%`, // Dynamic styles in style prop
      }}
    >
      {progress}%
    </div>
  )
}
```

**Use the `css` prop for:**

- Static styles that don't change
- Styles that need pseudo-selectors (`:hover`, `:focus`, etc.)
- Styles that need media queries

**Use the `style` prop for:**

- Dynamic styles that change based on state or props
- Computed values that update frequently

## Pseudo-Selectors

Use `&` to reference the current element in pseudo-selectors:

```tsx
function Button() {
  return () => (
    <button
      css={{
        color: 'white',
        backgroundColor: 'blue',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: 'darkblue',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          backgroundColor: 'navy',
          transform: 'translateY(0)',
        },
        '&:focus': {
          outline: '2px solid yellow',
          outlineOffset: '2px',
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
      }}
    >
      Click me
    </button>
  )
}
```

## Pseudo-Elements

Use `&::before` and `&::after` for pseudo-elements:

```tsx
function Badge() {
  return (props: { count: number }) => (
    <div
      css={{
        position: 'relative',
        display: 'inline-block',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '8px',
          height: '8px',
          backgroundColor: 'red',
          borderRadius: '50%',
        },
      }}
    >
      {props.count > 0 && <span>{props.count}</span>}
    </div>
  )
}
```

## Attribute Selectors

Use `&[attribute]` for attribute selectors:

```tsx
function Input() {
  return (props: { required?: boolean }) => (
    <input
      required={props.required}
      css={{
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        '&[required]': {
          borderColor: 'red',
        },
        '&[aria-invalid="true"]': {
          borderColor: 'red',
          outline: '2px solid red',
        },
      }}
    />
  )
}
```

## Descendant Selectors

Use class names or element selectors directly for descendant selectors:

```tsx
function Card() {
  return (props: { children: RemixNode }) => (
    <div
      css={{
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        // Style descendants
        '& h2': {
          marginTop: 0,
          fontSize: '24px',
          fontWeight: 'bold',
        },
        '& p': {
          color: '#666',
          lineHeight: 1.6,
        },
        '& .icon': {
          width: '24px',
          height: '24px',
          marginRight: '8px',
        },
        '& button': {
          marginTop: '16px',
        },
      }}
    >
      {props.children}
    </div>
  )
}
```

## When to Use Nested Selectors

Use nested selectors when **parent state affects children**. Don't nest when you can style the element directly.

**This is preferable to creating JavaScript state and passing it around.** Instead of managing hover/focus state in JavaScript and passing it as props, use CSS nested selectors to let the browser handle state transitions declaratively.

**Use nested selectors when:**

1. **Parent state affects children** - Parent hover/focus/state changes child styling (prefer this over JavaScript state management)
2. **Styling descendant elements** - Avoid duplicating styles on every child or creating new components just for styling

**Don't nest when:**

- Styling the element's own pseudo-states (hover, focus, etc.)
- The element controls its own styling

**Example: Parent hover affects children** (use nested selectors, not JavaScript state):

```tsx
// ❌ Avoid: Managing hover state in JavaScript
function CardWithJSState(handle: Handle) {
  let isHovered = false

  return (props: { children: RemixNode }) => (
    <div
      on={{
        mouseenter() {
          isHovered = true
          handle.update()
        },
        mouseleave() {
          isHovered = false
          handle.update()
        },
      }}
      css={{
        border: `1px solid ${isHovered ? 'blue' : '#ddd'}`,
        // ... more conditional styling based on isHovered
      }}
    >
      <div className="title" css={{ color: isHovered ? 'blue' : '#333' }}>
        Title
      </div>
    </div>
  )
}

// ✅ Prefer: CSS nested selectors handle state declaratively
function Card(handle: Handle) {
  return (props: { children: RemixNode }) => (
    <div
      css={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        // Parent hover affects children - use nested selector
        '&:hover': {
          borderColor: 'blue',
          // Child text changes color on parent hover
          '& .title': {
            color: 'blue',
          },
          '& .description': {
            opacity: 1,
          },
        },
        '& .title': {
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#333',
        },
        '& .description': {
          opacity: 0.7,
          marginTop: '8px',
        },
      }}
    >
      <div className="title">Title</div>
    </div>
  )
}
```

**Example: Element's own hover** (style directly, no nesting needed):

```tsx
function Button() {
  return () => (
    <button
      css={{
        backgroundColor: 'blue',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer',
        // Element's own hover - style directly, no nesting needed
        '&:hover': {
          backgroundColor: 'darkblue',
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
      }}
    >
      Click me
    </button>
  )
}
```

**Example: Navigation with links** (descendant styling is appropriate):

```tsx
function Navigation() {
  return () => (
    <nav
      css={{
        display: 'flex',
        gap: '16px',
        // Styling descendant links - appropriate use of nesting
        '& a': {
          color: 'blue',
          textDecoration: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          // Link's own hover state - this is fine nested under '& a'
          '&:hover': {
            backgroundColor: '#f0f0f0',
            color: 'darkblue',
          },
          '&[aria-current="page"]': {
            backgroundColor: 'blue',
            color: 'white',
          },
        },
      }}
    >
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </nav>
  )
}
```

## Media Queries

Use `@media` for responsive design:

```tsx
function ResponsiveGrid() {
  return (props: { children: RemixNode }) => (
    <div
      css={{
        display: 'grid',
        gap: '16px',
        gridTemplateColumns: '1fr',
        '@media (min-width: 768px)': {
          gridTemplateColumns: 'repeat(2, 1fr)',
        },
        '@media (min-width: 1024px)': {
          gridTemplateColumns: 'repeat(3, 1fr)',
        },
      }}
    >
      {props.children}
    </div>
  )
}
```

## Complete Example

Here's a comprehensive example demonstrating parent-state-affecting-children and media queries:

```tsx
function ProductCard() {
  return (props: { title: string; price: number; image: string }) => (
    <div
      css={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        // Parent hover affects the card itself
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          // Parent hover affects children - appropriate use of nesting
          '& .title': {
            color: 'blue',
          },
          '& button': {
            backgroundColor: 'darkblue',
          },
        },
        '@media (max-width: 768px)': {
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
      }}
    >
      <img
        src={props.image}
        alt={props.title}
        css={{
          width: '100%',
          height: '200px',
          objectFit: 'cover',
          '@media (max-width: 768px)': {
            height: '150px',
          },
        }}
      />
      <div
        className="content"
        css={{
          padding: '16px',
          '@media (max-width: 768px)': {
            padding: '12px',
          },
        }}
      >
        <h3
          className="title"
          css={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginTop: 0,
            marginBottom: '8px',
            transition: 'color 0.2s',
          }}
        >
          {props.title}
        </h3>
        <div
          className="price"
          css={{
            fontSize: '20px',
            color: 'green',
            fontWeight: 'bold',
          }}
        >
          ${props.price}
        </div>
        <button
          css={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:active': {
              transform: 'scale(0.98)',
            },
          }}
        >
          Add to Cart
        </button>
      </div>
    </div>
  )
}
```

This example demonstrates:

- **Parent hover affecting children**: Card hover changes title color and button background
- **Styles on elements themselves**: Each element has its own `css` prop
- **Element's own states**: Button's `:active` state styled directly on the button
- **Media queries**: Responsive adjustments applied directly to elements

## See Also

- [Spring API](./spring.md) - Physics-based animation easing
- [Animate API](./animate.md) - Declarative enter/exit/layout animations

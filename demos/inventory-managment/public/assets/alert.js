import {
  createElement
} from "./alert-ah82ckfn.js";

// app/utils/css.ts
var kebabToCamel = (str) => str.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase()).trim();
function css(strings, ...values) {
  const fullString = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
  return parseCSS(fullString);
}
function parseCSS(cssString) {
  const result = {};
  const stack = [result];
  let currentBuffer = "";
  for (let i = 0;i < cssString.length; i++) {
    const char = cssString[i];
    if (char === "{") {
      const selector = currentBuffer.trim();
      const newObj = {};
      stack[stack.length - 1][selector] = newObj;
      stack.push(newObj);
      currentBuffer = "";
    } else if (char === "}") {
      if (currentBuffer.trim()) {
        processDeclaration(currentBuffer, stack[stack.length - 1]);
      }
      stack.pop();
      currentBuffer = "";
    } else if (char === ";") {
      processDeclaration(currentBuffer, stack[stack.length - 1]);
      currentBuffer = "";
    } else {
      currentBuffer += char;
    }
  }
  if (currentBuffer.trim()) {
    processDeclaration(currentBuffer, stack[0]);
  }
  return result;
}
function processDeclaration(raw, targetObj) {
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.includes(":"))
    return;
  const colonIndex = trimmed.indexOf(":");
  const property = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 1).trim();
  if (property && value) {
    targetObj[kebabToCamel(property)] = value;
  }
}
// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/jsx-runtime.js
function jsxDEV(type, props, key) {
  return jsxAdapter(type, props, key);
}
function jsxAdapter(type, props, key) {
  if (key !== undefined) {
    props = { ...props, key };
  }
  return createElement(type, props);
}
// app/assets/alert.tsx
var alertStyles = {
  default: css`
    background-color: var(--muted);
    color: var(--foreground);
    border-color: var(--border);
  `,
  destructive: css`
    background-color: var(--muted);
    color: var(--destructive);
    border-color: var(--destructive);
  `,
  success: css`
    background-color: var(--muted);
    color: var(--destructive);
    border-color: var(--destructive);
  `,
  warning: css`
    background-color: var(--muted);
    color: var(--destructive);
    border-color: var(--destructive);
  `
};
var baseStyles = css`
  padding: var(--spacing-4);
  border-radius: calc(var(--radius) - 2px);
  border: 1px solid;
  font-size: var(--text-sm);
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-start;
`;
function Alert({ variant = "default", css: css2, children, ...rest }) {
  return /* @__PURE__ */ jsxDEV("div", {
    role: "alert",
    ...rest,
    css: {
      ...baseStyles,
      ...alertStyles[variant],
      ...css2
    },
    children
  }, undefined, false, undefined, this);
}
function AlertTitle({ css: additionalCss, ...rest }) {
  return /* @__PURE__ */ jsxDEV("h5", {
    ...rest,
    css: {
      ...css`
          font-weight: var(--font-semibold);
          font-size: var(--text-sm);
          margin-bottom: var(--spacing-1);
        `,
      ...additionalCss
    }
  }, undefined, false, undefined, this);
}
function AlertDescription({ css: additionalCss, ...rest }) {
  return /* @__PURE__ */ jsxDEV("div", {
    ...rest,
    css: {
      ...css`
          font-size: var(--text-sm);
          opacity: 0.9;
        `,
      ...additionalCss
    }
  }, undefined, false, undefined, this);
}
export {
  AlertTitle,
  AlertDescription,
  Alert
};

//# debugId=7BCB68DE1B55C4E764756E2164756E21

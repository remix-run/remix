// ../shared.ts
var idCounter = 1;
var A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy"
];
var C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange"
];
var N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard"
];
function buildData(count) {
  let data = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: idCounter++,
      label: `${A[i % A.length]} ${C[i % C.length]} ${N[i % N.length]}`
    };
  }
  return data;
}
function get1000Rows() {
  return buildData(1e3);
}
function get10000Rows() {
  return buildData(1e4);
}
function updatedEvery10thRow(data) {
  let newData = data.slice(0);
  for (let i = 0, d = data, len = d.length; i < len; i += 10) {
    newData[i] = { id: data[i].id, label: data[i].label + " !!!" };
  }
  return newData;
}
function swapRows(data) {
  let d = data.slice();
  if (d.length > 998) {
    let tmp = d[1];
    d[1] = d[998];
    d[998] = tmp;
  }
  return d;
}
function remove(data, id) {
  return data.filter((d) => d.id !== id);
}
function sortRows(data, ascending = true) {
  let sorted = data.slice().sort((a, b) => {
    if (ascending) {
      return a.label.localeCompare(b.label);
    } else {
      return b.label.localeCompare(a.label);
    }
  });
  return sorted;
}

// ../../../src/runtime/jsx.ts
function jsx(type, props, key) {
  return { type, props: normalizeElementProps(props), key, $rmx: true };
}
function normalizeElementProps(props) {
  if (!props) return {};
  if (!("mix" in props)) return props;
  let { mix, ...rest } = props;
  let normalizedMix = normalizeMixValue(mix);
  return normalizedMix === void 0 ? rest : { ...rest, mix: normalizedMix };
}
function normalizeMixValue(mix) {
  if (!mix) return void 0;
  let normalizedMix = [];
  flattenMixValue(mix, normalizedMix);
  return normalizedMix.length === 0 ? void 0 : normalizedMix;
}
function flattenMixValue(mix, out) {
  if (!mix) return;
  if (!Array.isArray(mix)) {
    out.push(mix);
    return;
  }
  for (let item of mix) {
    flattenMixValue(item, out);
  }
}

// ../../../src/runtime/typed-event-target.ts
var TypedEventTarget = class extends EventTarget {
};

// ../../../src/runtime/component.ts
function createComponent(config) {
  let taskQueue = [];
  let renderCtrl = null;
  let connectedCtrl = null;
  let contextValue = void 0;
  function getConnectedSignal() {
    if (!connectedCtrl) connectedCtrl = new AbortController();
    return connectedCtrl.signal;
  }
  let getContent = null;
  let scheduleUpdate = () => {
    throw new Error("scheduleUpdate not implemented");
  };
  let props = {};
  let context = {
    set: (value) => {
      contextValue = value;
    },
    get: (type) => config.getContext(type)
  };
  let handle = {
    id: config.id,
    props,
    update: () => new Promise((resolve) => {
      taskQueue.push((signal) => resolve(signal));
      scheduleUpdate();
    }),
    queueTask: (task) => {
      taskQueue.push(task);
    },
    frame: config.frame,
    frames: {
      get top() {
        return config.getTopFrame?.() ?? config.frame;
      },
      get(name2) {
        return config.getFrameByName(name2);
      }
    },
    context,
    get signal() {
      return config.signal ?? getConnectedSignal();
    }
  };
  function dequeueTasks() {
    let needsSignal = taskQueue.some((task) => task.length >= 1);
    if (needsSignal && !renderCtrl) {
      renderCtrl = new AbortController();
    }
    let signal = renderCtrl?.signal;
    return taskQueue.splice(0, taskQueue.length).map((task) => () => task(signal));
  }
  function render(props2) {
    if (connectedCtrl?.signal.aborted) {
      console.warn("render called after component was removed, potential application memory leak");
      return [null, []];
    }
    if (renderCtrl) {
      renderCtrl.abort();
      renderCtrl = null;
    }
    syncProps(handle.props, props2);
    let renderContent = getContent;
    if (!renderContent) {
      let result = config.type(handle);
      if (typeof result !== "function") {
        let name2 = config.type.name || "Anonymous";
        throw new Error(`${name2} must return a render function, received ${typeof result}`);
      } else {
        getContent = result;
        renderContent = result;
      }
    }
    if (!renderContent) {
      throw new Error("component render function was not initialized");
    }
    let node = renderContent(handle.props);
    return [node, dequeueTasks()];
  }
  function remove3() {
    connectedCtrl?.abort();
    renderCtrl?.abort();
    return dequeueTasks();
  }
  function setScheduleUpdate(nextScheduleUpdate) {
    scheduleUpdate = nextScheduleUpdate;
  }
  function getContextValue() {
    return contextValue;
  }
  return { render, remove: remove3, setScheduleUpdate, frame: config.frame, getContextValue };
}
function syncProps(target, next) {
  for (let key in target) {
    if (!(key in next)) {
      delete target[key];
    }
  }
  for (let key in next) {
    target[key] = next[key];
  }
}
function Frame(handle) {
  void handle;
  return () => null;
}
function Fragment(handle) {
  void handle;
  return () => null;
}
function createFrameHandle(def) {
  return Object.assign(
    new TypedEventTarget(),
    {
      src: "/",
      replace: notImplemented("replace not implemented"),
      reload: notImplemented("reload not implemented")
    },
    def
  );
}
function notImplemented(msg) {
  return () => {
    throw new Error(msg);
  };
}

// ../../../src/runtime/error-event.ts
function createComponentErrorEvent(error) {
  return new ErrorEvent("error", { error });
}
function getComponentError(event) {
  return event.error;
}

// ../../../src/runtime/invariant.ts
function invariant(assertion, message) {
  let prefix = "Framework invariant";
  if (assertion) return;
  throw new Error(message ? `${prefix}: ${message}` : prefix);
}

// ../../../src/runtime/document-state.ts
function createDocumentState(_doc) {
  let doc = _doc ?? document;
  function getActiveElement() {
    return doc.activeElement || doc.body;
  }
  function hasSelectionCapabilities(elem) {
    let nodeName = elem.nodeName.toLowerCase();
    return nodeName === "input" && "type" in elem && (elem.type === "text" || elem.type === "search" || elem.type === "tel" || elem.type === "url" || elem.type === "password") || nodeName === "textarea" || elem instanceof HTMLElement && elem.contentEditable === "true";
  }
  function getSelection(input) {
    if ("selectionStart" in input && typeof input.selectionStart === "number" && "selectionEnd" in input) {
      let htmlInput = input;
      return {
        start: htmlInput.selectionStart ?? 0,
        end: htmlInput.selectionEnd ?? htmlInput.selectionStart ?? 0
      };
    }
    return null;
  }
  function setSelection(input, offsets) {
    if ("selectionStart" in input && "selectionEnd" in input) {
      try {
        let htmlInput = input;
        htmlInput.selectionStart = offsets.start;
        htmlInput.selectionEnd = Math.min(offsets.end, htmlInput.value?.length ?? 0);
      } catch {
      }
    }
  }
  function isInDocument(node) {
    return doc.documentElement.contains(node);
  }
  function getSelectionInformation() {
    let focusedElem = getActiveElement();
    return {
      focusedElem,
      selectionRange: focusedElem && hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null
    };
  }
  function restoreSelection(priorSelectionInformation) {
    let curFocusedElem = getActiveElement();
    let priorFocusedElem = priorSelectionInformation.focusedElem;
    let priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem && priorFocusedElem && isInDocument(priorFocusedElem)) {
      let ancestors = [];
      let ancestor = priorFocusedElem;
      while (ancestor) {
        if (ancestor.nodeType === Node.ELEMENT_NODE) {
          let el2 = ancestor;
          ancestors.push({
            element: el2,
            left: el2.scrollLeft ?? 0,
            top: el2.scrollTop ?? 0
          });
        }
        ancestor = ancestor.parentNode;
      }
      if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
        setSelection(priorFocusedElem, priorSelectionRange);
      }
      if (priorFocusedElem instanceof HTMLElement && typeof priorFocusedElem.focus === "function") {
        priorFocusedElem.focus();
      }
      for (let info of ancestors) {
        info.element.scrollLeft = info.left;
        info.element.scrollTop = info.top;
      }
    }
  }
  let selectionInfo = null;
  function capture() {
    selectionInfo = getSelectionInformation();
  }
  function restore() {
    if (selectionInfo !== null) {
      restoreSelection(selectionInfo);
    }
    selectionInfo = null;
  }
  return { capture, restore };
}

// ../../../src/runtime/vnode.ts
var TEXT_NODE = /* @__PURE__ */ Symbol("TEXT_NODE");
var ROOT_VNODE = /* @__PURE__ */ Symbol("ROOT_VNODE");
function isFragmentNode(node) {
  return node.type === Fragment;
}
function isTextNode(node) {
  return node.type === TEXT_NODE;
}
function isCommittedTextNode(node) {
  return isTextNode(node) && node._dom instanceof Text;
}
function isHostNode(node) {
  return typeof node.type === "string";
}
function isCommittedHostNode(node) {
  return isHostNode(node) && node._dom instanceof Element;
}
function isComponentNode(node) {
  return typeof node.type === "function" && node.type !== Frame;
}
function isCommittedComponentNode(node) {
  return isComponentNode(node) && node._content !== void 0;
}
function isRemixElement(node) {
  return typeof node === "object" && node !== null && "$rmx" in node;
}
function findContextFromAncestry(node, type) {
  let current = node;
  while (current) {
    if (current.type === type && isComponentNode(current)) {
      return current._handle.getContextValue();
    }
    current = current._parent;
  }
  return void 0;
}

// ../../../src/style/stylesheet.ts
var SERVER_STYLE_SELECTOR = "style[data-rmx]";
var DEFAULT_STYLE_LAYER = "rmx";
function getStyleLayerName(className, layer = DEFAULT_STYLE_LAYER) {
  return `${layer}.${className}`;
}
function compareNodesInDocumentOrder(a, b) {
  if (a === b) return 0;
  let position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
function isParentNode(value) {
  return "querySelectorAll" in value;
}
function collectServerStyleTagsFromNode(node, into) {
  if (isHtmlStyleElement(node) && node.matches(SERVER_STYLE_SELECTOR)) {
    into.add(node);
    return;
  }
  if (!(node instanceof Element) && !(node instanceof Document) && !(node instanceof DocumentFragment)) {
    return;
  }
  let nested = node.querySelectorAll?.(SERVER_STYLE_SELECTOR) ?? [];
  for (let i = 0; i < nested.length; i++) {
    let el2 = nested[i];
    if (isHtmlStyleElement(el2)) {
      into.add(el2);
    }
  }
}
function collectServerStyleTags(source) {
  let styles = /* @__PURE__ */ new Set();
  if (isParentNode(source)) {
    collectServerStyleTagsFromNode(source, styles);
  } else {
    for (let node of source) {
      collectServerStyleTagsFromNode(node, styles);
    }
  }
  return Array.from(styles).sort(compareNodesInDocumentOrder);
}
function isHtmlStyleElement(node) {
  return typeof node === "object" && node !== null && node instanceof HTMLStyleElement;
}
function getStyleSelector(styleEl) {
  let selector = styleEl.getAttribute("data-rmx")?.trim();
  return selector ? selector : null;
}
function createStyleManager(layer = "rmx") {
  let stylesheet = null;
  let generation = 0;
  let ruleMap = /* @__PURE__ */ new Map();
  function getStylesheet() {
    if (!stylesheet) {
      stylesheet = new CSSStyleSheet();
      document.adoptedStyleSheets.push(stylesheet);
    }
    return stylesheet;
  }
  function removeStylesheet() {
    if (!stylesheet) return;
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
      (s) => s !== stylesheet
    );
    stylesheet = null;
  }
  function clearStylesheet() {
    if (!stylesheet) return;
    for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
      stylesheet.deleteRule(i);
    }
  }
  function adoptServerStyleTag(styleEl) {
    let selector = getStyleSelector(styleEl);
    if (!selector) return;
    if (ruleMap.has(selector)) {
      styleEl.remove();
      return;
    }
    let cssText = styleEl.textContent?.trim() ?? "";
    if (cssText.length === 0) {
      styleEl.remove();
      return;
    }
    try {
      let sheet = getStylesheet();
      let index = sheet.cssRules.length;
      sheet.insertRule(cssText, index);
      ruleMap.set(selector, { count: 1, index });
      styleEl.remove();
    } catch {
    }
  }
  function has(className) {
    let entry = ruleMap.get(className);
    return entry !== void 0 && entry.count > 0;
  }
  function getGeneration() {
    return generation;
  }
  function insert2(className, rule) {
    let entry = ruleMap.get(className);
    if (entry) {
      entry.count++;
      return;
    }
    let sheet = getStylesheet();
    let index = sheet.cssRules.length;
    sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index);
    ruleMap.set(className, { count: 1, index });
  }
  function remove3(className) {
    let entry = ruleMap.get(className);
    if (!entry) return;
    entry.count--;
    if (entry.count > 0) {
      return;
    }
    let indexToDelete = entry.index;
    ruleMap.delete(className);
    if (!stylesheet) return;
    stylesheet.deleteRule(indexToDelete);
    for (let [, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--;
      }
    }
  }
  function reset() {
    clearStylesheet();
    ruleMap.clear();
    removeStylesheet();
    generation++;
  }
  function adoptServerStyles(source) {
    let styles = collectServerStyleTags(source);
    for (let styleEl of styles) {
      adoptServerStyleTag(styleEl);
    }
  }
  function dispose() {
    removeStylesheet();
    ruleMap.clear();
    generation++;
  }
  return { insert: insert2, remove: remove3, has, getGeneration, reset, adoptServerStyles, dispose };
}

// ../../../src/style/style.ts
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
var NUMERIC_CSS_PROPS = /* @__PURE__ */ new Set([
  "aspect-ratio",
  "z-index",
  "opacity",
  "flex-grow",
  "flex-shrink",
  "flex-order",
  "grid-area",
  "grid-row",
  "grid-column",
  "font-weight",
  "line-height",
  "order",
  "orphans",
  "widows",
  "zoom",
  "columns",
  "column-count"
]);
function normalizeCssValue(key, value) {
  if (value == null) return String(value);
  if (typeof value === "number" && value !== 0) {
    let cssKey = camelToKebab(key);
    if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith("--")) {
      return `${value}px`;
    }
  }
  return String(value);
}

// ../../../src/runtime/svg-attributes.ts
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XML_NS = "http://www.w3.org/XML/1998/namespace";
var CANONICAL_CAMEL_SVG_ATTRS = /* @__PURE__ */ new Set([
  "accentHeight",
  "attributeName",
  "attributeType",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "viewBox",
  "preserveAspectRatio",
  "externalResourcesRequired",
  "filterRes",
  "gradientUnits",
  "gradientTransform",
  "glyphRef",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "markerWidth",
  "numOctaves",
  "pathLength",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "refX",
  "refY",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan",
  "edgeMode",
  "diffuseConstant",
  "markerUnits"
]);
var SVG_ATTR_ALIASES = /* @__PURE__ */ new Map();
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(camelToKebab2(attr), attr);
}
var NAMESPACED_SVG_ALIASES = /* @__PURE__ */ new Map([
  ["xlinkHref", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlink:href", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlink-href", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlinkActuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlink:actuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlink-actuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlinkArcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlink:arcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlink-arcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlinkRole", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlink:role", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlink-role", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlinkShow", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlink:show", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlink-show", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlinkTitle", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlink:title", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlink-title", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlinkType", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xlink:type", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xlink-type", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xmlBase", { ns: XML_NS, attr: "xml:base" }],
  ["xml:base", { ns: XML_NS, attr: "xml:base" }],
  ["xml-base", { ns: XML_NS, attr: "xml:base" }],
  ["xmlLang", { ns: XML_NS, attr: "xml:lang" }],
  ["xml:lang", { ns: XML_NS, attr: "xml:lang" }],
  ["xml-lang", { ns: XML_NS, attr: "xml:lang" }],
  ["xmlSpace", { ns: XML_NS, attr: "xml:space" }],
  ["xml:space", { ns: XML_NS, attr: "xml:space" }],
  ["xml-space", { ns: XML_NS, attr: "xml:space" }],
  ["xmlnsXlink", { attr: "xmlns:xlink" }],
  ["xmlns:xlink", { attr: "xmlns:xlink" }],
  ["xmlns-xlink", { attr: "xmlns:xlink" }]
]);
function normalizeSvgAttributeName(name2) {
  let alias = SVG_ATTR_ALIASES.get(name2);
  if (alias) return alias;
  if (CANONICAL_CAMEL_SVG_ATTRS.has(name2)) return name2;
  return camelToKebab2(name2);
}
function normalizeSvgAttribute(name2) {
  let namespaced = NAMESPACED_SVG_ALIASES.get(name2);
  if (namespaced) {
    return namespaced;
  }
  return { attr: normalizeSvgAttributeName(name2) };
}
function camelToKebab2(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

// ../../../src/runtime/diff-props.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var globalStyleManager = typeof window !== "undefined" ? createStyleManager() : null;
var defaultStyleManager = globalStyleManager;
var ATTRIBUTE_FALLBACK_NAMES = /* @__PURE__ */ new Set([
  "width",
  "height",
  "href",
  "list",
  "form",
  "tabIndex",
  "download",
  "rowSpan",
  "colSpan",
  "role",
  "popover"
]);
function canUseProperty(dom, name2, isSvg) {
  if (isSvg) return false;
  if (ATTRIBUTE_FALLBACK_NAMES.has(name2)) return false;
  return name2 in dom;
}
function isFrameworkProp(name2) {
  return name2 === "children" || name2 === "mix" || name2 === "key" || name2 === "animate" || name2 === "innerHTML";
}
function serializeStyleObject(style) {
  let parts = [];
  for (let [key, value] of Object.entries(style)) {
    if (value == null) continue;
    if (typeof value === "boolean") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    let cssValue = Array.isArray(value) ? value.join(", ") : normalizeCssValue(key, value);
    parts.push(`${cssKey}: ${cssValue};`);
  }
  return parts.join(" ");
}
function normalizePropName(name2, isSvg) {
  if (name2.startsWith("aria-") || name2.startsWith("data-")) return { attr: name2 };
  if (name2 === "className") return { attr: "class" };
  if (!isSvg) {
    if (name2 === "htmlFor") return { attr: "for" };
    if (name2 === "tabIndex") return { attr: "tabindex" };
    if (name2 === "acceptCharset") return { attr: "accept-charset" };
    if (name2 === "httpEquiv") return { attr: "http-equiv" };
    return { attr: name2.toLowerCase() };
  }
  return normalizeSvgAttribute(name2);
}
function toLocalName(attrName) {
  let separatorIndex = attrName.indexOf(":");
  if (separatorIndex === -1) return attrName;
  return attrName.slice(separatorIndex + 1);
}
function clearRuntimePropertyOnRemoval(dom, name2) {
  try {
    if (name2 === "value" || name2 === "defaultValue") {
      dom[name2] = "";
      return;
    }
    if (name2 === "checked" || name2 === "defaultChecked" || name2 === "selected") {
      dom[name2] = false;
      return;
    }
    if (name2 === "selectedIndex") {
      dom[name2] = -1;
    }
  } catch {
  }
}
function getMergedClassName(props) {
  let classAttr = typeof props.class === "string" ? props.class : "";
  let className = typeof props.className === "string" ? props.className : "";
  let mergedClassName = classAttr && className ? `${classAttr} ${className}` : classAttr || className;
  return mergedClassName || void 0;
}
function diffHostProps(curr, next, dom) {
  let isSvg = dom.namespaceURI === SVG_NS;
  let currClassName = getMergedClassName(curr);
  let nextClassName = getMergedClassName(next);
  if (currClassName !== nextClassName) {
    if (nextClassName) {
      dom.setAttribute("class", nextClassName);
    } else {
      dom.removeAttribute("class");
    }
  }
  for (let name2 in curr) {
    if (isFrameworkProp(name2)) continue;
    if (name2 === "class" || name2 === "className") continue;
    if (!(name2 in next) || next[name2] == null) {
      if (canUseProperty(dom, name2, isSvg)) {
        clearRuntimePropertyOnRemoval(dom, name2);
      }
      let { ns, attr } = normalizePropName(name2, isSvg);
      if (ns) dom.removeAttributeNS(ns, toLocalName(attr));
      else dom.removeAttribute(attr);
    }
  }
  for (let name2 in next) {
    if (isFrameworkProp(name2)) continue;
    if (name2 === "class" || name2 === "className") continue;
    let nextValue = next[name2];
    if (nextValue == null) continue;
    let prevValue = curr[name2];
    if (prevValue !== nextValue) {
      let { ns, attr } = normalizePropName(name2, isSvg);
      if (attr === "style" && typeof nextValue === "object" && nextValue && !Array.isArray(nextValue)) {
        dom.setAttribute("style", serializeStyleObject(nextValue));
        continue;
      }
      if (canUseProperty(dom, name2, isSvg)) {
        try {
          dom[name2] = nextValue == null ? "" : nextValue;
          continue;
        } catch {
        }
      }
      if (typeof nextValue === "function") {
        continue;
      }
      let isAriaOrData = name2.startsWith("aria-") || name2.startsWith("data-");
      if (nextValue != null && (nextValue !== false || isAriaOrData)) {
        let attrValue = name2 === "popover" && nextValue === true ? "" : String(nextValue);
        if (ns) dom.setAttributeNS(ns, attr, attrValue);
        else dom.setAttribute(attr, attrValue);
      } else {
        if (ns) dom.removeAttributeNS(ns, toLocalName(attr));
        else dom.removeAttribute(attr);
      }
    }
  }
}

// ../../../src/runtime/client-entries.ts
function logHydrationMismatch(...msg) {
  console.error("Hydration mismatch:", ...msg);
}
function skipComments(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling;
  }
  return cursor;
}

// ../../../src/runtime/to-vnode.ts
function flatMapChildrenToVNodes(node) {
  if (!("children" in node.props)) return [];
  let children = node.props.children;
  if (!Array.isArray(children)) return [toVNode(children)];
  let vnodes = [];
  flattenChildrenToVNodes(children, vnodes);
  return vnodes;
}
function flattenChildrenToVNodes(nodes, out) {
  for (let child of nodes) {
    if (Array.isArray(child)) {
      flattenChildrenToVNodes(child, out);
    } else {
      out.push(toVNode(child));
    }
  }
}
function toVNode(node) {
  if (node === null || node === void 0 || typeof node === "boolean") {
    return { type: TEXT_NODE, _text: "" };
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return { type: TEXT_NODE, _text: String(node) };
  }
  if (Array.isArray(node)) {
    let children = [];
    flattenChildrenToVNodes(node, children);
    return { type: Fragment, _children: children };
  }
  if (node.type === Fragment) {
    return { type: Fragment, key: node.key, _children: flatMapChildrenToVNodes(node) };
  }
  if (isRemixElement(node)) {
    let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node);
    return { type: node.type, key: node.key, props: node.props, _children: children };
  }
  invariant(false, "Unexpected RemixNode");
}

// ../../../src/runtime/mixins/mixin.ts
var mixinHandleId = 0;
function createMixin(type) {
  return (...args) => ({
    type,
    args
  });
}
function resolveMixedProps(input) {
  let state = input.state ?? createMixinRuntimeState();
  let handle = state.handle;
  if (!handle) {
    handle = createMixinHandle({
      id: state.id,
      hostType: input.hostType,
      frame: input.frame,
      scheduler: input.scheduler,
      getContext: input.getContext ?? (() => void 0),
      getRuntimeSignal: () => getMixinRuntimeSignal(state),
      getBinding: () => state.binding
    });
    state.handle = handle;
  }
  let hostType = input.hostType;
  let descriptors = resolveMixDescriptors(input.props);
  let composedProps = withoutMix(input.props);
  let mixinProps = withoutMixinTreeProps(composedProps);
  let maxDescriptors = 1024;
  for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
    let descriptor = descriptors[index];
    let entry = state.runners[index];
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        queueMixinRemove(handle, entry.scope);
      }
      let scope = /* @__PURE__ */ Symbol("mixin-scope");
      handle.setActiveScope(scope);
      entry = {
        scope,
        type: descriptor.type,
        runner: normalizeMixinRunner(
          descriptor.type(handle, hostType),
          handle
        )
      };
      handle.setActiveScope(void 0);
      state.runners[index] = entry;
      let binding = state.binding;
      if (binding?.node) {
        queueMixinInsert(handle, entry.scope, binding.node, binding.parent, binding.key);
      }
    }
    handle.setActiveScope(entry.scope);
    let result = entry.runner(...descriptor.args, mixinProps);
    handle.setActiveScope(void 0);
    if (!result) continue;
    if (isMixinElement(result)) continue;
    let returnedDescriptors = resolveReturnedMixDescriptors(result);
    if (returnedDescriptors) {
      for (let returned of returnedDescriptors) descriptors.push(returned);
      continue;
    }
    if (!isRemixElement2(result)) {
      console.error(new Error("mixins must return a remix element"));
      continue;
    }
    let resultType = typeof result.type === "string" ? result.type : isMixinElement(result.type) ? result.type.__rmxMixinElementType : null;
    if (resultType !== hostType) {
      console.error(new Error("mixins must return an element with the same host type"));
      continue;
    }
    if (result.type !== resultType) {
      result = { ...result, type: resultType };
    }
    let nextProps = sanitizeReturnedMixinProps(result.props);
    let nestedDescriptors = resolveMixDescriptors(nextProps);
    for (let nested of nestedDescriptors) descriptors.push(nested);
    composedProps = composeMixinProps(composedProps, withoutMix(nextProps));
    mixinProps = withoutMixinTreeProps(composedProps);
  }
  for (let index = descriptors.length; index < state.runners.length; index++) {
    let entry = state.runners[index];
    if (entry) {
      handle.dispatchScopedEvent(entry.scope, new Event("remove"));
      handle.releaseScope(entry.scope);
    }
  }
  if (state.runners.length > descriptors.length) {
    state.runners.length = descriptors.length;
  }
  let nextMix = input.props.mix;
  return {
    state,
    props: {
      ...composedProps,
      ...nextMix === void 0 ? {} : { mix: nextMix }
    }
  };
}
function teardownMixins(state) {
  if (!state) return;
  state.binding = void 0;
  prepareMixinRemoval(state);
  cancelPendingMixinRemoval(state);
  let handle = state.handle;
  if (handle) {
    handle.queueCommitTask(() => finalizeMixinTeardown(state));
    return;
  }
  finalizeMixinTeardown(state);
}
function bindMixinRuntime(state, binding, options) {
  if (!state) return;
  let previousNode = state.binding?.node;
  let nextBinding = binding;
  state.binding = nextBinding;
  if (!nextBinding?.node || previousNode === nextBinding.node) return;
  let nextNode = nextBinding.node;
  let handle = state.handle;
  if (!handle) return;
  for (let entry of state.runners) {
    if (options?.dispatchReclaimed) {
      queueMixinReclaimed(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key);
    } else {
      queueMixinInsert(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key);
    }
  }
}
function prepareMixinRemoval(state) {
  if (!state || state.removePrepared) return state?.pendingRemoval?.done;
  state.removePrepared = true;
  let pendingRemoval;
  let persistTeardowns = [];
  let registerPersistNode = (teardown) => {
    persistTeardowns.push(teardown);
  };
  let handle = state.handle;
  if (!handle) return;
  for (let entry of state.runners) {
    dispatchMixinBeforeRemove(handle, entry.scope, registerPersistNode);
  }
  if (persistTeardowns.length > 0) {
    let controller = new AbortController();
    let done = Promise.allSettled(
      persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal)))
    ).then(() => {
    });
    pendingRemoval = {
      signal: controller.signal,
      cancel(reason) {
        controller.abort(reason);
      },
      done
    };
  }
  state.pendingRemoval = pendingRemoval;
  return pendingRemoval?.done;
}
function cancelPendingMixinRemoval(state, reason = new DOMException("", "AbortError")) {
  if (!state?.pendingRemoval) return;
  state.pendingRemoval.cancel(reason);
  state.pendingRemoval = void 0;
  state.removePrepared = false;
}
function createMixinRuntimeState() {
  return {
    id: `m${++mixinHandleId}`,
    aborted: false,
    runners: []
  };
}
function createMixinHandle(options) {
  return new MixinHandleImpl(options);
}
var MixinHandleImpl = class extends TypedEventTarget {
  id;
  context;
  frame;
  element;
  #options;
  #phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  #activeScope;
  #scopeSignals = /* @__PURE__ */ new Map();
  #scopeTargets = /* @__PURE__ */ new Map();
  #scopePhaseCounts = /* @__PURE__ */ new Map();
  #onSchedulerBeforeUpdate = (event) => {
    this.#dispatchSchedulerPhaseToHandle("beforeUpdate", event);
  };
  #onSchedulerCommit = (event) => {
    this.#dispatchSchedulerPhaseToHandle("commit", event);
  };
  constructor(options) {
    super();
    this.#options = options;
    this.id = options.id;
    this.context = {
      get: options.getContext
    };
    this.frame = options.frame;
    let element = ((_, __) => (props) => ({
      $rmx: true,
      type: options.hostType,
      key: null,
      props
    }));
    element.__rmxMixinElementType = options.hostType;
    this.element = element;
  }
  get signal() {
    let scope = this.#activeScope;
    invariant(
      scope,
      "handle.signal is only available during mixin setup, render, or lifecycle callbacks"
    );
    return this.#getScopeSignal(scope);
  }
  addEventListener(type, listener, options) {
    let target = this.#getActiveScopeTarget();
    target.addEventListener(
      type,
      listener,
      options
    );
    if (!listener || !isSchedulerPhaseType(type)) return;
    let scope = this.#activeScope;
    invariant(scope);
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    invariant(scopePhaseCounts);
    scopePhaseCounts[type] += 1;
    this.#phaseListenerCounts[type] += 1;
    if (this.#phaseListenerCounts[type] !== 1) return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.addEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.addEventListener("commit", this.#onSchedulerCommit);
    }
  }
  removeEventListener(type, listener, options) {
    let target = this.#getActiveScopeTarget();
    target.removeEventListener(
      type,
      listener,
      typeof options === "boolean" ? { capture: options } : options
    );
    if (!listener || !isSchedulerPhaseType(type)) return;
    let scope = this.#activeScope;
    invariant(scope);
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    invariant(scopePhaseCounts);
    scopePhaseCounts[type] = Math.max(0, scopePhaseCounts[type] - 1);
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - 1);
    if (this.#phaseListenerCounts[type] !== 0) return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.removeEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.removeEventListener("commit", this.#onSchedulerCommit);
    }
  }
  update() {
    return new Promise((resolve) => {
      let signal = this.#options.getRuntimeSignal();
      if (signal.aborted) {
        resolve(signal);
        return;
      }
      let binding = this.#options.getBinding();
      if (!binding) {
        resolve(signal);
        return;
      }
      binding.enqueueUpdate(resolve);
    });
  }
  queueTask(task) {
    this.#options.scheduler.enqueueTasks([
      () => {
        let binding = this.#options.getBinding();
        invariant(binding);
        task(binding.node, this.#options.getRuntimeSignal());
      }
    ]);
  }
  queueCommitTask(task) {
    this.#options.scheduler.enqueueCommitPhase([task]);
  }
  setActiveScope(scope) {
    this.#activeScope = scope;
    if (!scope) return;
    if (this.#scopeTargets.has(scope)) return;
    this.#scopeSignals.set(scope, new AbortController());
    this.#scopeTargets.set(scope, new TypedEventTarget());
    this.#scopePhaseCounts.set(scope, { beforeUpdate: 0, commit: 0 });
  }
  dispatchScopedEvent(scope, event) {
    let previousScope = this.#activeScope;
    this.#activeScope = scope;
    this.#scopeTargets.get(scope)?.dispatchEvent(event);
    this.#activeScope = previousScope;
  }
  releaseScope(scope) {
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    if (scopePhaseCounts) {
      this.#decrementGlobalPhaseCount("beforeUpdate", scopePhaseCounts.beforeUpdate);
      this.#decrementGlobalPhaseCount("commit", scopePhaseCounts.commit);
    }
    this.#scopeSignals.get(scope)?.abort();
    this.#scopeSignals.delete(scope);
    this.#scopePhaseCounts.delete(scope);
    this.#scopeTargets.delete(scope);
    if (this.#activeScope === scope) {
      this.#activeScope = void 0;
    }
  }
  #dispatchSchedulerPhaseToHandle(type, event) {
    let binding = this.#options.getBinding();
    if (!binding) return;
    if (!isBindingInUpdateScope(binding, event.parents)) return;
    for (let [, target] of this.#scopeTargets) {
      let updateEvent = new Event(type);
      updateEvent.node = binding.node;
      target.dispatchEvent(updateEvent);
    }
  }
  #getActiveScopeTarget() {
    let scope = this.#activeScope;
    invariant(scope);
    let target = this.#scopeTargets.get(scope);
    invariant(target);
    return target;
  }
  #getScopeSignal(scope) {
    let controller = this.#scopeSignals.get(scope);
    invariant(controller);
    return controller.signal;
  }
  #decrementGlobalPhaseCount(type, amount) {
    if (amount <= 0) return;
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - amount);
    if (this.#phaseListenerCounts[type] !== 0) return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.removeEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.removeEventListener("commit", this.#onSchedulerCommit);
    }
  }
};
function getMixinRuntimeSignal(state) {
  let controller = state.controller;
  if (!controller) {
    controller = new AbortController();
    if (state.aborted) {
      controller.abort();
    }
    state.controller = controller;
  }
  return controller.signal;
}
function dispatchMixinBeforeUpdate(state) {
  dispatchMixinUpdateEvent(state, "beforeUpdate");
}
function dispatchMixinCommit(state) {
  dispatchMixinUpdateEvent(state, "commit");
}
function dispatchMixinInsert(handle, scope, node, parent, key) {
  let event = new Event("insert");
  event.node = node;
  event.parent = parent;
  event.key = key;
  handle.dispatchScopedEvent(scope, event);
}
function dispatchMixinReclaimed(handle, scope, node, parent, key) {
  let event = new Event("reclaimed");
  event.node = node;
  event.parent = parent;
  event.key = key;
  handle.dispatchScopedEvent(scope, event);
}
function dispatchMixinBeforeRemove(handle, scope, persistNode) {
  let event = new Event("beforeRemove");
  event.persistNode = persistNode;
  handle.dispatchScopedEvent(scope, event);
}
function queueMixinInsert(handle, scope, node, parent, key) {
  handle.queueCommitTask(() => {
    dispatchMixinInsert(handle, scope, node, parent, key);
  });
}
function queueMixinReclaimed(handle, scope, node, parent, key) {
  handle.queueCommitTask(() => {
    dispatchMixinReclaimed(handle, scope, node, parent, key);
  });
}
function queueMixinRemove(handle, scope) {
  handle.queueCommitTask(() => {
    handle.dispatchScopedEvent(scope, new Event("remove"));
    handle.releaseScope(scope);
  });
}
function dispatchMixinRemoveEvent(state) {
  let runners = state?.runners;
  if (!runners?.length) return;
  let handle = state?.handle;
  if (!handle) return;
  for (let entry of runners) {
    handle.dispatchScopedEvent(entry.scope, new Event("remove"));
  }
}
function finalizeMixinTeardown(state) {
  dispatchMixinRemoveEvent(state);
  let handle = state.handle;
  if (handle) {
    for (let entry of state.runners) {
      handle.releaseScope(entry.scope);
    }
  }
  state.runners.length = 0;
  state.aborted = true;
  state.controller?.abort();
  state.pendingRemoval = void 0;
  state.removePrepared = true;
  state.handle = void 0;
}
function dispatchMixinUpdateEvent(state, type) {
  let node = state?.binding?.node;
  if (!node) return;
  let runners = state?.runners;
  if (!runners?.length) return;
  let handle = state?.handle;
  if (!handle) return;
  for (let entry of runners) {
    let event = new Event(type);
    event.node = node;
    handle.dispatchScopedEvent(entry.scope, event);
  }
}
function isSchedulerPhaseType(type) {
  return type === "beforeUpdate" || type === "commit";
}
function isBindingInUpdateScope(binding, parents) {
  if (parents.length === 0) return false;
  let node = binding.node;
  for (let parent of parents) {
    let parentNode = parent;
    if (parentNode === node) return true;
    if (parentNode.contains(node)) return true;
  }
  return false;
}
function resolveMixDescriptors(props) {
  let mix = props.mix;
  if (!mix) return [];
  if (Array.isArray(mix)) {
    if (mix.length === 0) return [];
    return mix.filter(Boolean);
  }
  return [mix];
}
function withoutMix(props) {
  if (!("mix" in props)) return props;
  let output = { ...props };
  delete output.mix;
  return output;
}
function withoutMixinTreeProps(props) {
  if (!("children" in props) && !("innerHTML" in props)) return props;
  let output = { ...props };
  delete output.children;
  delete output.innerHTML;
  return output;
}
function sanitizeReturnedMixinProps(props) {
  if (!("children" in props) && !("innerHTML" in props)) return props;
  console.error(new Error("mixins must not return children or innerHTML"));
  return withoutMixinTreeProps(props);
}
function composeMixinProps(previous, next) {
  return { ...previous, ...next };
}
function resolveReturnedMixDescriptors(value) {
  let descriptors = [];
  if (!collectReturnedMixDescriptors(value, descriptors)) {
    return null;
  }
  return descriptors;
}
function collectReturnedMixDescriptors(value, output) {
  if (!value) {
    return true;
  }
  if (Array.isArray(value)) {
    for (let item of value) {
      if (!collectReturnedMixDescriptors(item, output)) {
        return false;
      }
    }
    return true;
  }
  if (!isMixinDescriptor(value)) {
    return false;
  }
  output.push(value);
  return true;
}
function isRemixElement2(value) {
  if (!value || typeof value !== "object") return false;
  return value.$rmx === true;
}
function isMixinDescriptor(value) {
  if (!value || typeof value !== "object" || isRemixElement2(value)) {
    return false;
  }
  let descriptor = value;
  return typeof descriptor.type === "function" && Array.isArray(descriptor.args);
}
function isMixinElement(value) {
  if (typeof value !== "function") return false;
  return "__rmxMixinElementType" in value;
}
function normalizeMixinRunner(result, handle) {
  if (typeof result === "function" && !isMixinElement(result)) {
    return result;
  }
  if (result === void 0) {
    return () => handle.element;
  }
  return () => result;
}

// ../../../src/runtime/reconcile.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
var INSERT_VNODE = 1 << 0;
var MATCHED = 1 << 1;
var idCounter2 = 0;
var persistedRemovalToken = 0;
var persistedMixinNodes = /* @__PURE__ */ new Set();
var activeSchedulerUpdateParents;
function getSvgContext(vParent, nodeType) {
  if (typeof nodeType === "string") {
    if (nodeType === "svg") return true;
    if (nodeType === "foreignObject") return false;
  }
  return vParent._svg ?? false;
}
function getHostProps(node) {
  return node._mixedProps ?? node.props;
}
function markNodePersistedByMixins(node, domParent, token) {
  node._persistedByMixins = true;
  node._persistedParentByMixins = domParent;
  node._persistedRemovalToken = token;
  persistedMixinNodes.add(node);
  bindMixinRuntime(node._mixState, void 0);
}
function unmarkNodePersistedByMixins(node) {
  node._persistedByMixins = false;
  node._persistedParentByMixins = void 0;
  node._persistedRemovalToken = void 0;
  persistedMixinNodes.delete(node);
}
function findMatchingPersistedMixinNode(type, key, domParent) {
  if (key == null) return null;
  for (let node of persistedMixinNodes) {
    if (node._persistedParentByMixins !== domParent) continue;
    if (node.type !== type) continue;
    if (node.key !== key) continue;
    return node;
  }
  return null;
}
function shouldRestoreControlledReflectionOnInput(node, state) {
  if (state.hasControlledChecked) return false;
  if (node.type === "select") return false;
  return true;
}
function ensureControlledReflection(node, scheduler) {
  let existing = node._controlledState;
  if (existing) return existing;
  let state = {
    disposed: false,
    listenersAttached: false,
    pendingRestoreVersion: 0,
    managesValue: false,
    managesChecked: false,
    hasControlledValue: false,
    controlledValue: void 0,
    hasControlledChecked: false,
    controlledChecked: void 0,
    onInput: () => {
      if (!shouldRestoreControlledReflectionOnInput(node, state)) return;
      scheduleControlledRestore(node, state);
    },
    onChange: () => {
      scheduleControlledRestore(node, state);
    }
  };
  node._controlledState = state;
  scheduler.enqueueTasks([
    () => {
      if (state.disposed) return;
      node._dom.addEventListener("input", state.onInput);
      node._dom.addEventListener("change", state.onChange);
      state.listenersAttached = true;
    }
  ]);
  return state;
}
function syncControlledReflection(node, props) {
  let state = node._controlledState;
  if (!state || state.disposed) return;
  state.managesValue = canManageValue(node.type, node._dom);
  state.managesChecked = canReflectProperty(node._dom, "checked");
  state.hasControlledValue = state.managesValue && hasControlledValueProp(props);
  state.controlledValue = props.value;
  state.hasControlledChecked = state.managesChecked && hasControlledCheckedProp(props);
  state.controlledChecked = props.checked;
  state.pendingRestoreVersion++;
}
function shouldTrackControlledReflection(props) {
  return hasControlledValueProp(props) || hasControlledCheckedProp(props);
}
function scheduleControlledRestore(node, state) {
  if (state.disposed) return;
  let version = ++state.pendingRestoreVersion;
  queueMicrotask(() => {
    if (state.disposed) return;
    if (state.pendingRestoreVersion !== version) return;
    restoreControlledReflections(node, state);
  });
}
function restoreControlledReflections(node, state) {
  let element = node._dom;
  if (state.hasControlledValue && readDomProp(element, "value") !== state.controlledValue) {
    setPropertyReflection(element, "value", state.controlledValue);
  }
  if (state.hasControlledChecked && readDomProp(element, "checked") !== state.controlledChecked) {
    setPropertyReflection(element, "checked", state.controlledChecked);
  }
}
function teardownControlledReflection(node) {
  let state = node._controlledState;
  if (!state) return;
  state.disposed = true;
  state.pendingRestoreVersion++;
  if (state.listenersAttached) {
    node._dom.removeEventListener("input", state.onInput);
    node._dom.removeEventListener("change", state.onChange);
    state.listenersAttached = false;
  }
}
function canManageValue(type, element) {
  if (type === "progress") return false;
  return canReflectProperty(element, "value");
}
function hasControlledValueProp(props) {
  return "value" in props && props.value !== void 0;
}
function hasControlledCheckedProp(props) {
  return "checked" in props && props.checked !== void 0;
}
function canReflectProperty(element, key) {
  return key in element && !key.includes("-");
}
function readDomProp(element, key) {
  if (!canReflectProperty(element, key)) return void 0;
  return element[key];
}
function setPropertyReflection(element, key, value) {
  if (!canReflectProperty(element, key)) return;
  element[key] = value == null ? "" : value;
}
function resolveNodeMixProps(node, frame, scheduler, state) {
  let mix = node.props.mix;
  if (state == null && (mix == null || Array.isArray(mix) && mix.length === 0)) {
    node._mixState = void 0;
    node._mixedProps = node.props;
    return node.props;
  }
  let resolved = resolveMixedProps({
    hostType: node.type,
    frame,
    scheduler,
    getContext: (type) => {
      if (typeof type !== "function") {
        return void 0;
      }
      return findContextFromAncestry(node, type);
    },
    props: node.props,
    state
  });
  node._mixState = resolved.state;
  node._mixedProps = resolved.props;
  return resolved.props;
}
function enqueueMixinBindingUpdate(done) {
  let node = this.target;
  let state = node._mixState;
  this.scheduler.enqueueWork([
    () => {
      if (state?.aborted) {
        done(getMixinRuntimeSignal(state));
        return;
      }
      dispatchMixinBeforeUpdate(state);
      let prevProps = getHostProps(node);
      let nextProps = resolveNodeMixProps(node, this.frame, this.scheduler, state);
      diffHostProps(prevProps, nextProps, this.node);
      dispatchMixinCommit(state);
      done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort());
    }
  ]);
}
function bindNodeMixRuntime(node, frame, scheduler, styles, reclaimed = false, parent) {
  let state = node._mixState;
  bindMixinRuntime(
    state,
    {
      node: node._dom,
      parent: parent ?? node._dom.parentNode,
      key: node.key,
      target: node,
      frame,
      scheduler,
      enqueueUpdate: enqueueMixinBindingUpdate
    },
    { dispatchReclaimed: reclaimed }
  );
}
function isHeadHostNode(node) {
  if (node.type === "head") return true;
  if (node.type.length !== 4) return false;
  return node.type.toLowerCase() === "head";
}
function getDocumentHead(domParent) {
  if (domParent instanceof Document) {
    return domParent.head;
  }
  if (domParent instanceof Node) {
    return domParent.ownerDocument?.head ?? null;
  }
  return null;
}
function diffVNodes(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, rootCursor) {
  next._parent = vParent;
  next._svg = getSvgContext(vParent, next.type);
  if (curr === null) {
    return insert(
      next,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      rootCursor
    );
  }
  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
    return rootCursor;
  }
  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, vParent);
    return rootCursor;
  }
  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget);
    return rootCursor;
  }
  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, styles, domParent, vParent, rootTarget);
    return rootCursor;
  }
  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      void 0,
      anchor
    );
    return rootCursor;
  }
  if (curr.type === Frame && next.type === Frame) {
    diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor);
    return rootCursor;
  }
  invariant(false, "Unexpected diff case");
}
function replace(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor) {
  let currAnchor = findFirstDomAnchor(curr);
  if (currAnchor && currAnchor.parentNode === domParent) {
    let replacementAnchor2 = document.createComment("rmx:replace");
    domParent.insertBefore(replacementAnchor2, currAnchor);
    try {
      remove2(curr, domParent, scheduler, styles);
      insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replacementAnchor2);
    } finally {
      replacementAnchor2.parentNode?.removeChild(replacementAnchor2);
    }
    return;
  }
  let replacementAnchor = findNextSiblingDomAnchor(curr, vParent) ?? anchor;
  remove2(curr, domParent, scheduler, styles);
  insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replacementAnchor);
}
function diffHost(curr, next, frame, scheduler, styles, vParent, rootTarget) {
  let mixState = curr._mixState;
  let currProps = getHostProps(curr);
  let nextProps = resolveNodeMixProps(next, frame, scheduler, mixState);
  let nextMixState = next._mixState;
  let shouldDispatchMixinLifecycle = (nextMixState?.runners.length ?? 0) > 0 && shouldDispatchInlineMixinLifecycle(curr._dom);
  if (shouldDispatchMixinLifecycle) {
    dispatchMixinBeforeUpdate(nextMixState);
  }
  if (nextProps.innerHTML != null) {
    if (currProps.innerHTML !== nextProps.innerHTML) {
      curr._dom.innerHTML = nextProps.innerHTML;
    }
  } else if (currProps.innerHTML != null) {
    curr._dom.innerHTML = "";
  }
  diffChildren(
    curr._children,
    next._children,
    curr._dom,
    frame,
    scheduler,
    styles,
    next,
    rootTarget
  );
  diffHostProps(currProps, nextProps, curr._dom);
  next._dom = curr._dom;
  next._parent = vParent;
  next._controller = curr._controller;
  next._controlledState = curr._controlledState;
  if (next._controlledState || shouldTrackControlledReflection(nextProps)) {
    ensureControlledReflection(next, scheduler);
    syncControlledReflection(next, nextProps);
  }
  bindNodeMixRuntime(next, frame, scheduler, styles);
  if (shouldDispatchMixinLifecycle) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(nextMixState)]);
  }
  return;
}
function setupHostNode(node, dom, scheduler) {
  node._dom = dom;
  let props = getHostProps(node);
  let committedNode = node;
  if (shouldTrackControlledReflection(props)) {
    ensureControlledReflection(committedNode, scheduler);
    syncControlledReflection(committedNode, props);
  }
}
function diffText(curr, next, vParent) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text;
  }
  next._dom = curr._dom;
  next._parent = vParent;
}
function insert(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor) {
  node._parent = vParent;
  node._svg = getSvgContext(vParent, node.type);
  if (cursor && anchor && cursor === anchor) {
    cursor = null;
  }
  cursor = node.type === Frame ? skipCommentsExceptFrameStart(cursor ?? null) : skipComments(cursor ?? null);
  if (cursor && anchor && cursor === anchor) {
    cursor = null;
  }
  let doInsert = anchor ? (dom) => domParent.insertBefore(dom, anchor) : (dom) => domParent.appendChild(dom);
  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._parent = vParent;
      if (cursor.data !== node._text) {
        if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
          let remainder = cursor.splitText(node._text.length);
          node._dom = cursor;
          return remainder;
        }
        logHydrationMismatch("text mismatch", cursor.data, node._text);
        cursor.data = node._text;
      }
      node._dom = cursor;
      return cursor.nextSibling;
    }
    let dom = document.createTextNode(node._text);
    node._dom = dom;
    node._parent = vParent;
    doInsert(dom);
    return cursor;
  }
  if (isHostNode(node)) {
    let hostProps = resolveNodeMixProps(node, frame, scheduler);
    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent);
      if (targetHead) {
        let childCursor = cursor;
        if (cursor instanceof Element && cursor.tagName.toLowerCase() === "head") {
          childCursor = cursor.firstChild;
          let nextCursor = cursor.nextSibling;
          if (cursor !== targetHead) {
            while (cursor.firstChild) {
              targetHead.appendChild(cursor.firstChild);
            }
            cursor.remove();
          }
          cursor = nextCursor;
        }
        diffChildren(
          null,
          node._children,
          targetHead,
          frame,
          scheduler,
          styles,
          node,
          rootTarget,
          childCursor
        );
        diffHostProps({}, hostProps, targetHead);
        setupHostNode(node, targetHead, scheduler);
        bindNodeMixRuntime(node, frame, scheduler, styles);
        return cursor;
      }
    }
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent);
    if (persistedNode) {
      reclaimPersistedMixinNode(persistedNode, node, frame, scheduler, styles, vParent, rootTarget);
      return cursor;
    }
    if (cursor instanceof Element) {
      let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase();
      if (cursorTag === node.type) {
        let nextCursor = cursor.nextSibling;
        diffHostProps({}, hostProps, cursor);
        if (hostProps.innerHTML != null) {
          cursor.innerHTML = hostProps.innerHTML;
        } else {
          let childCursor = cursor.firstChild;
          diffChildren(
            null,
            node._children,
            cursor,
            frame,
            scheduler,
            styles,
            node,
            rootTarget,
            childCursor
          );
        }
        setupHostNode(node, cursor, scheduler);
        bindNodeMixRuntime(node, frame, scheduler, styles);
        return nextCursor;
      } else {
        let nextSibling = skipComments(cursor.nextSibling);
        if (nextSibling instanceof Element) {
          let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase();
          if (nextTag === node.type) {
            let nextCursor = nextSibling.nextSibling;
            diffHostProps({}, hostProps, nextSibling);
            if (hostProps.innerHTML != null) {
              nextSibling.innerHTML = hostProps.innerHTML;
            } else {
              let childCursor = nextSibling.firstChild;
              diffChildren(
                null,
                node._children,
                nextSibling,
                frame,
                scheduler,
                styles,
                node,
                rootTarget,
                childCursor
              );
            }
            setupHostNode(node, nextSibling, scheduler);
            bindNodeMixRuntime(node, frame, scheduler, styles);
            return nextCursor;
          }
        }
        logHydrationMismatch("tag", cursorTag, node.type);
        cursor = void 0;
      }
    }
    let dom = node._svg ? document.createElementNS(SVG_NS2, node.type) : document.createElement(node.type);
    diffHostProps({}, hostProps, dom);
    if (hostProps.innerHTML != null) {
      dom.innerHTML = hostProps.innerHTML;
    } else {
      diffChildren(null, node._children, dom, frame, scheduler, styles, node, rootTarget);
    }
    setupHostNode(node, dom, scheduler);
    bindNodeMixRuntime(node, frame, scheduler, styles, false, domParent);
    doInsert(dom);
    return cursor;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cursor = insert(
        child,
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor
      );
    }
    return cursor;
  }
  if (isComponentNode(node)) {
    return diffComponent(
      null,
      node,
      frame,
      scheduler,
      styles,
      domParent,
      vParent,
      rootTarget,
      anchor,
      cursor
    );
  }
  if (node.type === Frame) {
    return insertFrame(
      node,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      cursor
    );
  }
  invariant(false, "Unexpected node type");
}
function diffFrame(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, anchor) {
  let currSrc = getFrameSrc(curr);
  let nextSrc = getFrameSrc(next);
  let currName = getFrameName(curr);
  let nextName = getFrameName(next);
  if (currName !== nextName) {
    let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor;
    remove2(curr, domParent, scheduler, styles);
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor);
    return;
  }
  if (currSrc !== nextSrc && !curr._frameResolved) {
    let replaceAnchor = curr._rangeEnd?.nextSibling ?? anchor;
    remove2(curr, domParent, scheduler, styles);
    insert(next, domParent, frame, scheduler, styles, vParent, rootTarget, replaceAnchor);
    return;
  }
  next._rangeStart = curr._rangeStart;
  next._rangeEnd = curr._rangeEnd;
  next._frameInstance = curr._frameInstance;
  next._frameFallbackRoot = curr._frameFallbackRoot;
  next._frameResolveToken = curr._frameResolveToken;
  next._frameResolved = curr._frameResolved;
  next._parent = vParent;
  if (currSrc !== nextSrc) {
    let frameInstance = next._frameInstance;
    if (frameInstance) {
      frameInstance.handle.src = nextSrc;
    }
    let runtime = getFrameRuntime(frame);
    if (runtime) {
      resolveClientFrame(next, runtime);
    }
  }
  if (!next._frameResolved && next._frameFallbackRoot) {
    next._frameFallbackRoot.render(next.props?.fallback ?? null);
  }
}
function insertFrame(node, domParent, frame, scheduler, styles, vParent, rootTarget, anchor, cursor) {
  let runtime = getFrameRuntime(frame);
  if (!runtime || runtime.canResolveFrames === false) {
    throw new Error(
      "Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot."
    );
  }
  if (isFrameStartComment(cursor)) {
    let start2 = cursor;
    let end2 = findFrameEndComment(start2);
    if (end2) {
      node._rangeStart = start2;
      node._rangeEnd = end2;
      node._parent = vParent;
      node._frameResolveToken = 0;
      node._frameResolveController = void 0;
      node._frameFallbackRoot = void 0;
      node._frameResolved = true;
      let frameId = getFrameIdFromComment(start2);
      let marker = frameId ? runtime.data.f?.[frameId] : void 0;
      let src = marker?.src ?? getFrameSrc(node);
      let instance2 = runtime.frameInstances.get(start2);
      if (!instance2) {
        instance2 = createFrame([start2, end2], {
          name: getFrameName(node),
          src,
          marker: frameId && marker ? { ...marker, id: frameId } : void 0,
          errorTarget: runtime.errorTarget,
          loadModule: runtime.loadModule,
          resolveFrame: runtime.resolveFrame,
          pendingClientEntries: runtime.pendingClientEntries,
          scheduler: runtime.scheduler,
          data: runtime.data,
          moduleCache: runtime.moduleCache,
          moduleLoads: runtime.moduleLoads,
          frameInstances: runtime.frameInstances,
          namedFrames: runtime.namedFrames
        });
        runtime.frameInstances.set(start2, instance2);
      }
      node._frameInstance = instance2;
      return end2.nextSibling;
    }
  }
  let start = document.createComment(` rmx:f:${randomFrameId()} `);
  let end = document.createComment(" /rmx:f ");
  let doInsert = anchor ? (dom) => domParent.insertBefore(dom, anchor) : (dom) => domParent.appendChild(dom);
  doInsert(start);
  doInsert(end);
  node._rangeStart = start;
  node._rangeEnd = end;
  node._parent = vParent;
  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    styleManager: styles
  });
  fallbackRoot.render(node.props?.fallback ?? null);
  node._frameFallbackRoot = fallbackRoot;
  node._frameResolved = false;
  node._frameResolveToken = 0;
  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    errorTarget: runtime.errorTarget,
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    data: runtime.data,
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames
  });
  node._frameInstance = instance;
  runtime.frameInstances.set(start, instance);
  resolveClientFrame(node, runtime);
  return cursor;
}
function resolveClientFrame(node, runtime) {
  let frameSrc = getFrameSrc(node);
  let instance = node._frameInstance;
  if (!instance) return;
  let token = (node._frameResolveToken ?? 0) + 1;
  node._frameResolveToken = token;
  node._frameResolveController?.abort();
  let resolveController = new AbortController();
  node._frameResolveController = resolveController;
  Promise.resolve(runtime.resolveFrame(frameSrc, resolveController.signal)).then(async (content) => {
    if (node._frameResolveToken !== token || resolveController.signal.aborted) return;
    node._frameFallbackRoot?.dispose();
    node._frameFallbackRoot = void 0;
    let nextContent = asAbortableFrameContent(content, resolveController.signal);
    await instance.render(nextContent, { signal: resolveController.signal });
    if (node._frameResolveToken !== token || resolveController.signal.aborted) return;
    node._frameResolved = true;
  }).catch(() => {
  }).finally(() => {
    if (node._frameResolveController === resolveController) {
      node._frameResolveController = void 0;
    }
  });
}
function disposeFrameResources(node) {
  node._frameResolveToken = (node._frameResolveToken ?? 0) + 1;
  node._frameResolveController?.abort();
  node._frameResolveController = void 0;
  node._frameFallbackRoot?.dispose();
  node._frameFallbackRoot = void 0;
  let frameInstance = node._frameInstance;
  if (frameInstance) {
    frameInstance.dispose();
    node._frameInstance = void 0;
  }
}
function asAbortableFrameContent(content, signal) {
  if (!(content instanceof ReadableStream)) return content;
  return createAbortableReadableStream(content, signal);
}
function createAbortableReadableStream(source, signal) {
  let reader = source.getReader();
  let aborted = false;
  let onAbort = () => {
    aborted = true;
    void reader.cancel(signal.reason);
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  return new ReadableStream({
    async pull(controller) {
      if (aborted) {
        controller.close();
        return;
      }
      let removeAbortReadListener;
      let abortRead = new Promise((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: void 0 });
          return;
        }
        let onAbortRead = () => {
          resolve({ done: true, value: void 0 });
        };
        removeAbortReadListener = () => signal.removeEventListener("abort", onAbortRead);
        signal.addEventListener("abort", onAbortRead, { once: true });
      });
      let { done, value } = await Promise.race([reader.read(), abortRead]);
      removeAbortReadListener?.();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      signal.removeEventListener("abort", onAbort);
      return reader.cancel(reason);
    }
  });
}
function removeFrameDomRange(node, domParent) {
  let start = node._rangeStart;
  let end = node._rangeEnd;
  if (!(start instanceof Comment) || !(end instanceof Comment)) return;
  let cursor = start;
  while (cursor) {
    let nextSibling = cursor.nextSibling;
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor);
    }
    if (cursor === end) break;
    cursor = nextSibling;
  }
  node._rangeStart = void 0;
  node._rangeEnd = void 0;
}
function getFrameRuntime(frame) {
  return frame.$runtime;
}
function getFrameSrc(node) {
  let src = node.props?.src;
  invariant(typeof src === "string" && src.length > 0, "<Frame /> requires a src prop");
  return src;
}
function getFrameName(node) {
  let name2 = node.props?.name;
  return typeof name2 === "string" && name2.length > 0 ? name2 : void 0;
}
function randomFrameId() {
  return `f${crypto.randomUUID().slice(0, 8)}`;
}
function skipCommentsExceptFrameStart(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (isFrameStartComment(cursor)) return cursor;
    cursor = cursor.nextSibling;
  }
  return cursor;
}
function isFrameStartComment(node) {
  return node instanceof Comment && node.data.trim().startsWith("rmx:f:");
}
function isFrameEndComment(node) {
  return node instanceof Comment && node.data.trim() === "/rmx:f";
}
function getFrameIdFromComment(comment) {
  let text = comment.data.trim();
  if (!text.startsWith("rmx:f:")) return void 0;
  return text.slice("rmx:f:".length);
}
function findFrameEndComment(start) {
  let depth = 1;
  let node = start.nextSibling;
  while (node) {
    if (isFrameStartComment(node)) depth++;
    else if (isFrameEndComment(node)) {
      depth--;
      if (depth === 0) return node;
    }
    node = node.nextSibling;
  }
  return null;
}
function renderComponent(handle, currContent, next, domParent, frame, scheduler, styles, rootTarget, vParent, anchor, cursor) {
  let [element, tasks] = handle.render(next.props);
  let content = toVNode(element);
  let newCursor = diffVNodes(
    currContent,
    content,
    domParent,
    frame,
    scheduler,
    styles,
    next,
    rootTarget,
    anchor,
    cursor
  );
  next._content = content;
  next._handle = handle;
  next._parent = vParent;
  let committed = next;
  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent);
  });
  scheduler.enqueueTasks(tasks);
  return newCursor;
}
function diffComponent(curr, next, frame, scheduler, styles, domParent, vParent, rootTarget, anchor, cursor) {
  if (curr === null) {
    let componentId = vParent._pendingHydrationComponentId;
    if (componentId) {
      vParent._pendingHydrationComponentId = void 0;
    } else {
      componentId = `c${++idCounter2}`;
    }
    next._handle = createComponent({
      id: componentId,
      frame,
      type: next.type,
      getContext: (type) => findContextFromAncestry(vParent, type),
      getFrameByName(name2) {
        let runtime = getFrameRuntime(frame);
        return runtime?.namedFrames.get(name2);
      },
      getTopFrame() {
        let runtime = getFrameRuntime(frame);
        return runtime?.topFrame;
      }
    });
    return renderComponent(
      next._handle,
      null,
      next,
      domParent,
      frame,
      scheduler,
      styles,
      rootTarget,
      vParent,
      anchor,
      cursor
    );
  }
  next._handle = curr._handle;
  let { _content, _handle } = curr;
  return renderComponent(
    _handle,
    _content,
    next,
    domParent,
    frame,
    scheduler,
    styles,
    rootTarget,
    vParent,
    anchor,
    cursor
  );
}
function cleanupDescendants(node, scheduler, styles) {
  if (isCommittedTextNode(node)) {
    return;
  }
  if (isCommittedHostNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles);
    }
    teardownMixins(node._mixState);
    teardownControlledReflection(node);
    if (node._controller) node._controller.abort();
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, scheduler, styles);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (node.type === Frame) {
    disposeFrameResources(node);
    return;
  }
}
function remove2(node, domParent, scheduler, styles) {
  if (isCommittedTextNode(node)) {
    node._dom.parentNode?.removeChild(node._dom);
    return;
  }
  if (isCommittedHostNode(node)) {
    if (node._persistedByMixins) return;
    let persistedRemoval = prepareMixinRemoval(node._mixState);
    if (persistedRemoval) {
      let token = ++persistedRemovalToken;
      markNodePersistedByMixins(node, domParent, token);
      void persistedRemoval.catch(() => {
      }).finally(() => {
        if (!node._persistedByMixins) return;
        if (node._persistedRemovalToken !== token) return;
        unmarkNodePersistedByMixins(node);
        performHostNodeRemoval(node, domParent, scheduler, styles);
      });
      return;
    }
    performHostNodeRemoval(node, domParent, scheduler, styles);
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove2(child, domParent, scheduler, styles);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    remove2(node._content, domParent, scheduler, styles);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (node.type === Frame) {
    disposeFrameResources(node);
    removeFrameDomRange(node, domParent);
    return;
  }
}
function performHostNodeRemoval(node, domParent, scheduler, styles) {
  if (isHeadHostNode(node)) {
    for (let child of node._children) {
      remove2(child, node._dom, scheduler, styles);
    }
  } else {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler, styles);
    }
  }
  teardownMixins(node._mixState);
  teardownControlledReflection(node);
  if (!isHeadHostNode(node)) {
    node._dom.parentNode?.removeChild(node._dom);
  }
  if (node._controller) node._controller.abort();
}
function diffChildren(curr, next, domParent, frame, scheduler, styles, vParent, rootTarget, cursor, anchor) {
  let nextLength = next.length;
  let hasKeys = false;
  let seenKeys;
  let duplicateKeys;
  for (let i = 0; i < nextLength; i++) {
    let node = next[i];
    if (node && node.key != null) {
      hasKeys = true;
      if (!seenKeys) {
        seenKeys = /* @__PURE__ */ new Set([node.key]);
        continue;
      }
      if (seenKeys.has(node.key)) {
        if (!duplicateKeys) {
          duplicateKeys = /* @__PURE__ */ new Set();
        }
        duplicateKeys.add(node.key);
      } else {
        seenKeys.add(node.key);
      }
    }
  }
  if (duplicateKeys?.size) {
    let quotedKeys = Array.from(duplicateKeys, (key) => `"${key}"`);
    console.warn(
      `Duplicate keys detected in siblings: ${quotedKeys.join(", ")}. Keys should be unique.`
    );
  }
  if (curr === null) {
    for (let node of next) {
      cursor = insert(
        node,
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor
      );
    }
    vParent._children = next;
    return cursor;
  }
  let currLength = curr.length;
  if (!hasKeys) {
    for (let i = 0; i < nextLength; i++) {
      let currentNode = i < currLength ? curr[i] : null;
      diffVNodes(
        currentNode,
        next[i],
        domParent,
        frame,
        scheduler,
        styles,
        vParent,
        rootTarget,
        anchor,
        cursor
      );
    }
    if (currLength > nextLength) {
      for (let i = nextLength; i < currLength; i++) {
        let node = curr[i];
        if (node) remove2(node, domParent, scheduler, styles);
      }
    }
    vParent._children = next;
    return;
  }
  if (currLength === nextLength) {
    let canDiffByPosition = true;
    for (let i = 0; i < nextLength; i++) {
      let currentNode = curr[i];
      let nextNode = next[i];
      if (!currentNode || currentNode.key !== nextNode.key || currentNode.type !== nextNode.type) {
        canDiffByPosition = false;
        break;
      }
    }
    if (canDiffByPosition) {
      for (let i = 0; i < nextLength; i++) {
        diffVNodes(
          curr[i],
          next[i],
          domParent,
          frame,
          scheduler,
          styles,
          vParent,
          rootTarget,
          anchor,
          cursor
        );
      }
      vParent._children = next;
      return;
    }
  }
  let oldChildren = curr;
  let oldChildrenLength = currLength;
  let remainingOldChildren = oldChildrenLength;
  let oldKeyMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < oldChildrenLength; i++) {
    let c = oldChildren[i];
    if (c) {
      c._flags = 0;
      if (c.key != null) {
        oldKeyMap.set(c.key, i);
      }
    }
  }
  let skew = 0;
  let newChildren = new Array(nextLength);
  for (let i = 0; i < nextLength; i++) {
    let childVNode = next[i];
    if (!childVNode) {
      newChildren[i] = childVNode;
      continue;
    }
    newChildren[i] = childVNode;
    childVNode._parent = vParent;
    let skewedIndex = i + skew;
    let matchingIndex = -1;
    let key = childVNode.key;
    let type = childVNode.type;
    if (key != null) {
      let mapIndex = oldKeyMap.get(key);
      if (mapIndex !== void 0) {
        let candidate = oldChildren[mapIndex];
        let candidateFlags = candidate?._flags ?? 0;
        if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
          matchingIndex = mapIndex;
        }
      }
    } else {
      let searchVNode = oldChildren[skewedIndex];
      let searchFlags = searchVNode?._flags ?? 0;
      let available = searchVNode != null && (searchFlags & MATCHED) === 0;
      if (available && searchVNode.key == null && type === searchVNode.type) {
        matchingIndex = skewedIndex;
      }
    }
    childVNode._index = matchingIndex;
    let matchedOldVNode = null;
    if (matchingIndex !== -1) {
      matchedOldVNode = oldChildren[matchingIndex];
      remainingOldChildren--;
      if (matchedOldVNode) {
        matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED;
      }
    }
    let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode);
    let isMounting = !matchedOldVNode || !oldDom;
    if (isMounting) {
      if (matchingIndex === -1) {
        if (nextLength > oldChildrenLength) {
          skew--;
        } else if (nextLength < oldChildrenLength) {
          skew++;
        }
      }
      childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
    } else if (matchingIndex !== i + skew) {
      if (matchingIndex === i + skew - 1) {
        skew--;
      } else if (matchingIndex === i + skew + 1) {
        skew++;
      } else {
        if (matchingIndex > i + skew) skew--;
        else skew++;
        childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
      }
    }
  }
  if (remainingOldChildren) {
    for (let i = 0; i < oldChildrenLength; i++) {
      let oldVNode = oldChildren[i];
      if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
        remove2(oldVNode, domParent, scheduler, styles);
      }
    }
  }
  vParent._children = newChildren;
  let lastPlaced = null;
  for (let i = 0; i < nextLength; i++) {
    let childVNode = newChildren[i];
    if (!childVNode) continue;
    let idx = childVNode._index ?? -1;
    let oldVNode = idx >= 0 ? oldChildren[idx] : null;
    diffVNodes(
      oldVNode,
      childVNode,
      domParent,
      frame,
      scheduler,
      styles,
      vParent,
      rootTarget,
      anchor,
      cursor
    );
    let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE;
    let firstDom = findFirstDomAnchor(childVNode);
    let lastDom = firstDom ? findLastDomAnchor(childVNode) : null;
    if (shouldPlace && firstDom && lastDom && firstDom.parentNode === domParent) {
      let target;
      if (lastPlaced === null) {
        if (vParent._rangeStart && vParent._rangeStart.parentNode === domParent) {
          target = vParent._rangeStart.nextSibling;
        } else {
          target = domParent.firstChild;
        }
      } else {
        target = lastPlaced.nextSibling;
      }
      if (target === null && anchor) target = anchor;
      if (target && domRangeContainsNode(firstDom, lastDom, target)) {
      } else if (firstDom !== target) {
        moveDomRange(domParent, firstDom, lastDom, target);
      }
    }
    if (lastDom) lastPlaced = lastDom;
    childVNode._flags = 0;
    childVNode._index = void 0;
  }
  return;
}
function findFirstDomAnchor(node) {
  if (!node) return null;
  if (isCommittedTextNode(node)) return node._dom;
  if (isCommittedHostNode(node)) return node._dom;
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content);
  if (node.type === Frame) return node._rangeStart ?? null;
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child);
      if (dom) return dom;
    }
  }
  return null;
}
function findLastDomAnchor(node) {
  if (!node) return null;
  if (isCommittedTextNode(node)) return node._dom;
  if (isCommittedHostNode(node)) return node._dom;
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content);
  if (node.type === Frame) return node._rangeEnd ?? null;
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i]);
      if (dom) return dom;
    }
  }
  return null;
}
function domRangeContainsNode(first, last, node) {
  let current = first;
  while (current) {
    if (current === node) return true;
    if (current === last) break;
    current = current.nextSibling;
  }
  return false;
}
function moveDomRange(domParent, first, last, before) {
  let current = first;
  while (current) {
    let next = current === last ? null : current.nextSibling;
    domParent.insertBefore(current, before);
    if (current === last) break;
    current = next;
  }
}
function setActiveSchedulerUpdateParents(parents) {
  activeSchedulerUpdateParents = parents;
}
function shouldDispatchInlineMixinLifecycle(node) {
  let parents = activeSchedulerUpdateParents;
  if (!parents?.length) return true;
  for (let parent of parents) {
    let parentNode = parent;
    if (parentNode === node) return false;
    if (parentNode.contains(node)) return false;
  }
  return true;
}
function findNextSiblingDomAnchor(curr, vParent) {
  if (!vParent || !Array.isArray(vParent._children)) return null;
  let children = vParent._children;
  let idx = children.indexOf(curr);
  if (idx === -1) return null;
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i]);
    if (dom) return dom;
  }
  return null;
}
function reclaimPersistedMixinNode(persistedNode, newNode, frame, scheduler, styles, vParent, rootTarget) {
  cancelPendingMixinRemoval(persistedNode._mixState);
  unmarkNodePersistedByMixins(persistedNode);
  newNode._dom = persistedNode._dom;
  newNode._parent = vParent;
  newNode._controller = persistedNode._controller;
  newNode._mixState = persistedNode._mixState;
  newNode._controlledState = persistedNode._controlledState;
  let prevProps = getHostProps(persistedNode);
  let nextProps = resolveNodeMixProps(
    newNode,
    frame,
    scheduler,
    newNode._mixState
  );
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    dispatchMixinBeforeUpdate(newNode._mixState);
  }
  diffHostProps(prevProps, nextProps, persistedNode._dom);
  ensureControlledReflection(newNode, scheduler);
  syncControlledReflection(newNode, nextProps);
  diffChildren(
    persistedNode._children,
    newNode._children,
    persistedNode._dom,
    frame,
    scheduler,
    styles,
    newNode,
    rootTarget
  );
  bindNodeMixRuntime(newNode, frame, scheduler, styles, true);
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    scheduler.enqueueCommitPhase([
      () => dispatchMixinCommit(newNode._mixState)
    ]);
  }
}

// ../../../src/runtime/scheduler.ts
var MAX_CASCADING_UPDATES = 50;
function createScheduler(doc, rootTarget, styles = defaultStyleManager) {
  let documentState = createDocumentState(doc);
  let scheduled = /* @__PURE__ */ new Map();
  let workTasks = [];
  let commitPhaseTasks = [];
  let postCommitTasks = [];
  let flushScheduled = false;
  let flushing = false;
  let cascadingUpdateCount = 0;
  let resetScheduled = false;
  let phaseEvents = new EventTarget();
  let phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  let scheduler;
  function dispatchError(error) {
    console.error(error);
    rootTarget.dispatchEvent(createComponentErrorEvent(error));
  }
  function scheduleCounterReset() {
    if (resetScheduled) return;
    resetScheduled = true;
    setTimeout(() => {
      cascadingUpdateCount = 0;
      resetScheduled = false;
    }, 0);
  }
  function getFrameStyleManager(vnode) {
    let runtime = vnode._handle?.frame.$runtime;
    return runtime?.styleManager ?? styles;
  }
  function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (true) {
        flushScheduled = false;
        let batch = new Map(scheduled);
        scheduled.clear();
        let hasWork = batch.size > 0 || workTasks.length > 0 || commitPhaseTasks.length > 0 || postCommitTasks.length > 0;
        if (!hasWork) return;
        cascadingUpdateCount++;
        scheduleCounterReset();
        if (cascadingUpdateCount > MAX_CASCADING_UPDATES) {
          let error = new Error("handle.update() infinite loop detected");
          dispatchError(error);
          return;
        }
        documentState.capture();
        let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : [];
        setActiveSchedulerUpdateParents(updateParents);
        dispatchPhaseEvent("beforeUpdate", updateParents);
        if (batch.size > 0) {
          let vnodes = Array.from(batch);
          let noScheduledAncestor = /* @__PURE__ */ new Set();
          for (let [vnode, domParent] of vnodes) {
            if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue;
            let handle = vnode._handle;
            let curr = vnode._content;
            let vParent = vnode._parent;
            let anchor = findNextSiblingDomAnchor(vnode, vParent) || void 0;
            try {
              let updateStyles = getFrameStyleManager(vnode);
              renderComponent(
                handle,
                curr,
                vnode,
                domParent,
                handle.frame,
                scheduler,
                updateStyles,
                rootTarget,
                vParent,
                anchor
              );
            } catch (error) {
              dispatchError(error);
            }
          }
        }
        flushTaskQueue(workTasks);
        setActiveSchedulerUpdateParents(void 0);
        documentState.restore();
        flushTaskQueue(commitPhaseTasks);
        dispatchPhaseEvent("commit", updateParents);
        flushTaskQueue(postCommitTasks);
      }
    } finally {
      setActiveSchedulerUpdateParents(void 0);
      flushing = false;
    }
  }
  function dispatchPhaseEvent(type, parents) {
    if (phaseListenerCounts[type] === 0) return;
    let event = new Event(type);
    event.parents = parents;
    phaseEvents.dispatchEvent(event);
  }
  function flushTaskQueue(queue) {
    while (queue.length > 0) {
      let task = queue.shift();
      if (!task) continue;
      try {
        task();
      } catch (error) {
        dispatchError(error);
      }
    }
  }
  function scheduleFlush() {
    if (flushScheduled || flushing) return;
    flushScheduled = true;
    queueMicrotask(flush);
  }
  function ancestorIsScheduled(vnode, batch, safe) {
    let path = [];
    let current = vnode._parent;
    while (current) {
      if (safe.has(current)) {
        for (let node of path) safe.add(node);
        return false;
      }
      path.push(current);
      if (isCommittedComponentNode(current) && batch.has(current)) {
        return true;
      }
      current = current._parent;
    }
    for (let node of path) safe.add(node);
    return false;
  }
  scheduler = {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent);
      scheduleFlush();
    },
    enqueueWork(newTasks) {
      workTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueCommitPhase(newTasks) {
      commitPhaseTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueTasks(newTasks) {
      postCommitTasks.push(...newTasks);
      scheduleFlush();
    },
    addEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type]++;
      phaseEvents.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type] = Math.max(0, phaseListenerCounts[type] - 1);
      phaseEvents.removeEventListener(type, listener, options);
    },
    dequeue() {
      flush();
    }
  };
  return scheduler;
}

// ../../../src/runtime/vdom.ts
function getHydrationComponentIdFromRangeStart(start) {
  if (!(start instanceof Comment)) return void 0;
  let marker = start.data.trim();
  if (!marker.startsWith("rmx:h:")) return void 0;
  let id = marker.slice("rmx:h:".length);
  return id.length > 0 ? id : void 0;
}
function createRangeRoot(boundaries, options = {}) {
  let [start, end] = boundaries;
  let vroot = null;
  let styles = options.styleManager ?? defaultStyleManager;
  let container = end.parentNode;
  invariant(container, "Expected parent node");
  invariant(start.parentNode === container, "Boundaries must share parent");
  let parent = container;
  let hydrationCursor = start.nextSibling;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget, styles);
  let frameStub = options.frame ?? createRootFrameHandle({
    src: options.frameInit?.src,
    resolveFrame: options.frameInit?.resolveFrame,
    loadModule: options.frameInit?.loadModule,
    errorTarget: eventTarget,
    scheduler,
    styleManager: styles
  });
  let isErrorForwardingAttached = false;
  function forwardDomError(event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached) return;
    parent.addEventListener("error", forwardDomError);
    isErrorForwardingAttached = true;
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return;
    parent.removeEventListener("error", forwardDomError);
    isErrorForwardingAttached = false;
  }
  attachDomErrorForwarding();
  return Object.assign(eventTarget, {
    render(element) {
      attachDomErrorForwarding();
      let vnode = toVNode(element);
      let vParent = {
        type: ROOT_VNODE,
        _svg: false,
        _rangeStart: start,
        _rangeEnd: end,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start)
      };
      scheduler.enqueueWork([
        () => {
          diffVNodes(
            vroot,
            vnode,
            parent,
            frameStub,
            scheduler,
            styles,
            vParent,
            eventTarget,
            end,
            hydrationCursor
          );
          vroot = vnode;
          hydrationCursor = null;
        }
      ]);
      scheduler.dequeue();
    },
    dispose() {
      detachDomErrorForwarding();
      if (!vroot) return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueWork([() => remove2(current, parent, scheduler, styles)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
}
function createRoot(container, options = {}) {
  let vroot = null;
  let styles = options.styleManager ?? defaultStyleManager;
  let hydrationCursor = container.innerHTML.trim() !== "" ? container.firstChild : void 0;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles);
  let frameStub = options.frame ?? createRootFrameHandle({
    src: options.frameInit?.src,
    resolveFrame: options.frameInit?.resolveFrame,
    loadModule: options.frameInit?.loadModule,
    errorTarget: eventTarget,
    scheduler,
    styleManager: styles
  });
  let isErrorForwardingAttached = false;
  function forwardDomError(event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached) return;
    container.addEventListener("error", forwardDomError);
    isErrorForwardingAttached = true;
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return;
    container.removeEventListener("error", forwardDomError);
    isErrorForwardingAttached = false;
  }
  attachDomErrorForwarding();
  return Object.assign(eventTarget, {
    render(element) {
      attachDomErrorForwarding();
      let vnode = toVNode(element);
      let vParent = { type: ROOT_VNODE, _svg: false };
      scheduler.enqueueWork([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            styles,
            vParent,
            eventTarget,
            void 0,
            hydrationCursor
          );
          vroot = vnode;
          hydrationCursor = void 0;
        }
      ]);
      scheduler.dequeue();
    },
    dispose() {
      detachDomErrorForwarding();
      if (!vroot) return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueWork([() => remove2(current, container, scheduler, styles)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
}
function createRootFrameHandle(init) {
  let resolveFrame = init.resolveFrame ?? (() => {
    throw new Error(
      "Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot."
    );
  });
  let frame = createFrameHandle({
    src: init.src ?? "/",
    $runtime: {
      canResolveFrames: !!init.resolveFrame,
      topFrame: void 0,
      loadModule: init.loadModule ?? (() => {
        throw new Error("loadModule is required to hydrate client entries inside <Frame />");
      }),
      resolveFrame,
      errorTarget: init.errorTarget,
      pendingClientEntries: /* @__PURE__ */ new Map(),
      scheduler: init.scheduler,
      styleManager: init.styleManager,
      data: {},
      moduleCache: /* @__PURE__ */ new Map(),
      moduleLoads: /* @__PURE__ */ new Map(),
      frameInstances: /* @__PURE__ */ new WeakMap(),
      namedFrames: /* @__PURE__ */ new Map()
    }
  });
  let runtime = frame.$runtime;
  if (runtime) runtime.topFrame = frame;
  return frame;
}

// ../../../src/runtime/diff-dom.ts
function diffNodes(curr, next, context) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null;
  invariant(parent, "Parent node not found");
  let regionTailRef = context.regionTailRef ?? (curr.length > 0 ? curr[curr.length - 1].nextSibling : null);
  let max = Math.max(curr.length, next.length);
  for (let i = 0; i < max; i++) {
    let c = curr[i];
    let n = next[i];
    if (!c && n) {
      if (regionTailRef) {
        parent.insertBefore(n, regionTailRef);
      } else {
        parent.appendChild(n);
      }
    } else if (c && !n) {
      disposeRemovedSubFrames(c, context);
      parent.removeChild(c);
    } else if (c && n) {
      if (isVirtualRootStartMarker(c) && isVirtualRootStartMarker(n)) {
        let currentEnd = findHydrationEndMarker(c);
        let nextEnd = findHydrationEndMarker(n);
        let nextData = n.data;
        if (c.data !== nextData) c.data = nextData;
        let currentEndIndex = curr.indexOf(currentEnd);
        let nextEndIndex = next.indexOf(nextEnd);
        i = Math.max(currentEndIndex, nextEndIndex);
        continue;
      }
      let cursor = diffNode(c, n, context);
      if (cursor) {
        i = next.indexOf(cursor);
      }
    }
  }
}
function diffNode(current, next, context) {
  if (isTextNode2(current) && isTextNode2(next)) {
    let newText = next.textContent || "";
    if (current.textContent !== newText) current.textContent = newText;
    return;
  }
  if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next)) {
    let nextData = next.data;
    if (current.data !== nextData) {
      current.data = nextData;
    }
    let end = findHydrationEndMarker(next);
    return end;
  }
  if (isCommentNode(current) && isCommentNode(next)) {
    let newData = next.data;
    if (current.data !== newData) current.data = newData;
    return;
  }
  if (isElement(current) && isElement(next)) {
    if (current.tagName !== next.tagName) {
      let parent2 = current.parentNode;
      if (parent2) parent2.replaceChild(next, current);
      return;
    }
    diffElementAttributes(current, next);
    if (shouldPreserveElementChildren(current, next)) return;
    diffElementChildren(current, next, context);
    return;
  }
  let parent = current.parentNode;
  if (parent) parent.replaceChild(next, current);
}
function diffElementAttributes(current, next) {
  let prevAttrNames = current.getAttributeNames();
  let nextAttrNames = next.getAttributeNames();
  let nextNameSet = new Set(nextAttrNames);
  for (let name2 of prevAttrNames) {
    if (!nextNameSet.has(name2)) {
      if (shouldPreserveLiveAttribute(current, next, name2)) continue;
      current.removeAttribute(name2);
    }
  }
  for (let name2 of nextAttrNames) {
    let prevVal = current.getAttribute(name2);
    let nextVal = next.getAttribute(name2);
    if (prevVal !== nextVal) {
      if (shouldPreserveLiveAttribute(current, next, name2)) continue;
      current.setAttribute(name2, nextVal == null ? "" : String(nextVal));
    }
  }
}
function shouldPreserveLiveAttribute(current, next, name2) {
  if (name2 === "open") {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
      return current.open !== next.open;
    }
    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
      return current.open !== next.open;
    }
  }
  if (name2 === "checked") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
      return current.checked !== next.checked;
    }
  }
  if (name2 === "value") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement && shouldPreserveInputValue(current)) {
      return current.value !== next.value;
    }
  }
  if (name2 === "selected") {
    if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
      return current.selected !== next.selected;
    }
  }
  if (name2 === "popover") {
    return isPopoverOpen(current) !== isPopoverOpen(next);
  }
  return false;
}
function shouldPreserveElementChildren(current, next) {
  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    return current.value !== next.value;
  }
  return false;
}
function shouldPreserveInputValue(input) {
  return input.type !== "button" && input.type !== "checkbox" && input.type !== "hidden" && input.type !== "image" && input.type !== "radio" && input.type !== "reset" && input.type !== "submit";
}
function isPopoverOpen(element) {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}
function diffElementChildren(current, next, context) {
  let currentChildren = Array.from(current.childNodes);
  let nextChildren = Array.from(next.childNodes);
  let keyToIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < currentChildren.length; i++) {
    let node = currentChildren[i];
    if (isElement(node)) {
      let key = node.getAttribute("data-key");
      if (key != null) keyToIndex.set(key, i);
    }
  }
  let used = new Array(currentChildren.length).fill(false);
  let matchIndexForNext = new Array(nextChildren.length).fill(-1);
  for (let i = 0; i < nextChildren.length; i++) {
    let nextChild = nextChildren[i];
    let matchIndex = -1;
    if (isElement(nextChild)) {
      let key = nextChild.getAttribute("data-key");
      if (key != null && keyToIndex.has(key)) {
        let idx = keyToIndex.get(key);
        if (!used[idx]) matchIndex = idx;
      }
    }
    if (matchIndex === -1) {
      let candidateIndex = i;
      if (candidateIndex < currentChildren.length && !used[candidateIndex] && nodeTypesComparable(currentChildren[candidateIndex], nextChild)) {
        matchIndex = candidateIndex;
      }
    }
    if (matchIndex !== -1) used[matchIndex] = true;
    matchIndexForNext[i] = matchIndex;
  }
  let committed = new Array(nextChildren.length);
  for (let i = 0; i < nextChildren.length; i++) {
    let mi = matchIndexForNext[i];
    if (mi !== -1) {
      let curChild = currentChildren[mi];
      let cursor = diffNode(curChild, nextChildren[i], context);
      if (cursor) {
        let nextEndIdx = nextChildren.indexOf(cursor);
        let currEndIdx = findHydrationEndIndex(currentChildren, mi);
        for (let j = i + 1; j <= nextEndIdx; j++) {
          let matchedIndex = matchIndexForNext[j];
          if (matchedIndex > currEndIdx) {
            used[matchedIndex] = false;
          }
          matchIndexForNext[j] = -1;
        }
        for (let k = mi; k <= currEndIdx; k++) used[k] = true;
        committed[i] = curChild;
        committed[nextEndIdx] = currentChildren[currEndIdx];
        for (let j = i + 1; j < nextEndIdx; j++) committed[j] = void 0;
        i = nextEndIdx;
        continue;
      }
      committed[i] = curChild;
    } else {
      committed[i] = nextChildren[i];
    }
  }
  let anchor = void 0;
  for (let i = committed.length - 1; i >= 0; i--) {
    let node = committed[i];
    if (!node) continue;
    let ref = anchor && anchor.parentNode === current ? anchor : null;
    if (isVirtualRootStartMarker(node) || isVirtualRootEndMarker(node)) {
      if (node.parentNode !== current) {
        current.insertBefore(node, ref);
      }
      anchor = node;
      continue;
    }
    if (node.parentNode === current) {
      let targetNext = ref;
      let alreadyInPlace = targetNext === null && node.nextSibling === null || node.nextSibling === targetNext;
      if (!alreadyInPlace) {
        current.insertBefore(node, targetNext);
      }
    } else {
      current.insertBefore(node, ref);
    }
    if (node.parentNode === current) {
      anchor = node;
    }
  }
  for (let i = 0; i < currentChildren.length; i++) {
    if (!used[i]) {
      let nodeToRemove = currentChildren[i];
      disposeRemovedSubFrames(nodeToRemove, context);
      current.removeChild(currentChildren[i]);
    }
  }
}
function nodeTypesComparable(a, b) {
  if (isTextNode2(a) && isTextNode2(b)) return true;
  if (isElement(a) && isElement(b)) return a.tagName === b.tagName;
  if (isVirtualRootStartMarker(a) && isVirtualRootStartMarker(b)) return true;
  if (isVirtualRootEndMarker(a) && isVirtualRootEndMarker(b)) return true;
  if (isCommentNode(a) && isCommentNode(b)) return true;
  return false;
}
function isHydrationEndComment(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:h";
}
function findHydrationEndMarker(start) {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (isCommentNode(node)) {
      if (isVirtualRootStartMarker(node)) depth++;
      if (isVirtualRootEndMarker(node)) {
        depth--;
        if (depth === 0) return node;
      }
    }
    node = node.nextSibling;
  }
  throw new Error("Hydration end marker not found");
}
function findHydrationEndIndex(nodes, startIdx) {
  for (let j = startIdx + 1; j < nodes.length; j++) {
    if (isHydrationEndComment(nodes[j])) return j;
  }
  return startIdx;
}
function isTextNode2(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isCommentNode(node) {
  return node.nodeType === Node.COMMENT_NODE;
}
function isFrameStartMarker(node) {
  return node instanceof Comment && node.data.trim().startsWith("rmx:f:");
}
function disposeRemovedSubFrames(node, context) {
  let stack = [node];
  while (stack.length > 0) {
    let next = stack.pop();
    if (!next) continue;
    if (isFrameStartMarker(next)) {
      let subFrame = context.frameInstances.get(next);
      if (subFrame) {
        subFrame.dispose();
        context.frameInstances.delete(next);
      }
    }
    for (let child of Array.from(next.childNodes)) {
      stack.push(child);
    }
  }
}
function isVirtualRootStartMarker(node) {
  return isCommentNode(node) && node.data.trim().startsWith("rmx:h:");
}
function isVirtualRootEndMarker(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:h";
}

// ../../../src/runtime/frame.ts
var bufferedFrameTemplates = /* @__PURE__ */ new Map();
var frameTemplateListeners = /* @__PURE__ */ new Map();
var DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi;
function stripDoctypeMarkup(html) {
  return html.replace(DOCTYPE_PATTERN, "");
}
function syncElementAttributes(target, source) {
  for (let attribute of Array.from(target.attributes)) {
    if (!source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name);
    }
  }
  for (let attribute of Array.from(source.attributes)) {
    if (target.getAttribute(attribute.name) !== attribute.value) {
      target.setAttribute(attribute.name, attribute.value);
    }
  }
}
function createFrame(root2, init) {
  let container = createContainer(root2);
  let observers = [];
  let subscriptions = [];
  let contentRoot;
  let reloadController;
  let styleManager = init.styleManager ?? createStyleManager();
  mergeRmxDataFromDocument(init.data, container.doc);
  let runtime = createFrameRuntime({ ...init, styleManager });
  let frame = createFrameHandle({
    src: init.src,
    $runtime: runtime,
    reload: async () => {
      reloadController?.abort();
      let controller = new AbortController();
      reloadController = controller;
      frame.dispatchEvent(new Event("reloadStart"));
      try {
        let content = await init.resolveFrame(frame.src, controller.signal, frameName);
        if (reloadController !== controller || controller.signal.aborted) return controller.signal;
        await render(content, { signal: controller.signal });
        return controller.signal;
      } catch (error) {
        if (reloadController !== controller || controller.signal.aborted) return controller.signal;
        init.errorTarget.dispatchEvent(createComponentErrorEvent(error));
        throw error;
      } finally {
        if (reloadController === controller) {
          frame.dispatchEvent(new Event("reloadComplete"));
        }
      }
    },
    replace: async (content) => {
      await render(content);
    }
  });
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame;
  let frameName = init.marker?.name ?? init.name;
  if (frameName) {
    init.namedFrames.set(frameName, frame);
  }
  let context = {
    topFrame: runtime.topFrame,
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    frame,
    styleManager,
    data: init.data,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent
  };
  async function render(content, options) {
    if (options?.signal?.aborted) return;
    if (content instanceof ReadableStream) {
      await renderFrameStream(content, container.doc, async (html) => {
        if (options?.signal?.aborted) return;
        await render(html, options);
      });
      return;
    }
    if (isRemixNodeFrameContent(content)) {
      if (!contentRoot) {
        let currentNodes = getContentNodes();
        removeVirtualRoots(currentNodes);
        disposeSubFrames(currentNodes, context);
        clearFrameContent();
        contentRoot = createFrameContentRoot();
      }
      if (options?.signal?.aborted) return;
      contentRoot.render(content);
      return;
    }
    if (contentRoot) {
      contentRoot.dispose();
      contentRoot = void 0;
    }
    let htmlContent = typeof content === "string" ? stripDoctypeMarkup(content) : void 0;
    let isFullDocumentReload = container.root instanceof Document && htmlContent !== void 0 && isFullDocumentHtml(htmlContent);
    if (isFullDocumentReload && htmlContent !== void 0) {
      let previousBodyNodes = Array.from(container.doc.body.childNodes);
      removeVirtualRoots(previousBodyNodes);
      disposeSubFrames(previousBodyNodes, context);
      let parsed = new DOMParser().parseFromString(htmlContent, "text/html");
      mergeRmxDataFromDocument(context.data, parsed);
      context.styleManager.reset();
      context.styleManager.adoptServerStyles(
        collectFrameServerStyleTags(createElementContainer(parsed))
      );
      syncElementAttributes(container.doc.documentElement, parsed.documentElement);
      syncElementAttributes(container.doc.head, parsed.head);
      syncElementAttributes(container.doc.body, parsed.body);
      diffNodes(Array.from(container.doc.head.childNodes), Array.from(parsed.head.childNodes), {
        ...context,
        regionParent: container.doc.head,
        regionTailRef: null
      });
      diffNodes(Array.from(container.doc.body.childNodes), Array.from(parsed.body.childNodes), {
        ...context,
        regionParent: container.doc.body,
        regionTailRef: null
      });
      let bodyContainer = createElementContainer(container.doc.body);
      if (options?.signal?.aborted) return;
      scheduleHydrationInContainer(bodyContainer, context, options?.initialHydrationTracker);
      createSubFrames(bodyContainer.childNodes, context);
      return;
    }
    let fragment = htmlContent !== void 0 ? createFragmentFromString(container.doc, htmlContent) : content;
    context.styleManager.reset();
    context.styleManager.adoptServerStyles(
      collectFrameServerStyleTags(createElementContainer(fragment))
    );
    removeEmptyHeads(fragment);
    mergeRmxDataFromFragment(context.data, fragment);
    let nextContainer = createContainer(fragment);
    if (options?.signal?.aborted) return;
    diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
      ...context,
      regionTailRef: container.regionTailRef,
      regionParent: container.regionParent
    });
    if (options?.signal?.aborted) return;
    scheduleHydrationInContainer(container, context, options?.initialHydrationTracker);
    createSubFrames(container.childNodes, context);
  }
  function createFrameContentRoot() {
    let virtualRoot;
    if (container.root instanceof Document) {
      virtualRoot = createRoot(container.doc.body, {
        scheduler: context.scheduler,
        frame,
        styleManager: context.styleManager
      });
    } else {
      invariant(Array.isArray(root2), "Expected comment-bounded frame root");
      virtualRoot = createRangeRoot(root2, {
        scheduler: context.scheduler,
        frame,
        styleManager: context.styleManager
      });
    }
    virtualRoot.addEventListener("error", (event) => {
      if (context.errorTarget === virtualRoot) return;
      context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
    });
    return virtualRoot;
  }
  function getContentNodes() {
    return container.root instanceof Document ? Array.from(container.doc.body.childNodes) : container.childNodes;
  }
  function clearFrameContent() {
    for (let node of getContentNodes()) {
      node.parentNode?.removeChild(node);
    }
  }
  async function hydrateInitial() {
    let initialHydrationTracker = createInitialHydrationTracker();
    context.styleManager.reset();
    context.styleManager.adoptServerStyles(collectFrameServerStyleTags(container));
    createSubFrames(container.childNodes, context);
    scheduleHydrationInContainer(container, context, initialHydrationTracker);
    if (init.marker?.status === "pending") {
      let markerId = init.marker.id;
      let early = consumeFrameTemplate(markerId) ?? getEarlyFrameContent(markerId);
      if (early) {
        await render(early, { initialHydrationTracker });
      } else {
        let observer = setupTemplateObserver();
        let unsubscribe = subscribeFrameTemplate(markerId, async (fragment) => {
          unsubscribe();
          await render(fragment);
          observer.disconnect();
        });
        subscriptions.push(unsubscribe);
        let buffered = consumeFrameTemplate(markerId);
        if (buffered) {
          unsubscribe();
          await render(buffered);
          observer.disconnect();
        }
        observers.push(observer);
      }
    }
    initialHydrationTracker.finalize();
    await initialHydrationTracker.ready();
  }
  function dispose() {
    reloadController?.abort();
    reloadController = void 0;
    contentRoot?.dispose();
    contentRoot = void 0;
    for (let observer of observers) {
      observer.disconnect();
    }
    observers.length = 0;
    for (let unsubscribe of subscriptions) {
      unsubscribe();
    }
    subscriptions.length = 0;
    removeVirtualRoots(container.childNodes);
    disposeSubFrames(container.childNodes, context);
    context.styleManager.dispose();
    if (frameName) {
      if (init.namedFrames.get(frameName) === frame) {
        init.namedFrames.delete(frameName);
      }
    }
  }
  let readyPromise = hydrateInitial();
  return {
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    dispose,
    handle: frame
  };
}
function createFrameRuntime(init) {
  return {
    topFrame: init.topFrame,
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    data: init.data,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames
  };
}
function createInitialHydrationTracker() {
  let pending = 0;
  let finalized = false;
  let resolveReady;
  let readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });
  function maybeResolve() {
    if (finalized && pending === 0) {
      resolveReady?.();
      resolveReady = void 0;
    }
  }
  return {
    track() {
      pending++;
      let completed = false;
      return () => {
        if (completed) return;
        completed = true;
        pending--;
        maybeResolve();
      };
    },
    finalize() {
      finalized = true;
      maybeResolve();
    },
    ready() {
      return readyPromise;
    }
  };
}
function mergeRmxDataFromDocument(into, doc) {
  let scripts = Array.from(doc.querySelectorAll("script#rmx-data"));
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue;
    mergeRmxData(into, parseRmxDataScript(script));
    script.remove();
  }
}
function mergeRmxDataFromFragment(into, fragment) {
  let scripts = Array.from(fragment.querySelectorAll("script#rmx-data"));
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue;
    mergeRmxData(into, parseRmxDataScript(script));
    script.remove();
  }
}
function removeEmptyHeads(fragment) {
  let heads = Array.from(fragment.querySelectorAll("head"));
  for (let head of heads) {
    if (!head.childNodes.length) {
      head.remove();
    }
  }
}
function collectFrameServerStyleTags(container) {
  let styles = [];
  let nodes = container.root instanceof Document ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)] : container.childNodes;
  collectOwnedServerStyleTags(nodes, styles);
  return styles;
}
function collectOwnedServerStyleTags(nodes, styles) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      i = nodes.indexOf(end);
      continue;
    }
    if (node instanceof HTMLStyleElement && node.matches("style[data-rmx]")) {
      styles.push(node);
      continue;
    }
    if (node instanceof Element || node instanceof Document || node instanceof DocumentFragment) {
      collectOwnedServerStyleTags(Array.from(node.childNodes), styles);
    }
  }
}
function parseRmxDataScript(script) {
  try {
    return JSON.parse(script.textContent || "{}");
  } catch {
    console.error("[createFrame] Failed to parse rmx-data script");
    return {};
  }
}
function mergeRmxData(into, from) {
  if (from.h) {
    if (!into.h) into.h = {};
    copyOwnRmxEntries(into.h, from.h);
  }
  if (from.f) {
    if (!into.f) into.f = {};
    copyOwnRmxEntries(into.f, from.f);
  }
}
function copyOwnRmxEntries(target, source) {
  for (let key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (!Object.hasOwn(source, key)) continue;
    target[key] = source[key];
  }
}
function scheduleHydrationInContainer(container, context, initialHydrationTracker) {
  let hydrationMarkers = findHydrationMarkers(container);
  if (hydrationMarkers.length === 0) return;
  let hydrationData = context.data.h;
  if (!hydrationData) return;
  for (let marker of hydrationMarkers) {
    let entry = hydrationData[marker.id];
    if (!entry) continue;
    scheduleHydrationMarker(marker, entry, context, initialHydrationTracker);
  }
}
function scheduleHydrationMarker(marker, entry, context, initialHydrationTracker) {
  let done = initialHydrationTracker?.track();
  let key = `${entry.moduleUrl}#${entry.exportName}`;
  let hydrateWithComponent = (component) => {
    if (!isHydrationMarkerLive(marker, context)) return;
    let vElement = createElement(component, entry.props);
    context.pendingClientEntries.set(marker.start, [marker.end, vElement]);
    hydrateRegion(vElement, marker.start, marker.end, context);
  };
  let cached = context.moduleCache.get(key);
  if (cached) {
    hydrateWithComponent(cached);
    done?.();
    return;
  }
  getOrStartModuleLoad(key, entry, marker.id, context).then((component) => {
    if (component) {
      hydrateWithComponent(component);
    }
  }).finally(() => {
    done?.();
  });
}
function getOrStartModuleLoad(key, entry, markerId, context) {
  let inFlight = context.moduleLoads.get(key);
  if (inFlight) return inFlight;
  let loadPromise = (async () => {
    try {
      let mod = await context.loadModule(entry.moduleUrl, entry.exportName);
      if (typeof mod !== "function") {
        throw new Error(`Export "${entry.exportName}" from "${entry.moduleUrl}" is not a function`);
      }
      context.moduleCache.set(key, mod);
      return mod;
    } catch (error) {
      console.error(`[createFrame] Failed to load module for ${markerId}:`, error);
      return void 0;
    } finally {
      context.moduleLoads.delete(key);
    }
  })();
  context.moduleLoads.set(key, loadPromise);
  return loadPromise;
}
function createElement(component, props) {
  let revivedProps = reviveSerializedValue(props);
  return jsx(component, revivedProps);
}
function reviveSerializedValue(value) {
  if (value === null || value === void 0) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedValue(item));
  }
  let record = value;
  if (record.$rmxFrame === true) {
    let props = reviveSerializedObject(record.props);
    let key = reviveSerializedValue(record.key);
    return jsx(Frame, props, key);
  }
  if (record.$rmx === true && typeof record.type === "string") {
    let props = reviveSerializedObject(record.props);
    let key = reviveSerializedValue(record.key);
    return jsx(record.type, props, key);
  }
  let revived = {};
  for (let key in record) {
    revived[key] = reviveSerializedValue(record[key]);
  }
  return revived;
}
function reviveSerializedObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  let revived = reviveSerializedValue(value);
  if (!revived || typeof revived !== "object" || Array.isArray(revived)) return {};
  return revived;
}
function hydrateRegion(vElement, start, end, context) {
  context.pendingClientEntries.delete(start);
  if (isHydratedVirtualRootMarker(start)) {
    start.$rmx.render(vElement);
    return;
  }
  let root2 = createRangeRoot([start, end], {
    scheduler: context.scheduler,
    frame: context.frame,
    styleManager: context.styleManager
  });
  root2.addEventListener("error", (event) => {
    if (context.errorTarget === root2) return;
    context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  });
  Object.defineProperty(start, "$rmx", { value: root2, enumerable: false });
  root2.render(vElement);
}
function createSubFrames(nodes, context) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      if (!context.frameInstances.has(node)) {
        let id = getFrameId(node);
        let marker = context.data.f?.[id];
        if (marker) {
          let frameMarker = { ...marker, id };
          let subFrame = createFrame([node, end], {
            src: frameMarker.src,
            marker: frameMarker,
            topFrame: context.topFrame,
            errorTarget: context.errorTarget,
            loadModule: context.loadModule,
            resolveFrame: context.resolveFrame,
            pendingClientEntries: context.pendingClientEntries,
            scheduler: context.scheduler,
            data: context.data,
            moduleCache: context.moduleCache,
            moduleLoads: context.moduleLoads,
            frameInstances: context.frameInstances,
            namedFrames: context.namedFrames
          });
          context.frameInstances.set(node, subFrame);
        }
      }
      i = nodes.indexOf(end);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      createSubFrames(Array.from(node.childNodes), context);
    }
  }
}
function isHydrationMarkerLive(marker, context) {
  if (!marker.start.isConnected || !marker.end.isConnected) return false;
  if (marker.start.parentNode !== marker.end.parentNode) return false;
  let startText = marker.start.data.trim();
  if (startText !== `rmx:h:${marker.id}`) return false;
  if (marker.end.data.trim() !== "/rmx:h") return false;
  let parent = marker.start.parentNode;
  if (!parent) return false;
  if (context.regionTailRef) {
    let startPosition = marker.start.compareDocumentPosition(context.regionTailRef);
    let endPosition = marker.end.compareDocumentPosition(context.regionTailRef);
    let tailFollowsStart = (startPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    let tailFollowsEnd = (endPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!tailFollowsStart || !tailFollowsEnd) return false;
  }
  return true;
}
function removeVirtualRoots(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isHydratedVirtualRootMarker(node)) {
      node.$rmx.dispose();
      let end = findEndMarker(node, isHydrationStart, isHydrationEnd);
      i = nodes.indexOf(end);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      removeVirtualRoots(Array.from(node.childNodes));
    }
  }
}
function disposeSubFrames(nodes, context) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      let subFrame = context.frameInstances.get(node);
      if (subFrame) {
        subFrame.dispose();
        context.frameInstances.delete(node);
      }
      i = nodes.indexOf(end);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      disposeSubFrames(Array.from(node.childNodes), context);
    }
  }
}
function getEarlyFrameContent(id) {
  let template = document.querySelector(`template#${id}`);
  if (template instanceof HTMLTemplateElement) {
    let fragment = template.content;
    template.remove();
    return fragment;
  }
  return null;
}
function setupTemplateObserver() {
  let root2 = document.body ?? document.documentElement ?? document;
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        collectAndPublishTemplates(node);
      }
    }
  });
  observer.observe(root2, { childList: true, subtree: true });
  return observer;
}
function collectAndPublishTemplates(node) {
  if (node instanceof HTMLTemplateElement) {
    publishFrameTemplateElement(node);
    return;
  }
  if (!(node instanceof Element)) return;
  let templates = Array.from(node.querySelectorAll("template"));
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue;
    publishFrameTemplateElement(template);
  }
}
function publishFrameTemplateElement(template) {
  if (!template.id) return;
  template.remove();
  publishFrameTemplate(template.id, template.content);
}
function publishFrameTemplate(id, fragment) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners || listeners.size === 0) {
    let queue = bufferedFrameTemplates.get(id);
    if (!queue) {
      queue = [];
      bufferedFrameTemplates.set(id, queue);
    }
    queue.push(fragment);
    return;
  }
  for (let listener of listeners) {
    listener(fragment.cloneNode(true));
  }
}
function consumeFrameTemplate(id) {
  let queue = bufferedFrameTemplates.get(id);
  if (!queue || queue.length === 0) return null;
  let fragment = queue.shift() ?? null;
  if (queue.length === 0) {
    bufferedFrameTemplates.delete(id);
  }
  return fragment;
}
function subscribeFrameTemplate(id, listener) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    frameTemplateListeners.set(id, listeners);
  }
  listeners.add(listener);
  return () => {
    let current = frameTemplateListeners.get(id);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      frameTemplateListeners.delete(id);
    }
  };
}
var COMPLETE_TEMPLATE_WITH_ID_PATTERN = /<template\b[^>]*\bid=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/template>/gi;
function extractTemplatesFromBuffer(doc, buffer, onTemplate) {
  let html = "";
  let cursor = 0;
  let hadMatch = false;
  COMPLETE_TEMPLATE_WITH_ID_PATTERN.lastIndex = 0;
  let match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
  while (match) {
    hadMatch = true;
    let index = match.index;
    let fullMatch = match[0];
    let id = match[1] ?? match[2];
    let matchEnd = index + fullMatch.length;
    html += buffer.slice(cursor, index);
    if (id) {
      let parsed = createFragmentFromString(doc, fullMatch);
      let template = parsed.querySelector("template");
      if (template instanceof HTMLTemplateElement && template.id) {
        onTemplate(template.id, template.content);
      }
    }
    cursor = matchEnd;
    match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
  }
  let tail = buffer.slice(cursor);
  if (tail === "") return { html, remainder: "" };
  let tailStart = tail.toLowerCase().lastIndexOf("<template");
  if (tailStart === -1) {
    return { html: html + tail, remainder: "" };
  }
  if (!hadMatch) {
    return {
      html: buffer.slice(0, tailStart),
      remainder: buffer.slice(tailStart)
    };
  }
  return {
    html: html + tail.slice(0, tailStart),
    remainder: tail.slice(tailStart)
  };
}
async function renderFrameStream(stream, doc, applyHtml) {
  let reader = stream.getReader();
  let decoder = new TextDecoder();
  let buffer = "";
  let html = "";
  let appliedLength = 0;
  let appliedOnce = false;
  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let parsed2 = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
      buffer = parsed2.remainder;
      if (parsed2.html !== "") {
        html += parsed2.html;
        let htmlMarkers = collectHtmlMarkerSummary(html);
        if (!hasBalancedMarkerSummary(htmlMarkers)) {
          continue;
        }
        await applyHtml(html);
        appliedLength = html.length;
        appliedOnce = true;
      }
    }
    buffer += decoder.decode();
    let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
    html += parsed.html;
    buffer = parsed.remainder;
    if (buffer !== "") {
      html += buffer;
      buffer = "";
    }
    if (html !== "" && html.length > appliedLength) {
      await applyHtml(html);
      appliedOnce = true;
    }
    if (html === "" && !appliedOnce) {
      await applyHtml("");
    }
  } finally {
    reader.releaseLock();
  }
}
function createContainer(root2) {
  return Array.isArray(root2) ? createCommentContainer(root2) : createElementContainer(root2);
}
function createElementContainer(root2) {
  let doc = root2 instanceof Document ? root2 : root2.ownerDocument ?? document;
  return {
    doc,
    root: root2,
    get childNodes() {
      return Array.from(root2.childNodes);
    }
  };
}
function createCommentContainer([start, end]) {
  let parent = end.parentNode;
  invariant(parent, "Invalid comment container");
  invariant(start.parentNode === parent, "Boundaries must share parent");
  let doc = parent.ownerDocument ?? document;
  let getChildNodesBetween = () => {
    let nodes = [];
    let node = start.nextSibling;
    while (node && node !== end) {
      nodes.push(node);
      node = node.nextSibling;
    }
    return nodes;
  };
  return {
    doc,
    root: parent,
    get childNodes() {
      return getChildNodesBetween();
    },
    regionTailRef: end,
    regionParent: parent
  };
}
function createFragmentFromString(doc, content) {
  let template = doc.createElement("template");
  template.innerHTML = stripDoctypeMarkup(content).trim();
  return template.content;
}
function isRemixNodeFrameContent(content) {
  return !(content instanceof ReadableStream || content instanceof DocumentFragment || typeof content === "string");
}
function isFullDocumentHtml(content) {
  let trimmed = content.trimStart();
  return /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}
function findHydrationMarkers(container) {
  let results = [];
  forEachComment(container, (comment) => {
    let trimmed = comment.data.trim();
    if (!trimmed.startsWith("rmx:h:")) return;
    let id = trimmed.slice("rmx:h:".length);
    let end = findEndMarker(comment, isHydrationStart, isHydrationEnd);
    results.push({ id, start: comment, end });
  });
  return results;
}
function forEachComment(container, cb) {
  walkCommentsInNodes(container.childNodes, cb);
}
function walkCommentsInNodes(nodes, cb) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      i = nodes.indexOf(end);
      continue;
    }
    if (node.nodeType === Node.COMMENT_NODE) cb(node);
    if (node.childNodes && node.childNodes.length > 0) {
      walkCommentsInNodes(Array.from(node.childNodes), cb);
    }
  }
}
function isHydrationStart(node) {
  return node.data.trim().startsWith("rmx:h:");
}
function isHydrationEnd(node) {
  return node.data.trim() === "/rmx:h";
}
function isHydratedVirtualRootMarker(node) {
  return node instanceof Comment && "$rmx" in node;
}
function isFrameStart(node) {
  return node instanceof Comment && node.data.trim().startsWith("rmx:f:");
}
function isFrameEnd(node) {
  return node.data.trim() === "/rmx:f";
}
function getFrameId(start) {
  let trimmed = start.data.trim();
  invariant(trimmed.startsWith("rmx:f:"), "Invalid frame start marker");
  return trimmed.slice("rmx:f:".length);
}
function findEndMarker(start, isStart, isEnd) {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      let comment = node;
      if (isStart(comment)) depth++;
      else if (isEnd(comment)) {
        depth--;
        if (depth === 0) return comment;
      }
    }
    node = node.nextSibling;
  }
  throw new Error("End marker not found");
}
function collectHtmlMarkerSummary(html) {
  return {
    frameStarts: html.match(/<!--\s*rmx:f:/g)?.length ?? 0,
    frameEnds: html.match(/<!--\s*\/rmx:f\s*-->/g)?.length ?? 0,
    hydrationStarts: html.match(/<!--\s*rmx:h:/g)?.length ?? 0,
    hydrationEnds: html.match(/<!--\s*\/rmx:h\s*-->/g)?.length ?? 0
  };
}
function hasBalancedMarkerSummary(summary) {
  return summary.frameStarts === summary.frameEnds && summary.hydrationStarts === summary.hydrationEnds;
}

// ../../../src/runtime/mixins/on-mixin.ts
var onMixin = createMixin((handle) => {
  let currentHandler = () => {
  };
  let currentType = "";
  let currentCapture = false;
  let currentNode = null;
  let reentry = null;
  let stableHandler = (event) => {
    reentry?.abort(new DOMException("", "EventReentry"));
    reentry = new AbortController();
    void currentHandler(event, reentry.signal);
  };
  handle.addEventListener("insert", (event) => {
    currentNode = event.node;
    currentNode.addEventListener(currentType, stableHandler, currentCapture);
  });
  handle.addEventListener("remove", () => {
    currentNode?.removeEventListener(currentType, stableHandler, currentCapture);
    currentNode = null;
    reentry?.abort(new DOMException("", "AbortError"));
  });
  return (type, handler, captureBoolean = false) => {
    let previousType = currentType;
    let previousCapture = currentCapture;
    let needsRebind = currentType !== type || currentCapture !== captureBoolean;
    currentType = type;
    currentHandler = handler;
    currentCapture = captureBoolean;
    if (needsRebind && currentNode) {
      currentNode.removeEventListener(previousType, stableHandler, previousCapture);
      currentNode.addEventListener(type, stableHandler, captureBoolean);
    }
    return handle.element;
  };
});
function on(...args) {
  let [type, handler, captureBoolean] = args;
  return onMixin(
    type,
    handler,
    captureBoolean
  );
}

// index.tsx
var name = "remix";
function Button() {
  return ({ id, text, fn }) => /* @__PURE__ */ jsx("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ jsx("button", { id, class: "btn btn-primary btn-block", type: "button", mix: [on("click", fn)], children: text }) });
}
function MetricCard(handle) {
  let selected = false;
  let hovered = false;
  return ({
    id,
    label,
    value,
    change
  }) => /* @__PURE__ */ jsx(
    "div",
    {
      class: `metric-card ${selected ? "selected" : ""}`,
      mix: [
        on("click", () => {
          selected = !selected;
          handle.update();
        }),
        on("mouseenter", () => {
          hovered = true;
          handle.update();
        }),
        on("mouseleave", () => {
          hovered = false;
          handle.update();
        }),
        on("focus", (e) => {
          e.currentTarget.style.outline = "2px solid #222";
          e.currentTarget.style.outlineOffset = "2px";
        }),
        on("blur", (e) => {
          e.currentTarget.style.outline = "";
        })
      ],
      tabIndex: 0,
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        transform: hovered && !selected ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow: selected ? "0 4px 8px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
      },
      children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", color: "#666", marginBottom: "8px" }, children: label }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }, children: value }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: change.startsWith("+") ? "#28a745" : "#dc3545" }, children: change })
      ]
    }
  );
}
function ChartBar(handle) {
  let hovered = false;
  return ({ value, index }) => /* @__PURE__ */ jsx(
    "div",
    {
      class: "chart-bar",
      mix: [
        on("click", () => {
        }),
        on("mouseenter", () => {
          hovered = true;
          handle.update();
        }),
        on("mouseleave", () => {
          hovered = false;
          handle.update();
        }),
        on("focus", (e) => {
          e.currentTarget.style.outline = "2px solid #222";
          e.currentTarget.style.outlineOffset = "2px";
        }),
        on("blur", (e) => {
          e.currentTarget.style.outline = "";
        })
      ],
      style: {
        height: `${value}%`,
        backgroundColor: hovered ? "#286090" : "#337ab7",
        width: "30px",
        margin: "0 2px",
        cursor: "pointer",
        transition: "all 0.2s",
        opacity: hovered ? 0.9 : 1,
        transform: hovered ? "scaleY(1.1)" : "scaleY(1)"
      },
      tabIndex: 0
    }
  );
}
function ActivityItem(handle) {
  let read = false;
  let hovered = false;
  return ({ id, title, time, icon }) => /* @__PURE__ */ jsx(
    "li",
    {
      class: `activity-item ${read ? "read" : ""}`,
      mix: [
        on("click", () => {
          read = !read;
          handle.update();
        }),
        on("mouseenter", () => {
          hovered = true;
          handle.update();
        }),
        on("mouseleave", () => {
          hovered = false;
          handle.update();
        })
      ],
      style: {
        padding: "12px",
        borderBottom: "1px solid #eee",
        cursor: "pointer",
        backgroundColor: hovered ? "#f5f5f5" : read ? "rgba(245, 245, 245, 0.6)" : "#fff",
        display: "flex",
        alignItems: "center",
        gap: "12px"
      },
      children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#337ab7",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold"
            },
            children: icon
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontWeight: read ? "normal" : "bold" }, children: title }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "#666" }, children: time })
        ] })
      ]
    }
  );
}
function DropdownMenu(handle) {
  let open = false;
  let hovered = false;
  let actions = ["View Details", "Edit", "Duplicate", "Archive", "Delete"];
  return ({ rowId }) => /* @__PURE__ */ jsx("div", { style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        class: "btn btn-primary",
        mix: [
          on("click", (e) => {
            e.stopPropagation();
            open = !open;
            handle.update();
          }),
          on("mouseenter", () => {
            hovered = true;
            handle.update();
          }),
          on("mouseleave", () => {
            hovered = false;
            handle.update();
          }),
          on("focus", (e) => {
            e.currentTarget.style.outline = "2px solid #222";
            e.currentTarget.style.outlineOffset = "2px";
          }),
          on("blur", (e) => {
            e.currentTarget.style.outline = "";
          })
        ],
        style: {
          padding: "4px 8px",
          fontSize: "12px",
          backgroundColor: hovered ? "#286090" : "#337ab7"
        },
        children: "\u22EE"
      }
    ),
    open && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          top: "100%",
          right: 0,
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          borderRadius: "4px",
          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          zIndex: 1e3,
          minWidth: "150px",
          marginTop: "4px"
        },
        mix: [
          on("mouseleave", () => {
            open = false;
            handle.update();
          })
        ],
        children: actions.map((action, idx) => /* @__PURE__ */ jsx(
          "div",
          {
            mix: [
              on("click", (e) => {
                e.stopPropagation();
                open = false;
                handle.update();
              }),
              on("mouseenter", (e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }),
              on("mouseleave", (e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              })
            ],
            style: {
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: idx < actions.length - 1 ? "1px solid #eee" : "none"
            },
            children: action
          },
          idx
        ))
      }
    )
  ] });
}
function DashboardTableRow(handle) {
  let hovered = false;
  let selected = false;
  return ({ row }) => /* @__PURE__ */ jsx(
    "tr",
    {
      class: selected ? "danger" : "",
      mix: [
        on("click", () => {
          selected = !selected;
          handle.update();
        }),
        on("mouseenter", () => {
          hovered = true;
          handle.update();
        }),
        on("mouseleave", () => {
          hovered = false;
          handle.update();
        })
      ],
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.id }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.label }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ jsx("span", { style: { color: "#28a745" }, children: "Active" }) }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: [
          "$",
          (row.id * 10.5).toFixed(2)
        ] }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ jsx(DropdownMenu, { rowId: row.id }) })
      ]
    }
  );
}
function SearchInput(handle) {
  let value = "";
  let focused = false;
  return () => /* @__PURE__ */ jsx(
    "input",
    {
      type: "text",
      placeholder: "Search...",
      value,
      mix: [
        on("input", (e) => {
          value = e.target.value;
          handle.update();
        }),
        on("focus", () => {
          focused = true;
          handle.update();
        }),
        on("blur", () => {
          focused = false;
          handle.update();
        })
      ],
      style: {
        padding: "8px 12px",
        border: `1px solid ${focused ? "#337ab7" : "#ddd"}`,
        borderRadius: "4px",
        fontSize: "14px",
        width: "300px",
        outline: focused ? "2px solid #337ab7" : "none",
        outlineOffset: "2px"
      }
    }
  );
}
function FormWidgets(handle) {
  let selectValue = "option1";
  let checkboxValues = /* @__PURE__ */ new Set();
  let radioValue = "radio1";
  let toggleValue = false;
  let progressValue = 45;
  return () => /* @__PURE__ */ jsx("div", { style: { padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }, children: [
    /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Settings" }),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Select Option" }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: selectValue,
          mix: [
            on("change", (e) => {
              selectValue = e.target.value;
              handle.update();
            }),
            on("focus", (e) => {
              e.currentTarget.style.borderColor = "#337ab7";
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            }),
            on("blur", (e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.outline = "none";
            })
          ],
          style: {
            padding: "6px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
            width: "100%"
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "option1", children: "Option 1" }),
            /* @__PURE__ */ jsx("option", { value: "option2", children: "Option 2" }),
            /* @__PURE__ */ jsx("option", { value: "option3", children: "Option 3" }),
            /* @__PURE__ */ jsx("option", { value: "option4", children: "Option 4" })
          ]
        }
      )
    ] }),
    ["Checkbox 1", "Checkbox 2", "Checkbox 3"].map((label, idx) => /* @__PURE__ */ jsx(
      "div",
      {
        style: { marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" },
        children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              id: `checkbox-${idx}`,
              checked: checkboxValues.has(`checkbox-${idx}`),
              mix: [
                on("change", (e) => {
                  if (e.target.checked) {
                    checkboxValues.add(`checkbox-${idx}`);
                  } else {
                    checkboxValues.delete(`checkbox-${idx}`);
                  }
                  handle.update();
                }),
                on("focus", (e) => {
                  e.currentTarget.style.outline = "2px solid #337ab7";
                  e.currentTarget.style.outlineOffset = "2px";
                }),
                on("blur", (e) => {
                  e.currentTarget.style.outline = "";
                })
              ]
            }
          ),
          /* @__PURE__ */ jsx("label", { for: `checkbox-${idx}`, style: { fontSize: "14px", cursor: "pointer" }, children: label })
        ]
      },
      idx
    )),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: ["Radio 1", "Radio 2", "Radio 3"].map((label, idx) => /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "8px", cursor: "pointer" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "radio",
          name: "radio-group",
          value: `radio${idx + 1}`,
          checked: radioValue === `radio${idx + 1}`,
          mix: [
            on("change", (e) => {
              radioValue = e.target.value;
              handle.update();
            }),
            on("focus", (e) => {
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            }),
            on("blur", (e) => {
              e.currentTarget.style.outline = "";
            })
          ],
          style: { marginRight: "8px" }
        }
      ),
      label
    ] }, idx)) }),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Toggle Switch" }),
      /* @__PURE__ */ jsx(
        "label",
        {
          style: {
            display: "inline-block",
            position: "relative",
            width: "50px",
            height: "24px",
            cursor: "pointer"
          },
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: toggleValue,
                mix: [
                  on("change", (e) => {
                    toggleValue = e.target.checked;
                    handle.update();
                  }),
                  on("focus", (e) => {
                    e.currentTarget.style.outline = "2px solid #222";
                    e.currentTarget.style.outlineOffset = "2px";
                  }),
                  on("blur", (e) => {
                    e.currentTarget.style.outline = "";
                  })
                ],
                style: { opacity: 0, width: 0, height: 0 }
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: toggleValue ? "#337ab7" : "#ccc",
                  borderRadius: "24px",
                  transition: "background-color 0.3s"
                },
                children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#fff",
                      borderRadius: "50%",
                      transition: "transform 0.3s",
                      transform: toggleValue ? "translateX(26px)" : "translateX(0)"
                    }
                  }
                )
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Progress Bar" }),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: "100%",
            height: "24px",
            backgroundColor: "#eee",
            borderRadius: "4px",
            overflow: "hidden",
            position: "relative"
          },
          children: /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                width: `${progressValue}%`,
                height: "100%",
                backgroundColor: "#337ab7",
                transition: "width 0.3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "12px"
              },
              children: [
                progressValue,
                "%"
              ]
            }
          )
        }
      )
    ] })
  ] });
}
function Dashboard(handle) {
  let dashboardRows = buildData(300);
  let sortDashboardAsc = () => {
    dashboardRows = sortRows(dashboardRows, true);
    handle.update();
  };
  let sortDashboardDesc = () => {
    dashboardRows = sortRows(dashboardRows, false);
    handle.update();
  };
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84];
  let activities = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Activity ${i + 1}: ${["Order placed", "Payment received", "Shipment created", "Customer registered", "Product updated"][i % 5]}`,
    time: `${i + 1} ${i === 0 ? "minute" : "minutes"} ago`,
    icon: ["O", "P", "S", "C", "U"][i % 5]
  }));
  return ({ onSwitchToTable }) => /* @__PURE__ */ jsx("div", { class: "container", style: { maxWidth: "1400px" }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          display: "flex",
          marginBottom: "20px",
          alignItems: "center",
          justifyContent: "space-between"
        },
        children: [
          /* @__PURE__ */ jsx("h1", { style: { margin: 0 }, children: "Dashboard" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              id: "switchToTable",
              class: "btn btn-primary",
              type: "button",
              mix: [on("click", onSwitchToTable)],
              children: "Switch to Table"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "20px", marginBottom: "20px" }, children: /* @__PURE__ */ jsx("div", { style: { flex: 1, display: "flex", gap: "16px" }, children: [
      /* @__PURE__ */ jsx(MetricCard, { id: 1, label: "Total Sales", value: "$125,430", change: "+12.5%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 2, label: "Orders", value: "1,234", change: "+8.2%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 3, label: "Customers", value: "5,678", change: "+15.3%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 4, label: "Revenue", value: "$89,123", change: "+9.7%" })
    ] }) }),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px"
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Sales Performance" }),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-around",
                      height: "200px",
                      padding: "20px 0"
                    },
                    children: chartData.map((value, index) => /* @__PURE__ */ jsx(ChartBar, { value, index }, index))
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Recent Activity" }),
                /* @__PURE__ */ jsx(
                  "ul",
                  {
                    style: {
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      maxHeight: "200px",
                      overflowY: "auto"
                    },
                    children: activities.map((activity) => /* @__PURE__ */ jsx(ActivityItem, { ...activity }, activity.id))
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "20px" }, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
              /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Dashboard Items" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  id: "sortDashboardAsc",
                  class: "btn btn-primary",
                  type: "button",
                  mix: [on("click", sortDashboardAsc)],
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2191"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  id: "sortDashboardDesc",
                  class: "btn btn-primary",
                  type: "button",
                  mix: [on("click", sortDashboardDesc)],
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2193"
                }
              )
            ] }),
            /* @__PURE__ */ jsx(SearchInput, {})
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden"
          },
          children: /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { style: { backgroundColor: "#f5f5f5" }, children: [
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "ID" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Label" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Status" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Value" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: dashboardRows.map((row) => /* @__PURE__ */ jsx(DashboardTableRow, { row }, row.id)) })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsx(FormWidgets, {})
  ] });
}
function App(handle) {
  let rows = [];
  let selected = null;
  let view = "table";
  let setRows = (newRows) => {
    rows = newRows;
    handle.update();
  };
  let setSelected = (newSelected) => {
    selected = newSelected;
    handle.update();
  };
  let switchToDashboard = () => {
    view = "dashboard";
    handle.update();
  };
  let switchToTable = () => {
    view = "table";
    handle.update();
  };
  return () => {
    if (view === "dashboard") {
      return /* @__PURE__ */ jsx(Dashboard, { onSwitchToTable: switchToTable });
    }
    return /* @__PURE__ */ jsx("div", { class: "container", children: [
      /* @__PURE__ */ jsx("div", { class: "jumbotron", children: /* @__PURE__ */ jsx("div", { class: "row", children: [
        /* @__PURE__ */ jsx("div", { class: "col-md-6", children: /* @__PURE__ */ jsx("h1", { children: "Remix" }) }),
        /* @__PURE__ */ jsx("div", { class: "col-md-6", children: /* @__PURE__ */ jsx("div", { class: "row", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "run",
              text: "Create 1,000 rows",
              fn: () => {
                rows = get1000Rows();
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "runlots",
              text: "Create 10,000 rows",
              fn: () => {
                rows = get10000Rows();
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "add",
              text: "Append 1,000 rows",
              fn: () => {
                setRows([...rows, ...get1000Rows()]);
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "update",
              text: "Update every 10th row",
              fn: () => {
                setRows(updatedEvery10thRow(rows));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "clear",
              text: "Clear",
              fn: () => {
                rows = [];
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "swaprows",
              text: "Swap Rows",
              fn: () => {
                setRows(swapRows(rows));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "sortasc",
              text: "Sort Ascending",
              fn: () => {
                setRows(sortRows(rows, true));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "sortdesc",
              text: "Sort Descending",
              fn: () => {
                setRows(sortRows(rows, false));
              }
            }
          ),
          /* @__PURE__ */ jsx(Button, { id: "switchToDashboard", text: "Switch to Dashboard", fn: switchToDashboard })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsx("table", { class: "table table-hover table-striped test-data", children: /* @__PURE__ */ jsx("tbody", { children: rows.map((row) => {
        let rowId = row.id;
        return /* @__PURE__ */ jsx("tr", { class: selected === rowId ? "danger" : "", children: [
          /* @__PURE__ */ jsx("td", { class: "col-md-1", children: rowId }),
          /* @__PURE__ */ jsx("td", { class: "col-md-4", children: /* @__PURE__ */ jsx(
            "a",
            {
              mix: [
                on("click", () => {
                  setSelected(rowId);
                })
              ],
              children: row.label
            }
          ) }),
          /* @__PURE__ */ jsx("td", { class: "col-md-1", children: /* @__PURE__ */ jsx(
            "a",
            {
              mix: [
                on("click", () => {
                  setRows(remove(rows, rowId));
                })
              ],
              children: /* @__PURE__ */ jsx("span", { class: "glyphicon glyphicon-remove", "aria-hidden": "true" })
            }
          ) }),
          /* @__PURE__ */ jsx("td", { class: "col-md-6" })
        ] }, rowId);
      }) }) }),
      /* @__PURE__ */ jsx("span", { class: "preloadicon glyphicon glyphicon-remove", "aria-hidden": "true" })
    ] });
  };
}
var el = document.getElementById("app");
var root = createRoot(el);
root.render(/* @__PURE__ */ jsx(App, {}));
export {
  name
};
